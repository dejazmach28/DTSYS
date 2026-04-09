from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Boolean, DateTime, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.alert import Alert
    from app.models.command import Command
    from app.models.event import Event
    from app.models.network import DeviceNetworkInfo
    from app.models.software import SoftwareInventory


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    os_type: Mapped[str] = mapped_column(String(50), nullable=False)  # windows|linux|macos
    os_version: Mapped[str | None] = mapped_column(String(255))
    arch: Mapped[str | None] = mapped_column(String(50))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    fingerprint: Mapped[str | None] = mapped_column(String(64))  # SHA256 hex
    api_key_hash: Mapped[str] = mapped_column(Text, nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="offline")  # online|offline|alert
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    label: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    software: Mapped[list[SoftwareInventory]] = relationship(back_populates="device", lazy="select")
    events: Mapped[list[Event]] = relationship(back_populates="device", lazy="select")
    commands: Mapped[list[Command]] = relationship(back_populates="device", lazy="select")
    alerts: Mapped[list[Alert]] = relationship(back_populates="device", lazy="select")
    network_interfaces: Mapped[list[DeviceNetworkInfo]] = relationship(back_populates="device", lazy="select")
