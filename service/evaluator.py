"""
Rule evaluation — Mixpanel is the user data source.

Steps per rule:
1. Trigger  → JQL query → candidate user_ids
2. Conditions → per-user Mixpanel property check
3. Dedup    → skip already-notified (unless repeatable)
4. Delay gate → honour delay_days
5. Yield (user_id, channel_content)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator
from uuid import UUID

import app_env
import mixpanel_client
from db.rules_db import already_notified
from models.rule import ChannelContent, Condition, Rule

logger = logging.getLogger(__name__)

# TRIGGER_EVENTS is the canonical list — kept here for reference and for
# the test_query helper.
TRIGGER_EVENTS = [
    "user_signed_up",
    "first_session_started",
    "onboarding_completed",
    "library_viewed",
    "start_learning_clicked",
    "content_added",
    "add_content_viewed",
    "user_inactive",
]


async def evaluate(rule: Rule) -> AsyncIterator[tuple[str, ChannelContent]]:
    """Yield (user_id, channel_content) pairs ready to send."""
    rule_id = UUID(str(rule.id))
    env = app_env.get_env()

    # 1. Trigger
    if rule.trigger_type == "advanced" and rule.trigger_query:
        try:
            candidate_ids = await mixpanel_client.run_jql_trigger(rule.trigger_query, env)
        except Exception as exc:
            logger.error("rule %s: JQL trigger failed: %s", rule.id, exc)
            return
    else:
        event_key = rule.trigger_event or ""
        try:
            candidate_ids = await mixpanel_client.get_trigger_users(event_key, env)
        except Exception as exc:
            logger.error("rule %s: trigger '%s' failed: %s", rule.id, event_key, exc)
            return

    logger.info("rule %s: %d candidates  env=%s", rule.id, len(candidate_ids), env)

    # 2. Standard conditions
    if rule.conditions:
        filtered: list[str] = []
        for uid in candidate_ids:
            if await _passes_conditions(uid, rule.conditions, env):
                filtered.append(uid)
    else:
        filtered = list(candidate_ids)

    # 3. Advanced condition (condition_query)
    if getattr(rule, "condition_query", None):
        filtered = await _apply_advanced_condition(filtered, rule.condition_query, env)

    logger.info("rule %s: %d after conditions", rule.id, len(filtered))

    # 4. Per-user, per-channel
    now = datetime.now(timezone.utc)

    for user_id in filtered:
        for ch in rule.channels:
            if not rule.is_repeatable:
                if await already_notified(rule_id, user_id, ch.channel):
                    continue

            if rule.delay_days > 0 and rule.last_run_at is None:
                continue

            yield user_id, ch


async def _passes_conditions(user_id: str, conditions: list[Condition], env: str) -> bool:
    for cond in conditions:
        val = await mixpanel_client.get_condition_value(user_id, cond.field, env)
        if val is None:
            continue
        try:
            if cond.operator in ("gt", "lt", "gte", "lte"):
                a, b = float(val or 0), float(cond.value)
                if cond.operator == "gt"  and not (a > b):  return False
                if cond.operator == "lt"  and not (a < b):  return False
                if cond.operator == "gte" and not (a >= b): return False
                if cond.operator == "lte" and not (a <= b): return False
            elif cond.operator == "eq"  and val.lower() != cond.value.lower():
                return False
            elif cond.operator == "neq" and val.lower() == cond.value.lower():
                return False
        except (ValueError, TypeError) as exc:
            logger.warning("condition eval user=%s field=%s: %s", user_id, cond.field, exc)
    return True


async def _apply_advanced_condition(
    candidate_ids: list[str], condition_query: str, env: str
) -> list[str]:
    """
    Advanced condition: if the query looks like a full JQL function, run it
    and intersect with candidate_ids.  Otherwise log a warning and pass through.
    """
    if not candidate_ids:
        return []
    if condition_query.strip().startswith("function"):
        try:
            jql_users = set(await mixpanel_client.run_jql_trigger(condition_query, env))
            return [uid for uid in candidate_ids if uid in jql_users]
        except Exception as exc:
            logger.error("advanced condition JQL failed: %s", exc)
            return candidate_ids
    logger.warning("condition_query is not JQL — skipping filter (pass-through)")
    return candidate_ids


# ── Test helpers (used by /test-query and /test-condition-query endpoints) ────

async def test_query(jql_script: str) -> dict:
    env = app_env.get_env()
    try:
        users = await mixpanel_client.run_jql_trigger(jql_script, env)
        return {"count": len(users), "error": None}
    except Exception as exc:
        return {"count": 0, "error": str(exc)}


async def test_condition_query(expression: str) -> dict:
    env = app_env.get_env()
    if expression.strip().startswith("function"):
        return await test_query(expression)
    return {
        "count": 0,
        "error": "Advanced conditions must be a JQL function main(){...} returning [{user_id},...]. "
                 "Standard row conditions are evaluated against Mixpanel user properties.",
    }
