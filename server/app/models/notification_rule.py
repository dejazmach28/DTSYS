import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class NotificationRule(Base):
    __tablename__ = "notification_rules"
    __table_args__ = (Index("ix_notification_rules_org_id", "org_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, default="*")
    severity_min: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    channel: Mapped[str] = mapped_column(String(20), nullable=False)  # browser|webhook|email
    webhook_url: Mapped[str | None] = mapped_column(String(500))
    email_address: Mapped[str | None] = mapped_column(String(255))
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
