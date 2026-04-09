"""add notification email channel

Revision ID: a2f4f7c9d101
Revises: 6f72d5e21d31
Create Date: 2026-04-09 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a2f4f7c9d101"
down_revision = "6f72d5e21d31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notification_rules", sa.Column("email_address", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("notification_rules", "email_address")
