"""Add compliance_policies and compliance_results tables.

Revision ID: f1a2b3c4d5e6
Revises: e8f9a0b1c2d3
Create Date: 2026-04-14

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f1a2b3c4d5e6'
down_revision = 'e8f9a0b1c2d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'compliance_policies',
        sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column('org_id', sa.Uuid(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('rules', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('org_id', 'name', name='uq_compliance_policy_org_name'),
    )
    op.create_index('ix_compliance_policies_org_id', 'compliance_policies', ['org_id'])

    op.create_table(
        'compliance_results',
        sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column('device_id', sa.Uuid(as_uuid=True), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('policy_id', sa.Uuid(as_uuid=True), sa.ForeignKey('compliance_policies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_compliant', sa.Boolean, nullable=False),
        sa.Column('details', postgresql.JSONB, nullable=False, server_default='[]'),
        sa.Column('violations', sa.Integer, nullable=False, server_default='0'),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('device_id', 'policy_id', name='uq_compliance_result_device_policy'),
    )
    op.create_index('ix_compliance_results_device_id', 'compliance_results', ['device_id'])
    op.create_index('ix_compliance_results_policy_id', 'compliance_results', ['policy_id'])


def downgrade() -> None:
    op.drop_index('ix_compliance_results_policy_id', 'compliance_results')
    op.drop_index('ix_compliance_results_device_id', 'compliance_results')
    op.drop_table('compliance_results')

    op.drop_index('ix_compliance_policies_org_id', 'compliance_policies')
    op.drop_table('compliance_policies')
