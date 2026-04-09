import uuid
from datetime import datetime
from sqlalchemy import Float, BigInteger, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class DeviceMetric(Base):
    __tablename__ = "device_metrics"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    cpu_percent: Mapped[float | None] = mapped_column(Float)
    ram_percent: Mapped[float | None] = mapped_column(Float)
    disk_percent: Mapped[float | None] = mapped_column(Float)
    cpu_temp: Mapped[float | None] = mapped_column(Float)
    uptime_secs: Mapped[int | None] = mapped_column(BigInteger)
    ram_total_mb: Mapped[float | None] = mapped_column(Float)
    ram_used_mb: Mapped[float | None] = mapped_column(Float)
    disk_total_gb: Mapped[float | None] = mapped_column(Float)
    disk_used_gb: Mapped[float | None] = mapped_column(Float)
    disk_read_mbps: Mapped[float | None] = mapped_column(Float)
    disk_write_mbps: Mapped[float | None] = mapped_column(Float)
    net_sent_mbps: Mapped[float | None] = mapped_column(Float)
    net_recv_mbps: Mapped[float | None] = mapped_column(Float)
