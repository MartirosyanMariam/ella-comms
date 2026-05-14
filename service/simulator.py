"""
Dry-run simulator — evaluates a rule exactly like the scheduler does,
but never sends and never writes to notification_log.
Returns the resolved payloads so admins can verify logic before publishing.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

import evaluator as eval_module
import payload_builder
from db.rules_db import already_notified, get_rule
from models.rule import Rule

logger = logging.getLogger(__name__)

MAX_PREVIEW = 10  # max payloads returned in preview


async def simulate(rule_id: UUID) -> dict:
    rule_dict = await get_rule(rule_id)
    if not rule_dict:
        return {"error": "Rule not found"}

    rule = _dict_to_rule(rule_dict)

    matched_users: list[str] = []
    skipped_already_notified: list[str] = []
    would_send: list[dict] = []
    errors: list[str] = []

    try:
        all_candidates = await _get_all_candidates(rule)
        matched_users = list(set(all_candidates))

        for user_id in all_candidates:
            for ch in rule.channels:
                already = await already_notified(rule_id, user_id, ch.channel)
                if already and not rule.is_repeatable:
                    if user_id not in skipped_already_notified:
                        skipped_already_notified.append(user_id)
                    continue

                if len(would_send) < MAX_PREVIEW:
                    try:
                        payload = await payload_builder.build(rule, user_id, ch)
                        would_send.append({
                            "learner_id": user_id,
                            "learner_name": payload.metadata.variables_resolved.user_name or user_id[:8],
                            "channel": ch.channel,
                            "payload": payload.model_dump(mode="json"),
                        })
                    except Exception as e:
                        errors.append(f"user {user_id} / {ch.channel}: {e}")

    except Exception as e:
        errors.append(str(e))

    sendable = len(matched_users) - len(skipped_already_notified)

    return {
        "rule_id": str(rule_id),
        "rule_name": rule.name,
        "rule_status": rule.status,
        "total_would_send": max(sendable, 0) * len(rule.channels),
        "unique_users_matched": len(matched_users),
        "skipped_already_notified": len(skipped_already_notified),
        "preview": would_send,
        "preview_capped_at": MAX_PREVIEW,
        "errors": errors,
    }


async def _get_all_candidates(rule: Rule) -> list[str]:
    """Run trigger + conditions without dedup check."""
    from db.ella_db import ella_readonly_conn
    from evaluator import TRIGGER_SQL, _passes_conditions, _apply_advanced_condition

    if rule.trigger_type == "advanced" and rule.trigger_query:
        base_sql = rule.trigger_query
    else:
        event_key = rule.trigger_event or ""
        base_sql = TRIGGER_SQL.get(event_key, "SELECT NULL::text AS user_id WHERE false")

    try:
        async with ella_readonly_conn() as conn:
            rows = await conn.fetch(f"SELECT user_id FROM ({base_sql}) sub")
            candidate_ids = [r["user_id"] for r in rows]
    except Exception as exc:
        logger.error("simulate trigger query failed: %s", exc)
        return []

    if rule.conditions:
        filtered = []
        for uid in candidate_ids:
            if await _passes_conditions(uid, rule.conditions):
                filtered.append(uid)
        candidate_ids = filtered

    if getattr(rule, "condition_query", None):
        candidate_ids = await _apply_advanced_condition(candidate_ids, rule.condition_query)

    return candidate_ids


def _dict_to_rule(d: dict) -> Rule:
    now = datetime.now(timezone.utc)
    return Rule(
        id=d["id"],
        name=d["name"],
        status=d.get("status", "draft"),
        trigger_type=d.get("trigger_type", "standard"),
        trigger_event=d.get("trigger_event"),
        trigger_query=d.get("trigger_query"),
        condition_query=d.get("condition_query"),
        conditions=d.get("conditions", []),
        delay_days=d.get("delay_days", 0),
        channels=d.get("channels", []),
        is_repeatable=d.get("is_repeatable", False),
        created_at=d.get("created_at", now),
        updated_at=d.get("updated_at", now),
        last_run_at=d.get("last_run_at"),
    )
