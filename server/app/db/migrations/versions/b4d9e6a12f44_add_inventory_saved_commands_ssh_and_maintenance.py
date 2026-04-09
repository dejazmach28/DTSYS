"""add_inventory_saved_commands_ssh_and_maintenance

Revision ID: b4d9e6a12f44
Revises: a2f4f7c9d101
Create Date: 2026-04-09 22:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b4d9e6a12f44"
down_revision = "a2f4f7c9d101"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("serial_number", sa.String(length=100), nullable=True))
    op.add_column("devices", sa.Column("manufacturer", sa.String(length=100), nullable=True))
    op.add_column("devices", sa.Column("model_name", sa.String(length=100), nullable=True))
    op.add_column("devices", sa.Column("purchase_date", sa.Date(), nullable=True))
    op.add_column("devices", sa.Column("warranty_expires", sa.Date(), nullable=True))
    op.add_column("devices", sa.Column("location", sa.String(length=255), nullable=True))
    op.add_column("devices", sa.Column("assigned_to", sa.String(length=255), nullable=True))
    op.add_column("devices", sa.Column("asset_tag", sa.String(length=100), nullable=True))
    op.add_column("devices", sa.Column("maintenance_mode", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("devices", sa.Column("maintenance_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("devices", sa.Column("maintenance_reason", sa.String(length=500), nullable=True))

    op.create_table(
        "uptime_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("duration_secs", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_uptime_events_timestamp"), "uptime_events", ["timestamp"], unique=False)
    op.create_index(op.f("ix_uptime_events_device_id"), "uptime_events", ["device_id"], unique=False)

    op.create_table(
        "saved_commands",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("command_type", sa.String(length=50), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("device_id", sa.Uuid(), nullable=True),
        sa.Column("is_global", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "ssh_keys",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("key_type", sa.String(length=50), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=False),
        sa.Column("fingerprint", sa.String(length=255), nullable=False),
        sa.Column("comment", sa.String(length=255), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ssh_keys_device_id"), "ssh_keys", ["device_id"], unique=False)
    op.create_index(op.f("ix_ssh_keys_fingerprint"), "ssh_keys", ["fingerprint"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ssh_keys_fingerprint"), table_name="ssh_keys")
    op.drop_index(op.f("ix_ssh_keys_device_id"), table_name="ssh_keys")
    op.drop_table("ssh_keys")
    op.drop_table("saved_commands")
    op.drop_index(op.f("ix_uptime_events_device_id"), table_name="uptime_events")
    op.drop_index(op.f("ix_uptime_events_timestamp"), table_name="uptime_events")
    op.drop_table("uptime_events")

    op.drop_column("devices", "maintenance_reason")
    op.drop_column("devices", "maintenance_until")
    op.drop_column("devices", "maintenance_mode")
    op.drop_column("devices", "asset_tag")
    op.drop_column("devices", "assigned_to")
    op.drop_column("devices", "location")
    op.drop_column("devices", "warranty_expires")
    op.drop_column("devices", "purchase_date")
    op.drop_column("devices", "model_name")
    op.drop_column("devices", "manufacturer")
    op.drop_column("devices", "serial_number")
