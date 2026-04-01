"""
Worker process — runs in a separate container.
- Polls the jobs table and processes transcription and VOD watch jobs.
- Runs the APScheduler jobs (notices every 5min, dashboard sync every 60min).
- Handles SIGTERM gracefully: finishes the current job before exiting.
"""
import signal
import time
import json
import logging
from datetime import datetime

from database import init_db, Job, VodTranscript, User, VOD, Course
from ai_service import AIService
from moodle_client import MoodleClient
from scheduler import check_notices_job, sync_dashboard_job, check_session_health_job, watch_vods_for_user
from apscheduler.schedulers.background import BackgroundScheduler
from exponent_server_sdk import PushClient, PushMessage

logging.basicConfig(level=logging.INFO, format='%(asctime)s [worker] %(levelname)s %(message)s')
logger = logging.getLogger("worker")

SessionLocal = init_db()

# ─── Graceful Shutdown ────────────────────────────────────────────────────────

_shutdown = False

def _handle_signal(sig, frame):
    global _shutdown
    logger.info("Shutdown signal received — finishing current job before exit...")
    _shutdown = True

signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_cookie_string(raw: str) -> dict:
    cookies = {}
    for item in raw.split(';'):
        item = item.strip()
        if '=' in item:
            k, v = item.split('=', 1)
            cookies[k.strip()] = v.strip()
    return cookies

def _claim_job(db):
    """Atomically claim one pending job. Uses SELECT FOR UPDATE SKIP LOCKED (PostgreSQL)."""
    job = (
        db.query(Job)
        .filter(Job.status == 'pending')
        .order_by(Job.created_at)
        .with_for_update(skip_locked=True)
        .first()
    )
    if not job:
        return None
    job.status = 'processing'
    job.started_at = datetime.now()
    db.commit()
    return job

# ─── Job Runners ──────────────────────────────────────────────────────────────

def _set_transcript_status(
    db,
    vod_moodle_id: int,
    *,
    status: str | None = None,
    stage: str | None = None,
    is_processing: bool | None = None,
    error_message: str | None = None,
    transcript: str | None = None,
    progress_pct: int | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
):
    row = db.query(VodTranscript).filter(VodTranscript.moodle_id == vod_moodle_id).first()
    if not row:
        row = VodTranscript(moodle_id=vod_moodle_id)
        db.add(row)
        db.flush()
    if status is not None:
        row.status = status
    if stage is not None:
        row.stage = stage
    if is_processing is not None:
        row.is_processing = is_processing
    if error_message is not None:
        row.error_message = error_message
    if transcript is not None:
        row.transcript = transcript
    if progress_pct is not None:
        row.progress_pct = max(0, min(100, int(progress_pct)))
    if started_at is not None:
        row.started_at = started_at
    if completed_at is not None:
        row.completed_at = completed_at
    db.commit()
    return row


def _to_overall_progress(stage: str, stage_pct: int | None) -> int:
    p = 0 if stage_pct is None else max(0, min(100, int(stage_pct)))
    if stage == "extracting_audio":
        return 5 + int(p * 0.40)    # 5..45
    if stage == "transcribing":
        return 45 + int(p * 0.50)   # 45..95
    if stage == "finalizing":
        return 95 + int(p * 0.04)   # 95..99
    if stage == "completed":
        return 100
    if stage == "queued":
        return 0
    return p


def _run_transcribe(payload: dict, db):
    vod_moodle_id = payload['vod_moodle_id']
    m3u8_url = payload['m3u8_url']
    cookies_raw = payload.get('cookies', '')
    user_id = payload.get('user_id')
    vod_title = payload.get('vod_title')
    course_name = payload.get('course_name')

    try:
        now = datetime.now()
        _set_transcript_status(
            db,
            vod_moodle_id,
            status='running',
            stage='extracting_audio',
            is_processing=True,
            error_message='',
            progress_pct=5,
            started_at=now,
        )

        client = MoodleClient("https://ys.learnus.org")
        if isinstance(cookies_raw, dict):
            client.set_cookies(cookies_raw)
        elif cookies_raw and cookies_raw.startswith('{'):
            client.set_cookies(json.loads(cookies_raw))
        elif cookies_raw:
            client.set_cookies(_parse_cookie_string(cookies_raw))

        def _on_stage(stage_name: str):
            _set_transcript_status(
                db,
                vod_moodle_id,
                status='running',
                stage=stage_name,
                is_processing=True,
                progress_pct=_to_overall_progress(stage_name, 0),
            )

        def _on_progress(stage_name: str, stage_pct: int | None, _msg: str | None):
            _set_transcript_status(
                db,
                vod_moodle_id,
                status='running',
                stage=stage_name,
                is_processing=True,
                progress_pct=_to_overall_progress(stage_name, stage_pct),
            )

        transcript, usage = AIService().transcribe_vod(
            m3u8_url,
            on_stage=_on_stage,
            on_progress=_on_progress,
        )

        _set_transcript_status(
            db,
            vod_moodle_id,
            status='done',
            stage='completed',
            is_processing=False,
            transcript=transcript,
            progress_pct=100,
            error_message='',
            completed_at=datetime.now(),
        )
        logger.info(f"Transcription complete for VOD {vod_moodle_id}")

        # Log AI usage
        try:
            from database import AIUsageLog
            db.add(AIUsageLog(
                user_id=user_id, endpoint="transcribe", model=usage.get("model", "whisper-1"),
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                total_tokens=usage.get("total_tokens", 0),
            ))
            db.commit()
        except Exception:
            pass

        # Push notification
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.push_token:
                try:
                    PushClient().publish(PushMessage(
                        to=user.push_token,
                        sound="default",
                        title="텍스트 추출 완료",
                        body=vod_title or "강의 텍스트가 준비되었습니다",
                        data={
                            "type": "transcription_complete",
                            "vodMoodleId": vod_moodle_id,
                            "vodTitle": vod_title,
                            "courseName": course_name,
                            "saveToHistory": True,
                        }
                    ))
                except Exception as exc:
                    logger.error(f"Push notification failed: {exc}")

    except Exception as e:
        logger.error(f"Transcription failed for VOD {vod_moodle_id}: {e}")
        _set_transcript_status(
            db,
            vod_moodle_id,
            status='failed',
            stage='failed',
            is_processing=False,
            progress_pct=0,
            error_message=str(e)[:2000],
            completed_at=datetime.now(),
        )
        raise


def _run_watch_all(payload: dict):
    user_id = payload['user_id']
    watch_vods_for_user(user_id, SessionLocal, blocking=True)


def _run_watch_one(payload: dict):
    user_id = payload['user_id']
    vod_moodle_id = payload['vod_moodle_id']

    db = SessionLocal()
    try:
        from scheduler import get_client
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        vod = db.query(VOD).filter(VOD.moodle_id == vod_moodle_id).first()
        client = get_client(user)
        if not client:
            raise ValueError(f"No valid Moodle session for user {user_id}")
        success = client.watch_vod(vod_moodle_id, duration=vod.duration if vod else None, viewer_url=vod.url if vod else None)
        if success and vod:
            vod.is_completed = True
            db.commit()
    finally:
        db.close()


def _dispatch(job, db):
    t = job.type
    if t == 'transcribe':
        _run_transcribe(job.payload, db)
    elif t == 'watch_all':
        _run_watch_all(job.payload)
    elif t == 'watch_one':
        _run_watch_one(job.payload)
    else:
        raise ValueError(f"Unknown job type: {t}")

# ─── Main Loop ────────────────────────────────────────────────────────────────

def main():
    logger.info("Worker starting...")

    # Reset any jobs that were left in 'processing' state (worker died mid-job)
    db = SessionLocal()
    try:
        stuck_jobs = db.query(Job).filter(Job.status == 'processing').count()
        if stuck_jobs:
            db.query(Job).filter(Job.status == 'processing').update({'status': 'pending'})
            db.commit()
            logger.info(f"Reset {stuck_jobs} stuck job(s) to pending for retry")

        # Keep transcript rows and re-queue them instead of deleting.
        stuck_vt = db.query(VodTranscript).filter(VodTranscript.is_processing == True).count()
        if stuck_vt:
            db.query(VodTranscript).filter(VodTranscript.is_processing == True).update({
                'status': 'queued',
                'stage': 'queued',
                'progress_pct': 0,
                'started_at': None,
                'error_message': '',
            })
            db.commit()
            logger.info(f"Re-queued {stuck_vt} stuck VodTranscript row(s)")
    finally:
        db.close()

    # Start scheduler
    sched = BackgroundScheduler()
    sched.add_job(check_notices_job, 'interval', minutes=5, args=[SessionLocal])
    sched.add_job(sync_dashboard_job, 'interval', minutes=60, args=[SessionLocal])
    sched.add_job(check_session_health_job, 'interval', minutes=30, args=[SessionLocal])
    sched.start()
    logger.info("Scheduler started (notices every 5min, sync every 60min, session health every 30min)")

    logger.info("Polling for jobs...")
    while not _shutdown:
        db = SessionLocal()
        try:
            job = _claim_job(db)
            if job:
                logger.info(f"Starting job {job.id} ({job.type})")
                try:
                    _dispatch(job, db)
                    job.status = 'done'
                    job.completed_at = datetime.now()
                    db.commit()
                    logger.info(f"Job {job.id} done")
                except Exception as e:
                    job.status = 'failed'
                    job.error = str(e)[:2000]
                    job.completed_at = datetime.now()
                    db.commit()
                    logger.error(f"Job {job.id} failed: {e}")
            else:
                time.sleep(5)
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            time.sleep(5)
        finally:
            db.close()

    logger.info("Shutting down scheduler...")
    sched.shutdown(wait=False)
    logger.info("Worker exited cleanly")


if __name__ == '__main__':
    main()
