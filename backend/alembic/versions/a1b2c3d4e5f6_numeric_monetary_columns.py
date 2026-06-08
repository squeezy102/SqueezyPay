"""numeric_monetary_columns

Revision ID: a1b2c3d4e5f6
Revises: 5a43611da40e
Create Date: 2026-06-08 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: str | Sequence[str] | None = '5a43611da40e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Change Float monetary columns to Numeric(12,2) for financial precision."""
    with op.batch_alter_table('plaid_accounts') as batch_op:
        batch_op.alter_column('current_balance',
                              existing_type=sa.Float(),
                              type_=sa.Numeric(precision=12, scale=2),
                              existing_nullable=True)
        batch_op.alter_column('available_balance',
                              existing_type=sa.Float(),
                              type_=sa.Numeric(precision=12, scale=2),
                              existing_nullable=True)

    with op.batch_alter_table('plaid_transactions') as batch_op:
        batch_op.alter_column('amount',
                              existing_type=sa.Float(),
                              type_=sa.Numeric(precision=12, scale=2),
                              existing_nullable=False)


def downgrade() -> None:
    """Revert Numeric columns back to Float."""
    with op.batch_alter_table('plaid_transactions') as batch_op:
        batch_op.alter_column('amount',
                              existing_type=sa.Numeric(precision=12, scale=2),
                              type_=sa.Float(),
                              existing_nullable=False)

    with op.batch_alter_table('plaid_accounts') as batch_op:
        batch_op.alter_column('current_balance',
                              existing_type=sa.Numeric(precision=12, scale=2),
                              type_=sa.Float(),
                              existing_nullable=True)
        batch_op.alter_column('available_balance',
                              existing_type=sa.Numeric(precision=12, scale=2),
                              type_=sa.Float(),
                              existing_nullable=True)
