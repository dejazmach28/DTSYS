"""add_metric_io_rates

Revision ID: 6f72d5e21d31
Revises: 1b6a6d4ce2d1
Create Date: 2026-04-10 14:15:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "6f72d5e21d31"
down_revision = "1b6a6d4ce2d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("device_metrics", sa.Column("disk_read_mbps", sa.Float(), nullable=True))
    op.add_column("device_metrics", sa.Column("disk_write_mbps", sa.Float(), nullable=True))
    op.add_column("device_metrics", sa.Column("net_sent_mbps", sa.Float(), nullable=True))
    op.add_column("device_metrics", sa.Column("net_recv_mbps", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("device_metrics", "net_recv_mbps")
    op.drop_column("device_metrics", "net_sent_mbps")
    op.drop_column("device_metrics", "disk_write_mbps")
    op.drop_column("device_metrics", "disk_read_mbps")
