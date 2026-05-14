"""
APScheduler-based scheduler that evaluates all published rules every N minutes.
"""

import logging
import os
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler

import evaluator as eval_module
import payload_builder
import sender
from db.rules_db import get_published_rules, log_notification, update_last_run
from models.rule import Rule

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()


def start_scheduler():
    interval = int(os.environ.get("SCHEDULER_INTERVAL_MINUTES", "15"))
    _scheduler.add_job(run_all_rules, "interval", minutes=interval, id="rule_evaluator")
    _scheduler.start()
    logger.info("scheduler started — interval=%d min", interval)


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


async def run_all_rules():
    logger.info("scheduler tick: evaluating published rules")
    try:
        rule_dicts = await get_published_rules()
    except Exception as exc:
        logger.error("failed to fetch published rules: %s", exc)
        return

    for rd in rule_dicts:
        try:
            rule = _dict_to_rule(rd)
            await _process_rule(rule)
        except Exception as exc:
            logger.error("rule %s processing error: %s", rd.get("id"), exc)


async def _process_rule(rule: Rule):
    rule_id = UUID(str(rule.id))
    sent_count = 0
    fail_count = 0

    async for user_id, channel_content in eval_module.evaluate(rule):
        try:
            payload = await payload_builder.build(rule, user_id, channel_content)
            success, error = await sender.send(payload)
            if success:
                await log_notification(rule_id, user_id, channel_content.channel, "sent")
                sent_count += 1
            else:
                await log_notification(rule_id, user_id, channel_content.channel, "failed", error)
                fail_count += 1
        except Exception as exc:
            logger.error("rule %s user %s channel %s: %s", rule.id, user_id, channel_content.channel, exc)
            try:
                await log_notification(rule_id, user_id, channel_content.channel, "failed", str(exc))
            except Exception:
                pass
            fail_count += 1

    await update_last_run(rule_id)
    logger.info("rule %s (%s): sent=%d failed=%d", rule.id, rule.name, sent_count, fail_count)


def _dict_to_rule(d: dict) -> Rule:
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    return Rule(
        id=d["id"],
        name=d["name"],
        status=d.get("status", "published"),
        trigger_type=d.get("trigger_type", "standard"),
        trigger_event=d.get("trigger_event"),
        trigger_query=d.get("trigger_query"),
        conditions=d.get("conditions", []),
        delay_days=d.get("delay_days", 0),
        channels=d.get("channels", []),
        is_repeatable=d.get("is_repeatable", False),
        created_at=d.get("created_at", now),
        updated_at=d.get("updated_at", now),
        last_run_at=d.get("last_run_at"),
    )
