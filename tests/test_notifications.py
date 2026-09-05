from unittest.mock import patch

from database import PushToken
import worker


def test_transcription_completion_pushes_to_every_registered_device(db, test_user):
    tokens = ["ExponentPushToken[device-a]", "ExponentPushToken[device-b]"]
    db.add_all([
        PushToken(user_id=test_user.id, token=token)
        for token in tokens
    ])
    test_user.push_token = tokens[-1]
    db.commit()

    with (
        patch("scheduler.PushMessage", side_effect=lambda **kwargs: kwargs),
        patch("scheduler.PushClient") as push_client,
    ):
        worker._send_transcription_complete_push(
            test_user,
            db,
            job_id=17,
            vod_moodle_id=1234,
            vod_title="Lecture",
            course_name="Course",
        )

    messages = [call.args[0] for call in push_client.return_value.publish.call_args_list]
    assert [message["to"] for message in messages] == tokens
    assert all(message["data"]["type"] == "transcription_complete" for message in messages)
