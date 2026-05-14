"""
Notification log API — query history with filters.
"""

import os
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query

from db.rules_db import get_rules_pool

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def get_logs(
    rule_id: Optional[UUID] = Query(None),
    channel: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    learner_id: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    pool = await get_rules_pool()

    where_clauses = []
    params: list = []
    i = 1

    if rule_id:
        where_clauses.append(f"nl.rule_id = ${i}::uuid")
        params.append(rule_id)
        i += 1
    if channel:
        where_clauses.append(f"nl.channel = ${i}")
        params.append(channel)
        i += 1
    if status:
        where_clauses.append(f"nl.status = ${i}")
        params.append(status)
        i += 1
    if learner_id:
        where_clauses.append(f"nl.learner_id = ${i}")
        params.append(learner_id)
        i += 1
    if date_from:
        where_clauses.append(f"nl.sent_at >= ${i}")
        params.append(date_from)
        i += 1
    if date_to:
        where_clauses.append(f"nl.sent_at <= ${i}")
        params.append(date_to)
        i += 1

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    rows = await pool.fetch(
        f"""
        SELECT
            nl.id,
            nl.rule_id,
            r.name AS rule_name,
            nl.learner_id,
            nl.channel,
            nl.status,
            nl.error_message,
            nl.sent_at
        FROM notification_log nl
        LEFT JOIN rules r ON r.id = nl.rule_id
        {where_sql}
        ORDER BY nl.sent_at DESC
        LIMIT ${i} OFFSET ${i+1}
        """,
        *params, limit, offset,
    )

    count_row = await pool.fetchrow(
        f"SELECT COUNT(*) FROM notification_log nl {where_sql}",
        *params,
    )

    return {
        "total": count_row["count"],
        "offset": offset,
        "limit": limit,
        "items": [dict(r) for r in rows],
    }


@router.get("/summary")
async def get_summary():
    """Counts for the dashboard — sent today, total sent, total failed."""
    pool = await get_rules_pool()
    row = await pool.fetchrow(
        """
        SELECT
            COUNT(*) FILTER (WHERE status = 'sent')                              AS total_sent,
            COUNT(*) FILTER (WHERE status = 'failed')                            AS total_failed,
            COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= NOW() - INTERVAL '24 hours') AS sent_today,
            COUNT(*) FILTER (WHERE status = 'failed' AND sent_at >= NOW() - INTERVAL '24 hours') AS failed_today
        FROM notification_log
        """
    )
    return dict(row)
