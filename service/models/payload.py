from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationContent(BaseModel):
    title: str
    body: str
    subject: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None


class VariablesResolved(BaseModel):
    user_name: str = ""
    language: str = ""
    native_language: str = ""
    days_inactive: str = ""
    content_count: str = ""
    content_title: Optional[str] = None


class NotificationMetadata(BaseModel):
    rule_name: str
    trigger_event: str
    variables_resolved: VariablesResolved


class NotificationPayload(BaseModel):
    rule_id: str
    learner_id: str
    channel: Literal["in_app", "push", "email"]
    triggered_at: datetime
    scheduled_for: datetime
    content: NotificationContent
    metadata: NotificationMetadata
