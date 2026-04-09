from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.device import Device


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    issued_by: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    command_type: Mapped[str] = mapped_column(String(50), nullable=False)  # shell|script|update_check|reboot
    payload: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|sent|running|completed|failed|timeout
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    exit_code: Mapped[int | None] = mapped_column(Integer)
    output: Mapped[str | None] = mapped_column(Text)

    device: Mapped[Device] = relationship(back_populates="commands")
