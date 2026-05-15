"""
Sends a NotificationPayload to Ella's backend endpoint.
Never throws — all exceptions are caught and returned as (success, error).
"""

import logging
import os

import httpx

import app_env
import mixpanel_client
from models.payload import NotificationPayload

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        backend_url = os.environ.get("BACKEND_API_URL", "http://localhost:9000")
        _client = httpx.AsyncClient(
            base_url=backend_url,
            timeout=httpx.Timeout(10.0),
        )
    return _client


async def send(payload: NotificationPayload) -> tuple[bool, str | None]:
    """
    POST the payload to Ella's backend.
    Returns (True, None) on success, (False, error_message) on failure.
    """
    try:
        client = get_client()
        response = await client.post(
            "/api/v1/notifications/send",
            json=payload.model_dump(mode="json"),
        )
        if response.status_code == 200:
            logger.info(
                "sent  rule=%s  learner=%s  channel=%s",
                payload.rule_id, payload.learner_id, payload.channel,
            )
            env = app_env.get_env()
            await mixpanel_client.track_notification(
                user_id=payload.learner_id,
                rule_name=payload.metadata.rule_name,
                rule_id=payload.rule_id,
                channel=payload.channel,
                env=env,
            )
            return True, None
        else:
            msg = f"HTTP {response.status_code}: {response.text[:200]}"
            logger.warning(
                "send failed  rule=%s  learner=%s  channel=%s  error=%s",
                payload.rule_id, payload.learner_id, payload.channel, msg,
            )
            return False, msg
    except Exception as exc:
        msg = str(exc)
        logger.error(
            "send exception  rule=%s  learner=%s  channel=%s  error=%s",
            payload.rule_id, payload.learner_id, payload.channel, msg,
        )
        return False, msg


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None
