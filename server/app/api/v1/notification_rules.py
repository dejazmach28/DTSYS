import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import get_current_org_id, require_admin
from app.models.notification_rule import NotificationRule
from app.models.user import User

router = APIRouter(prefix="/notification-rules", tags=["notification-rules"])


class NotificationRuleRequest(BaseModel):
    alert_type: str = "*"
    severity_min: str = "info"
    channel: str
    webhook_url: str | None = None
    email_address: EmailStr | None = None
    is_enabled: bool = True

    @model_validator(mode="after")
    def validate_target(self):
        if self.channel == "webhook" and not self.webhook_url:
            raise ValueError("webhook_url is required for webhook notification rules")
        if self.channel == "email" and not self.email_address:
            raise ValueError("email_address is required for email notification rules")
        return self


class NotificationRuleUpdateRequest(BaseModel):
    alert_type: str | None = None
    severity_min: str | None = None
    channel: str | None = None
    webhook_url: str | None = None
    email_address: EmailStr | None = None
    is_enabled: bool | None = None


@router.get("")
async def list_notification_rules(
    current_user: Annotated[User, Depends(require_admin)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(NotificationRule)
        .where(NotificationRule.org_id == current_org_id)
        .order_by(NotificationRule.created_at.desc())
    )
    return [_fmt_rule(rule) for rule in result.scalars().all()]


@router.post("")
async def create_notification_rule(
    body: NotificationRuleRequest,
    current_user: Annotated[User, Depends(require_admin)],
    current_org_id: Annotated[uuid.UUID, Depends(get_current_org_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = NotificationRule(org_id=current_org_id, **body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _fmt_rule(rule)


@router.patch("/{rule_id}")
async def update_notification_rule(
    rule_id: uuid.UUID,
    body: NotificationRuleUpdateRequest,
    current_user: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rule = await db.get(NotificationRule, rule_id)
    if rule is None:
        return {"detail": "Notification rule not found"}

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return _fmt_rule(rule)


def _fmt_rule(rule: NotificationRule) -> dict:
    return {
        "id": str(rule.id),
        "alert_type": rule.alert_type,
        "severity_min": rule.severity_min,
        "channel": rule.channel,
        "webhook_url": rule.webhook_url,
        "email_address": rule.email_address,
        "is_enabled": rule.is_enabled,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }
