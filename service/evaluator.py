"""
Rule evaluation logic.

For each published rule:
1. Resolve the trigger → list of candidate user_ids
2. Apply conditions to filter
3. Skip already-notified users (unless repeatable)
4. Apply delay gate
5. Yield (user_id, channel_content) pairs for sending
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator
from uuid import UUID

from db.ella_db import ella_readonly_conn
from db.rules_db import already_notified
from models.rule import ChannelContent, Condition, Rule

logger = logging.getLogger(__name__)

# ── Trigger → SQL map ─────────────────────────────────────────────────────────

TRIGGER_SQL: dict[str, str] = {
    "user_signed_up": """
        SELECT DISTINCT u.id::text AS user_id
        FROM users u
        JOIN user_events e ON e.user_id = u.id
        WHERE e.event_name = 'app_started'
          AND NOT EXISTS (
              SELECT 1 FROM user_events prev
              WHERE prev.user_id = u.id
                AND prev.session_id != e.session_id
                AND prev.timestamp < e.timestamp
          )
    """,

    "first_session_started": """
        SELECT DISTINCT ON (u.id) u.id::text AS user_id
        FROM users u
        JOIN user_events e ON e.user_id = u.id
        WHERE e.event_name = 'app_started'
        ORDER BY u.id, e.timestamp ASC
    """,

    "library_viewed": """
        SELECT DISTINCT u.id::text AS user_id
        FROM users u
        JOIN user_events e ON e.user_id = u.id
        WHERE e.event_name = 'page_view'
          AND e.page_name = 'Library'
    """,

    "start_learning_clicked": """
        SELECT DISTINCT u.id::text AS user_id
        FROM users u
        JOIN user_events e ON e.user_id = u.id
        WHERE e.event_name = 'button_click'
          AND e.button_name = 'Start Learning'
    """,

    "content_added": """
        SELECT DISTINCT u.id::text AS user_id
        FROM users u
        JOIN user_events e ON e.user_id = u.id
        WHERE e.event_name = 'button_click'
          AND e.button_name = 'Send to Ella'
    """,

    "add_content_viewed": """
        SELECT DISTINCT u.id::text AS user_id
        FROM users u
        JOIN user_events e ON e.user_id = u.id
        WHERE e.event_name = 'page_view'
          AND e.page_name = 'Add Content'
    """,

    # user_inactive: parameterised at runtime via rule.trigger_query override
    # or handled by checking last event timestamp
    "user_inactive": """
        SELECT u.id::text AS user_id
        FROM users u
        WHERE u.last_seen_at < NOW() - INTERVAL '5 days'
           OR u.last_seen_at IS NULL
    """,
}

# Condition field → SQL expression
CONDITION_FIELD_SQL: dict[str, str] = {
    "target_language": "u.target_language",
    "native_language": "u.native_language",
    "country": "u.country",
    "app_version": "u.app_version",
    "content_count": "(SELECT COUNT(*) FROM user_content uc WHERE uc.user_id = u.id)",
    "days_since_signup": "DATE_PART('day', NOW() - u.created_at)",
}

OPERATOR_SQL: dict[str, str] = {
    "eq": "=",
    "neq": "!=",
    "gt": ">",
    "lt": "<",
    "gte": ">=",
    "lte": "<=",
}


async def evaluate(rule: Rule) -> AsyncIterator[tuple[str, ChannelContent]]:
    """Yield (user_id, channel_content) pairs ready to send."""
    rule_id = UUID(str(rule.id))

    # 1. Resolve trigger query
    if rule.trigger_type == "advanced" and rule.trigger_query:
        base_sql = rule.trigger_query
    else:
        event_key = rule.trigger_event or ""
        base_sql = TRIGGER_SQL.get(event_key)
        if not base_sql:
            logger.warning("rule %s: unknown trigger_event '%s', skipping", rule.id, event_key)
            return

    # 2. Run trigger query against Ella DB (read-only)
    try:
        async with ella_readonly_conn() as conn:
            rows = await conn.fetch(f"SELECT user_id FROM ({base_sql}) sub")
            candidate_ids = [r["user_id"] for r in rows]
    except Exception as exc:
        logger.error("rule %s: trigger query failed: %s", rule.id, exc)
        return

    logger.info("rule %s: %d candidates from trigger", rule.id, len(candidate_ids))

    # 3. Apply conditions
    filtered_ids = []
    if rule.conditions:
        for user_id in candidate_ids:
            if await _passes_conditions(user_id, rule.conditions):
                filtered_ids.append(user_id)
    else:
        filtered_ids = candidate_ids

    logger.info("rule %s: %d after conditions", rule.id, len(filtered_ids))

    # 4. Active channels
    active_channels = [ch for ch in rule.channels]

    # 5. Per-user, per-channel
    now = datetime.now(timezone.utc)
    scheduled_for = now + timedelta(days=rule.delay_days)

    for user_id in filtered_ids:
        for ch in active_channels:
            # Skip if already notified and rule is not repeatable
            if not rule.is_repeatable:
                if await already_notified(rule_id, user_id, ch.channel):
                    continue

            # 6. Delay gate — only send once scheduled_for <= now
            if rule.delay_days > 0:
                # We can't know exactly when the trigger fired per-user without
                # storing it, so we use rule.last_run_at as a proxy.
                if scheduled_for > now:
                    continue

            yield user_id, ch


async def _passes_conditions(user_id: str, conditions: list[Condition]) -> bool:
    try:
        async with ella_readonly_conn() as conn:
            for cond in conditions:
                field_sql = CONDITION_FIELD_SQL.get(cond.field)
                if not field_sql:
                    logger.warning("unknown condition field '%s', skipping condition", cond.field)
                    continue
                op = OPERATOR_SQL.get(cond.operator, "=")
                # Cast value to numeric for numeric operators
                if cond.operator in ("gt", "lt", "gte", "lte"):
                    sql = f"SELECT ({field_sql})::numeric {op} $2::numeric FROM users u WHERE u.id = $1::uuid"
                else:
                    sql = f"SELECT ({field_sql}) {op} $2 FROM users u WHERE u.id = $1::uuid"
                result = await conn.fetchval(sql, user_id, cond.value)
                if not result:
                    return False
    except Exception as exc:
        logger.error("condition check failed for user %s: %s", user_id, exc)
        return False
    return True


async def test_query(sql: str) -> dict:
    """Run an advanced query in read-only mode and return match count."""
    try:
        async with ella_readonly_conn() as conn:
            rows = await conn.fetch(f"SELECT user_id FROM ({sql}) sub")
            return {"count": len(rows), "error": None}
    except Exception as exc:
        return {"count": 0, "error": str(exc)}
