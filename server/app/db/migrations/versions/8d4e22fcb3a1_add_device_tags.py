"""add_device_tags

Revision ID: 8d4e22fcb3a1
Revises: 35e7b29c0008
Create Date: 2026-04-09 16:10:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "8d4e22fcb3a1"
down_revision = "35e7b29c0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("devices", "tags")
