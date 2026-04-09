from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, DateTime, ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.device import Device


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # crash|error|warning|info
    source: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_data: Mapped[dict | None] = mapped_column(JSONB)

    device: Mapped[Device] = relationship(back_populates="events")
