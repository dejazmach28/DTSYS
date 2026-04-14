"""add organizations

Revision ID: d7f8e9a0b1c2
Revises: c1a2b3c4d5e6
Create Date: 2026-04-14 10:00:00.000000
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa

revision = "d7f8e9a0b1c2"
down_revision = "c1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False, unique=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("owner_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id")),
    )
    op.create_table(
        "organization_members",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("org_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE")),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("role", sa.String(length=20), server_default="member"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("org_id", "user_id", name="uq_org_member"),
    )
    op.add_column("devices", sa.Column("org_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organizations.id")))
    op.add_column("users", sa.Column("active_org_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organizations.id")))

    conn = op.get_bind()
    default_org_id = conn.execute(
        sa.text("SELECT id FROM organizations WHERE slug = :slug").bindparams(slug="default")
    ).scalar()
    if default_org_id is None:
        default_org_id = uuid.uuid4()
        conn.execute(
            sa.text(
                "INSERT INTO organizations (id, name, slug, created_at) VALUES (:id, :name, :slug, now())"
            ).bindparams(id=default_org_id, name="Default", slug="default")
        )

    conn.execute(
        sa.text("UPDATE devices SET org_id = :org_id WHERE org_id IS NULL").bindparams(org_id=default_org_id)
    )
    conn.execute(
        sa.text("UPDATE users SET active_org_id = :org_id WHERE active_org_id IS NULL").bindparams(
            org_id=default_org_id
        )
    )

    users = conn.execute(sa.text("SELECT id, role FROM users")).fetchall()
    for user_id, role in users:
        member_role = "admin" if role == "admin" else "member"
        conn.execute(
            sa.text(
                "INSERT INTO organization_members (id, org_id, user_id, role, joined_at) "
                "VALUES (:id, :org_id, :user_id, :role, now()) "
                "ON CONFLICT (org_id, user_id) DO NOTHING"
            ).bindparams(
                id=uuid.uuid4(),
                org_id=default_org_id,
                user_id=user_id,
                role=member_role,
            )
        )


def downgrade() -> None:
    op.drop_column("users", "active_org_id")
    op.drop_column("devices", "org_id")
    op.drop_table("organization_members")
    op.drop_table("organizations")
