from datetime import datetime
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class Condition(BaseModel):
    field: str
    operator: Literal["eq", "neq", "gt", "lt", "gte", "lte"]
    value: str


class ChannelContent(BaseModel):
    channel: Literal["in_app", "push", "email"]
    title: str
    body: str
    subject: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None


class RuleBase(BaseModel):
    name: str
    status: Literal["draft", "published", "paused"] = "draft"
    trigger_type: Literal["standard", "advanced"] = "standard"
    trigger_event: Optional[str] = None
    trigger_query: Optional[str] = None
    condition_type: Literal["standard", "advanced"] = "standard"
    condition_query: Optional[str] = None
    conditions: list[Condition] = Field(default_factory=list)
    delay_days: int = 0
    channels: list[ChannelContent] = Field(default_factory=list)
    is_repeatable: bool = False


class RuleCreate(RuleBase):
    pass


class RuleUpdate(RuleBase):
    pass


class Rule(RuleBase):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime
    updated_at: datetime
    last_run_at: Optional[datetime] = None

    class Config:
        from_attributes = True
