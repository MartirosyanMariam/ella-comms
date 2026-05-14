"""
CRUD API for rules + query test endpoint.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import evaluator
import simulator
from db.rules_db import (
    create_rule,
    delete_rule,
    get_rule,
    list_rules,
    update_rule,
)
from models.rule import RuleCreate, RuleUpdate

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("")
async def get_rules():
    return await list_rules()


@router.get("/{rule_id}")
async def get_rule_by_id(rule_id: UUID):
    rule = await get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.post("", status_code=201)
async def create_new_rule(body: RuleCreate):
    return await create_rule(body.model_dump())


@router.put("/{rule_id}")
async def update_existing_rule(rule_id: UUID, body: RuleUpdate):
    rule = await update_rule(rule_id, body.model_dump())
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.delete("/{rule_id}", status_code=204)
async def delete_existing_rule(rule_id: UUID):
    deleted = await delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")


class TestQueryRequest(BaseModel):
    sql: str


@router.post("/test-query")
async def test_query(body: TestQueryRequest):
    result = await evaluator.test_query(body.sql)
    return result


@router.post("/test-condition-query")
async def test_condition_query(body: TestQueryRequest):
    result = await evaluator.test_condition_query(body.sql)
    return result


@router.post("/{rule_id}/simulate")
async def simulate_rule(rule_id: UUID):
    """Dry-run a rule: evaluate trigger + conditions + build payloads without sending."""
    result = await simulator.simulate(rule_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
