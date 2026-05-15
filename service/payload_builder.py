"""
Builds the canonical NotificationPayload for a given user + channel.
Variables are resolved from Mixpanel.  Any field that fails defaults to "".
"""

import logging
from datetime import datetime, timedelta, timezone

import app_env
import mixpanel_client
from models.payload import (
    NotificationContent,
    NotificationMetadata,
    NotificationPayload,
    VariablesResolved,
)
from models.rule import ChannelContent, Rule

logger = logging.getLogger(__name__)


async def build(rule: Rule, user_id: str, channel: ChannelContent) -> NotificationPayload:
    now = datetime.now(timezone.utc)
    scheduled_for = now + timedelta(days=rule.delay_days)
    env = app_env.get_env()

    profile = await _resolve(user_id, env)

    return NotificationPayload(
        rule_id=str(rule.id),
        learner_id=user_id,
        channel=channel.channel,
        triggered_at=now,
        scheduled_for=scheduled_for,
        content=NotificationContent(
            title=_render(channel.title, profile),
            body=_render(channel.body, profile),
            subject=_render(channel.subject, profile) if channel.subject else None,
            cta_label=_render(channel.cta_label, profile) if channel.cta_label else None,
            cta_url=_render(channel.cta_url, profile) if channel.cta_url else None,
        ),
        metadata=NotificationMetadata(
            rule_name=rule.name,
            trigger_event=rule.trigger_event or rule.trigger_type,
            variables_resolved=VariablesResolved(
                user_name=profile.get("user_name", ""),
                language=profile.get("language", ""),
                native_language=profile.get("native_language", ""),
                days_inactive=profile.get("days_inactive", "0"),
                content_count=profile.get("content_count", "0"),
                content_title=profile.get("content_title"),
            ),
        ),
    )


async def _resolve(user_id: str, env: str) -> dict:
    try:
        return await mixpanel_client.get_user_profile(user_id, env)
    except Exception as exc:
        logger.error("variable resolution failed user=%s: %s", user_id, exc)
        return {
            "user_name": "", "language": "", "native_language": "",
            "days_inactive": "0", "content_count": "0", "content_title": None,
        }


def _render(template: str | None, profile: dict) -> str:
    if not template:
        return ""
    mapping = {
        "{{user_name}}":       profile.get("user_name") or "",
        "{{language}}":        profile.get("language") or "",
        "{{native_language}}": profile.get("native_language") or "",
        "{{days_inactive}}":   profile.get("days_inactive") or "0",
        "{{content_count}}":   profile.get("content_count") or "0",
        "{{content_title}}":   profile.get("content_title") or "",
    }
    result = template
    for k, v in mapping.items():
        result = result.replace(k, v)
    return result
