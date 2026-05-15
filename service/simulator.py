"""
Dry-run simulator — evaluates a rule using Mixpanel data but never sends or logs.
Returns resolved payloads for admin preview.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

import app_env
import mixpanel_client
import payload_builder
from db.rules_db import already_notified, get_rule
from evaluator import _passes_conditions, _apply_advanced_condition
from models.rule import Rule

logger = logging.getLogger(__name__)

MAX_PREVIEW = 10


async def simulate(rule_id: UUID) -> dict:
    rule_dict = await get_rule(rule_id)
    if not rule_dict:
        return {"error": "Rule not found"}

    rule = _dict_to_rule(rule_dict)
    env = app_env.get_env()

    matched_users: list[str] = []
    skipped: list[str] = []
    would_send: list[dict] = []
    errors: list[str] = []

    try:
        all_candidates = await _get_candidates(rule, env)
        matched_users = list(set(all_candidates))

        for user_id in all_candidates:
            for ch in rule.channels:
                already = await already_notified(rule_id, user_id, ch.channel)
                if already and not rule.is_repeatable:
                    if user_id not in skipped:
                        skipped.append(user_id)
                    continue

                if len(would_send) < MAX_PREVIEW:
                    try:
                        payload = await payload_builder.build(rule, user_id, ch)
                        profile = await mixpanel_client.get_user_profile(user_id, env)
                        learner_name = (
                            profile.get("user_name")
                            or f"{user_id[:12]}…"
                        )
                        would_send.append({
                            "learner_id": user_id,
                            "learner_name": learner_name,
                            "channel": ch.channel,
                            "payload": payload.model_dump(mode="json"),
                        })
                    except Exception as exc:
                        errors.append(f"user {user_id} / {ch.channel}: {exc}")

    except Exception as exc:
        errors.append(str(exc))

    sendable = len(matched_users) - len(skipped)

    return {
        "rule_id": str(rule_id),
        "rule_name": rule.name,
        "rule_status": rule.status,
        "total_would_send": max(sendable, 0) * len(rule.channels),
        "unique_users_matched": len(matched_users),
        "skipped_already_notified": len(skipped),
        "preview": would_send,
        "preview_capped_at": MAX_PREVIEW,
        "errors": errors,
    }


async def _get_candidates(rule: Rule, env: str) -> list[str]:
    """Trigger + conditions, no dedup.  Raises on Mixpanel errors so simulate() surfaces them."""
    if rule.trigger_type == "advanced" and rule.trigger_query:
        candidate_ids = await mixpanel_client.run_jql_trigger(rule.trigger_query, env)
    else:
        event_key = rule.trigger_event or ""
        candidate_ids = await mixpanel_client.get_trigger_users(event_key, env)

    if rule.conditions:
        filtered = []
        for uid in candidate_ids:
            if await _passes_conditions(uid, rule.conditions, env):
                filtered.append(uid)
        candidate_ids = filtered

    if getattr(rule, "condition_query", None):
        candidate_ids = await _apply_advanced_condition(candidate_ids, rule.condition_query, env)

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
