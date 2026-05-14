"""
Builds the canonical NotificationPayload for a given user + channel.
Variable resolution errors default to empty string — never crashes the payload.
"""

import logging
from datetime import datetime, timedelta, timezone

from db.ella_db import ella_readonly_conn
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

    vars_resolved = await _resolve_variables(user_id)

    rendered_title = _render(channel.title, vars_resolved)
    rendered_body = _render(channel.body, vars_resolved)
    rendered_subject = _render(channel.subject, vars_resolved) if channel.subject else None
    rendered_cta_label = _render(channel.cta_label, vars_resolved) if channel.cta_label else None
    rendered_cta_url = _render(channel.cta_url, vars_resolved) if channel.cta_url else None

    return NotificationPayload(
        rule_id=str(rule.id),
        learner_id=user_id,
        channel=channel.channel,
        triggered_at=now,
        scheduled_for=scheduled_for,
        content=NotificationContent(
            title=rendered_title,
            body=rendered_body,
            subject=rendered_subject,
            cta_label=rendered_cta_label,
            cta_url=rendered_cta_url,
        ),
        metadata=NotificationMetadata(
            rule_name=rule.name,
            trigger_event=rule.trigger_event or rule.trigger_type,
            variables_resolved=vars_resolved,
        ),
    )


async def _resolve_variables(user_id: str) -> VariablesResolved:
    """Query Ella DB for user data. Any field that fails resolves to ""."""
    vars_dict: dict = {
        "user_name": "",
        "language": "",
        "native_language": "",
        "days_inactive": "",
        "content_count": "",
        "content_title": None,
    }

    try:
        async with ella_readonly_conn() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    first_name,
                    target_language,
                    native_language,
                    COALESCE(
                        DATE_PART('day', NOW() - last_seen_at)::int::text,
                        '0'
                    ) AS days_inactive,
                    (SELECT COUNT(*)::text FROM user_content uc WHERE uc.user_id = u.id) AS content_count,
                    (SELECT title FROM user_content uc WHERE uc.user_id = u.id ORDER BY added_at DESC LIMIT 1) AS content_title
                FROM users u
                WHERE u.id = $1::uuid
                """,
                user_id,
            )
            if row:
                vars_dict["user_name"] = row["first_name"] or ""
                vars_dict["language"] = row["target_language"] or ""
                vars_dict["native_language"] = row["native_language"] or ""
                vars_dict["days_inactive"] = row["days_inactive"] or "0"
                vars_dict["content_count"] = row["content_count"] or "0"
                vars_dict["content_title"] = row["content_title"]
    except Exception as exc:
        logger.error("variable resolution failed for user %s: %s", user_id, exc)

    return VariablesResolved(**vars_dict)


def _render(template: str | None, vars_resolved: VariablesResolved) -> str:
    if not template:
        return ""
    mapping = {
        "{{user_name}}": vars_resolved.user_name,
        "{{language}}": vars_resolved.language,
        "{{native_language}}": vars_resolved.native_language,
        "{{days_inactive}}": vars_resolved.days_inactive,
        "{{content_count}}": vars_resolved.content_count,
        "{{content_title}}": vars_resolved.content_title or "",
    }
    result = template
    for placeholder, value in mapping.items():
        result = result.replace(placeholder, value)
    return result
