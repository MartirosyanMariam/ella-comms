"""
Read-write connection to the rules database owned by this service.
Handles rule storage, notification log, and migrations on startup.
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import asyncpg

_pool: asyncpg.Pool | None = None

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'draft',
    rule_data   JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_run_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notification_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id       UUID NOT NULL,
    learner_id    TEXT NOT NULL,
    channel       TEXT NOT NULL,
    status        TEXT NOT NULL,
    error_message TEXT,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_rule_learner
    ON notification_log (rule_id, learner_id);
"""


async def get_rules_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.environ["RULES_DB_URL"],
            min_size=1,
            max_size=10,
            command_timeout=30,
        )
    return _pool


async def close_rules_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def run_migrations():
    pool = await get_rules_pool()
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)


# ── Rule CRUD ──────────────────────────────────────────────────────────────────

async def list_rules() -> list[dict]:
    pool = await get_rules_pool()
    rows = await pool.fetch(
        "SELECT id, name, status, rule_data, created_at, updated_at, last_run_at FROM rules ORDER BY created_at DESC"
    )
    return [_row_to_dict(r) for r in rows]


async def get_rule(rule_id: UUID) -> Optional[dict]:
    pool = await get_rules_pool()
    row = await pool.fetchrow(
        "SELECT id, name, status, rule_data, created_at, updated_at, last_run_at FROM rules WHERE id = $1",
        rule_id,
    )
    return _row_to_dict(row) if row else None


async def create_rule(data: dict) -> dict:
    pool = await get_rules_pool()
    rule_data = {k: v for k, v in data.items() if k not in ("name", "status")}
    row = await pool.fetchrow(
        """
        INSERT INTO rules (name, status, rule_data)
        VALUES ($1, $2, $3)
        RETURNING id, name, status, rule_data, created_at, updated_at, last_run_at
        """,
        data["name"],
        data.get("status", "draft"),
        json.dumps(rule_data),
    )
    return _row_to_dict(row)


async def update_rule(rule_id: UUID, data: dict) -> Optional[dict]:
    pool = await get_rules_pool()
    rule_data = {k: v for k, v in data.items() if k not in ("name", "status")}
    row = await pool.fetchrow(
        """
        UPDATE rules
        SET name = $2, status = $3, rule_data = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, status, rule_data, created_at, updated_at, last_run_at
        """,
        rule_id,
        data["name"],
        data.get("status", "draft"),
        json.dumps(rule_data),
    )
    return _row_to_dict(row) if row else None


async def delete_rule(rule_id: UUID) -> bool:
    pool = await get_rules_pool()
    result = await pool.execute("DELETE FROM rules WHERE id = $1", rule_id)
    return result == "DELETE 1"


async def update_last_run(rule_id: UUID):
    pool = await get_rules_pool()
    await pool.execute(
        "UPDATE rules SET last_run_at = NOW() WHERE id = $1", rule_id
    )


async def get_published_rules() -> list[dict]:
    pool = await get_rules_pool()
    rows = await pool.fetch(
        "SELECT id, name, status, rule_data, created_at, updated_at, last_run_at FROM rules WHERE status = 'published'"
    )
    return [_row_to_dict(r) for r in rows]


# ── Notification log ──────────────────────────────────────────────────────────

async def already_notified(rule_id: UUID, learner_id: str, channel: str) -> bool:
    pool = await get_rules_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM notification_log WHERE rule_id = $1 AND learner_id = $2 AND channel = $3 AND status = 'sent' LIMIT 1",
        rule_id, learner_id, channel,
    )
    return row is not None


async def log_notification(
    rule_id: UUID,
    learner_id: str,
    channel: str,
    status: str,
    error_message: Optional[str] = None,
):
    pool = await get_rules_pool()
    await pool.execute(
        """
        INSERT INTO notification_log (rule_id, learner_id, channel, status, error_message)
        VALUES ($1, $2, $3, $4, $5)
        """,
        rule_id, learner_id, channel, status, error_message,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row: Any) -> dict:
    d = dict(row)
    rule_data = json.loads(d.pop("rule_data", "{}"))
    d.update(rule_data)
    d["id"] = str(d["id"])
    return d
