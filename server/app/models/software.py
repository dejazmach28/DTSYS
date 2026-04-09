from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.device import Device


class SoftwareInventory(Base):
    __tablename__ = "software_inventory"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    version: Mapped[str | None] = mapped_column(String(100))
    install_date: Mapped[date | None] = mapped_column(Date)
    update_available: Mapped[bool] = mapped_column(Boolean, default=False)
    latest_version: Mapped[str | None] = mapped_column(String(100))
    last_scanned: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    device: Mapped[Device] = relationship(back_populates="software")
