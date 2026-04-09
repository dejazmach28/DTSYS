from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.device import Device


class DeviceNetworkInfo(Base):
    __tablename__ = "device_network_info"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    interface_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mac_address: Mapped[str | None] = mapped_column(String(64))
    ipv4: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    ipv6: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    is_up: Mapped[bool] = mapped_column(Boolean, default=True)
    mtu: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    device: Mapped[Device] = relationship(back_populates="network_interfaces")
