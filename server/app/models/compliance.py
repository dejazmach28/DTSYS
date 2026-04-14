"""Compliance policy and result models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class CompliancePolicy(Base):
    """Org-scoped rule set for device compliance evaluation."""

    __tablename__ = "compliance_policies"
    __table_args__ = (
        UniqueConstraint("org_id", "name", name="uq_compliance_policy_org_name"),
        Index("ix_compliance_policies_org_id", "org_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Rules: list of rule dicts persisted as JSONB
    # Each rule: { "type": "os_version_min" | "disk_free_min_gb" | "required_software" | "max_offline_hours",
    #              "value": <scalar or string> }
    rules: Mapped[list] = mapped_column(JSONB, default=list)


class ComplianceResult(Base):
    """Latest compliance evaluation result for a device against a policy."""

    __tablename__ = "compliance_results"
    __table_args__ = (
        UniqueConstraint("device_id", "policy_id", name="uq_compliance_result_device_policy"),
        Index("ix_compliance_results_device_id", "device_id"),
        Index("ix_compliance_results_policy_id", "policy_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    policy_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("compliance_policies.id", ondelete="CASCADE"), nullable=False)
    is_compliant: Mapped[bool] = mapped_column(Boolean, nullable=False)
    # Detail per rule: [ {"type": ..., "passed": bool, "detail": "..."} ]
    details: Mapped[list] = mapped_column(JSONB, default=list)
    violations: Mapped[int] = mapped_column(Integer, default=0)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
