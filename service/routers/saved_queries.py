from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.rules_db import create_saved_query, delete_saved_query, list_saved_queries

router = APIRouter(prefix="/saved-queries", tags=["saved-queries"])


class SavedQueryCreate(BaseModel):
    name: str
    type: str  # "trigger" | "condition"
    sql: str


@router.get("")
async def get_saved_queries(type: Optional[str] = Query(None)):
    return await list_saved_queries(type)


@router.post("", status_code=201)
async def create_query(body: SavedQueryCreate):
    if body.type not in ("trigger", "condition"):
        raise HTTPException(status_code=422, detail="type must be 'trigger' or 'condition'")
    return await create_saved_query(body.name, body.type, body.sql)


@router.delete("/{query_id}", status_code=204)
async def delete_query(query_id: UUID):
    deleted = await delete_saved_query(query_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved query not found")
