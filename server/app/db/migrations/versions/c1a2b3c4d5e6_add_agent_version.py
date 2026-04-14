"""add agent version

Revision ID: c1a2b3c4d5e6
Revises: b4d9e6a12f44
Create Date: 2026-04-14 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c1a2b3c4d5e6"
down_revision = "b4d9e6a12f44"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("devices", sa.Column("agent_version", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "agent_version")
