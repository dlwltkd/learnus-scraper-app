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
import os
import threading
from concurrent.futures import ThreadPoolExecutor
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
MAX_JOB_CONCURRENCY = max(1, int(os.getenv("WORKER_MAX_CONCURRENCY", "4")))
TRANSCRIBE_TIMING_LOG_PATH = os.getenv("TRANSCRIBE_TIMING_LOG_PATH", "/app/error_log/transcribe_timing.jsonl")
TRANSCRIBE_TIMING_LOG_ENABLED = os.getenv("TRANSCRIBE_TIMING_LOG_ENABLED", "true").lower() in ("1", "true", "yes", "on")
_timing_log_lock = threading.Lock()

# ─── Graceful Shutdown ────────────────────────────────────────────────────────

_shutdown = False

def _handle_signal(sig, frame):
    global _shutdown
    logger.info("Shutdown signal received — finishing in-flight jobs before exit...")
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


def _append_transcribe_timing_log(row: dict):
    if not TRANSCRIBE_TIMING_LOG_ENABLED:
        return
    try:
        payload = dict(row)
        payload["logged_at"] = datetime.now().isoformat()
        log_dir = os.path.dirname(TRANSCRIBE_TIMING_LOG_PATH)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        line = json.dumps(payload, ensure_ascii=False)
        with _timing_log_lock:
            with open(TRANSCRIBE_TIMING_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(line + "\n")
    except Exception as e:
        logger.error(f"Failed to write transcribe timing log: {e}")

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
    return {"id": job.id, "type": job.type}

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


def _run_transcribe(payload: dict, db, *, job_id: int | None = None, queue_wait_s: float | None = None):
    vod_moodle_id = payload['vod_moodle_id']
    m3u8_url = payload['m3u8_url']
    cookies_raw = payload.get('cookies', '')
    user_id = payload.get('user_id')
    vod_title = payload.get('vod_title')
    course_name = payload.get('course_name')
    started_perf = time.perf_counter()
    last_stage = "queued"
    stage_started_perf: float | None = None
    stage_durations_s: dict[str, float] = {}
    queue_wait_text = f"{queue_wait_s:.1f}s" if queue_wait_s is not None else "n/a"
    logger.info(
        f"Transcribe start job_id={job_id} vod={vod_moodle_id} user_id={user_id} "
        f"queue_wait={queue_wait_text}"
    )

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
        last_stage = "extracting_audio"
        stage_started_perf = time.perf_counter()
        logger.info(f"Transcribe stage start job_id={job_id} vod={vod_moodle_id} stage={last_stage}")

        client = MoodleClient("https://ys.learnus.org")
        if isinstance(cookies_raw, dict):
            client.set_cookies(cookies_raw)
        elif cookies_raw and cookies_raw.startswith('{'):
            client.set_cookies(json.loads(cookies_raw))
        elif cookies_raw:
            client.set_cookies(_parse_cookie_string(cookies_raw))

        progress_log_buckets: dict[str, int] = {}

        def _on_stage(stage_name: str):
            nonlocal last_stage, stage_started_perf
            if stage_name == last_stage:
                return
            now_perf = time.perf_counter()
            if stage_started_perf is not None:
                stage_durations_s[last_stage] = round(now_perf - stage_started_perf, 3)
            logger.info(
                f"Transcribe stage done job_id={job_id} vod={vod_moodle_id} "
                f"stage={last_stage} duration_s={now_perf - stage_started_perf:.1f}"
            )
            last_stage = stage_name
            stage_started_perf = now_perf
            logger.info(f"Transcribe stage start job_id={job_id} vod={vod_moodle_id} stage={stage_name}")
            _set_transcript_status(
                db,
                vod_moodle_id,
                status='running',
                stage=stage_name,
                is_processing=True,
                progress_pct=_to_overall_progress(stage_name, 0),
            )

        def _on_progress(stage_name: str, stage_pct: int | None, msg: str | None):
            overall_pct = _to_overall_progress(stage_name, stage_pct)
            _set_transcript_status(
                db,
                vod_moodle_id,
                status='running',
                stage=stage_name,
                is_processing=True,
                progress_pct=overall_pct,
            )
            if stage_pct is None:
                return
            bucket = max(0, min(100, int(stage_pct) // 10 * 10))
            last_bucket = progress_log_buckets.get(stage_name, -10)
            if bucket != last_bucket and (bucket >= last_bucket + 10 or bucket in (0, 100)):
                progress_log_buckets[stage_name] = bucket
                detail = f" detail={msg}" if msg else ""
                logger.info(
                    f"Transcribe progress job_id={job_id} vod={vod_moodle_id} stage={stage_name} "
                    f"stage_pct={bucket}% overall_pct={overall_pct}%{detail}"
                )

        transcript, usage = AIService().transcribe_vod(
            m3u8_url,
            on_stage=_on_stage,
            on_progress=_on_progress,
        )
        if stage_started_perf is not None:
            stage_durations_s[last_stage] = round(time.perf_counter() - stage_started_perf, 3)

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
        total_s = time.perf_counter() - started_perf
        logger.info(
            f"Transcribe complete job_id={job_id} vod={vod_moodle_id} "
            f"chars={len(transcript or '')} total_s={total_s:.1f}"
        )
        _append_transcribe_timing_log({
            "type": "transcribe_timing",
            "status": "done",
            "job_id": job_id,
            "vod_moodle_id": vod_moodle_id,
            "user_id": user_id,
            "queue_wait_s": round(queue_wait_s, 3) if queue_wait_s is not None else None,
            "total_s": round(total_s, 3),
            "stage_durations_s": stage_durations_s,
            "transcript_chars": len(transcript or ""),
        })

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
            logger.info(
                f"Transcribe usage logged job_id={job_id} vod={vod_moodle_id} "
                f"model={usage.get('model', 'whisper-1')}"
            )
        except Exception:
            logger.warning(f"Transcribe usage log failed job_id={job_id} vod={vod_moodle_id}")
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
                    logger.info(f"Transcribe push sent job_id={job_id} vod={vod_moodle_id} user_id={user_id}")
                except Exception as exc:
                    logger.error(f"Transcribe push failed job_id={job_id} vod={vod_moodle_id}: {exc}")

    except Exception as e:
        if stage_started_perf is not None:
            stage_durations_s[last_stage] = round(time.perf_counter() - stage_started_perf, 3)
        total_s = time.perf_counter() - started_perf
        logger.exception(
            f"Transcribe failed job_id={job_id} vod={vod_moodle_id} "
            f"stage={last_stage} elapsed_s={total_s:.1f}: {e}"
        )
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
        _append_transcribe_timing_log({
            "type": "transcribe_timing",
            "status": "failed",
            "job_id": job_id,
            "vod_moodle_id": vod_moodle_id,
            "user_id": user_id,
            "queue_wait_s": round(queue_wait_s, 3) if queue_wait_s is not None else None,
            "total_s": round(total_s, 3),
            "stage_durations_s": stage_durations_s,
            "error": str(e)[:500],
        })
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


def _dispatch(job, db, *, queue_wait_s: float | None = None):
    t = job.type
    if t == 'transcribe':
        _run_transcribe(job.payload, db, job_id=job.id, queue_wait_s=queue_wait_s)
    elif t == 'watch_all':
        _run_watch_all(job.payload)
    elif t == 'watch_one':
        _run_watch_one(job.payload)
    else:
        raise ValueError(f"Unknown job type: {t}")


def _process_job(job_id: int):
    """Process a claimed job in its own DB session (safe for threaded concurrency)."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.warning(f"Claimed job {job_id} not found")
            return
        queue_wait_s = None
        if job.created_at and job.started_at:
            queue_wait_s = (job.started_at - job.created_at).total_seconds()
        logger.info(
            f"Starting job {job.id} ({job.type}) queue_wait_s="
            f"{queue_wait_s:.1f}" if queue_wait_s is not None else f"Starting job {job.id} ({job.type})"
        )
        run_started = time.perf_counter()
        try:
            _dispatch(job, db, queue_wait_s=queue_wait_s)
            job.status = 'done'
            job.completed_at = datetime.now()
            db.commit()
            logger.info(f"Job {job.id} done runtime_s={time.perf_counter() - run_started:.1f}")
        except Exception as e:
            job.status = 'failed'
            job.error = str(e)[:2000]
            job.completed_at = datetime.now()
            db.commit()
            logger.exception(f"Job {job.id} failed runtime_s={time.perf_counter() - run_started:.1f}: {e}")
    finally:
        db.close()

# ─── Main Loop ────────────────────────────────────────────────────────────────

def main():
    logger.info("Worker starting...")
    if TRANSCRIBE_TIMING_LOG_ENABLED:
        logger.info(f"Transcribe timing log enabled path={TRANSCRIBE_TIMING_LOG_PATH}")
    else:
        logger.info("Transcribe timing log disabled")

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

    logger.info(f"Polling for jobs (max concurrency={MAX_JOB_CONCURRENCY})...")
    inflight = {}
    with ThreadPoolExecutor(max_workers=MAX_JOB_CONCURRENCY) as pool:
        while not _shutdown or inflight:
            # Reap completed jobs first.
            done_futures = [f for f in inflight if f.done()]
            for fut in done_futures:
                job_meta = inflight.pop(fut)
                try:
                    fut.result()
                except Exception as e:
                    logger.error(f"Unhandled worker thread exception for job {job_meta['id']}: {e}")

            if _shutdown:
                time.sleep(0.2)
                continue

            claimed_any = False
            # Fill available worker slots.
            while len(inflight) < MAX_JOB_CONCURRENCY and not _shutdown:
                db = SessionLocal()
                try:
                    job = _claim_job(db)
                except Exception as e:
                    logger.error(f"Worker loop error while claiming job: {e}")
                    job = None
                finally:
                    db.close()

                if not job:
                    break
                claimed_any = True
                fut = pool.submit(_process_job, job["id"])
                inflight[fut] = job

            if not claimed_any and not done_futures:
                time.sleep(1)

    logger.info("Shutting down scheduler...")
    sched.shutdown(wait=False)
    logger.info("Worker exited cleanly")


if __name__ == '__main__':
    main()
