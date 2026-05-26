package models

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Transaction struct {
	bun.BaseModel
	Timestamps
	ID                    uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	InitiatedAt           *time.Time
	CompletedAt           *time.Time
	Status                *string
	AppointmentID         *uuid.UUID `bun:",type:uuid"`
	Purpose               *string
	StripePaymentIntentId *string
	StripeInvoiceId       *string
	PaymentLink           *string
	TenantID              *uuid.UUID   `bun:",type:uuid"`
	Biller                *uuid.UUID   `bun:",type:uuid"`
	BilledTo              *uuid.UUID   `bun:",type:uuid"`
	BilledToType          CustomerType `bun:",type:customer_type"`

	Tenant          *Tenant      `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
	Appointment     *Appointment `bun:"rel:belongs-to,join:appointment_id=id" json:"-"`
	BillerData      *Tutor       `bun:"rel:belongs-to,join:biller=id" json:"-"`
	BilledToStudent *Student     `bun:"rel:belongs-to,join:billed_to=id" json:"-"`
	BilledToParent  *Parent      `bun:"rel:belongs-to,join:billed_to=id" json:"-"`
}

/* func (m *Transaction) name() string {
	return "transactions"
} */

func createTransactionsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users can create transactions" ON transactions;
			CREATE POLICY "users can create transactions"
			ON transactions
			FOR INSERT
			TO authenticated
			WITH CHECK (
				tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);

			DROP POLICY IF EXISTS "users can update own transactions" ON transactions;
			CREATE POLICY "users can update own transactions"
			ON transactions
			FOR UPDATE
			TO authenticated
			USING (
				id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			)
			WITH CHECK (
				tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);

			DROP POLICY IF EXISTS "users view own transactions" ON transactions;
			CREATE POLICY "users view own transactions"
			ON transactions
			FOR SELECT
			TO authenticated
			USING (
				id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
	`); err != nil {
			return err
		}
		return nil
	})
}

func alterTransactionsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users can create transactions" ON transactions;
			CREATE POLICY "users can create transactions"
			ON transactions
			FOR INSERT
			TO authenticated
			WITH CHECK (
				true
				--tenant_id = NULLIF(current_setting('app.tenant_id', true)::uuid, '')::uuid OR
				--billed_to = NULLIF(current_setting('app.customer_id', true)::uuid, '')::uuid OR
				--biller = NULLIF(current_setting('app.biller_id', true), '')::uuid OR
				--appointment_id = NULLIF(current_setting('app.appointment_id', true), '')::uuid
			);

			DROP POLICY IF EXISTS "users can update own transactions" ON transactions;
			CREATE POLICY "users can update own transactions"
			ON transactions
			FOR UPDATE
			TO authenticated
			USING (
				true
				--tenant_id = NULLIF(current_setting('app.tenant_id', true)::uuid, '')::uuid OR
				--billed_to = NULLIF(current_setting('app.customer_id', true)::uuid, '')::uuid OR
				--biller = NULLIF(current_setting('app.biller_id', true), '')::uuid OR
				--appointment_id = NULLIF(current_setting('app.booking_id', true), '')::uuid
			)
			WITH CHECK (
				true
				--tenant_id = NULLIF(current_setting('app.tenant_id', true)::uuid, '')::uuid OR
				--billed_to = NULLIF(current_setting('app.customer_id', true)::uuid, '')::uuid OR
				--biller = NULLIF(current_setting('app.biller_id', true), '')::uuid OR
				--appointment_id = NULLIF(current_setting('app.booking_id', true), '')::uuid
			);

			DROP POLICY IF EXISTS "users view own transactions" ON transactions;
			CREATE POLICY "users view own transactions"
			ON transactions
			FOR SELECT
			TO authenticated
			USING (
				true
				--tenant_id = NULLIF(current_setting('app.tenant_id', true)::uuid, '')::uuid OR
				--billed_to = NULLIF(current_setting('app.customer_id', true)::uuid, '')::uuid OR
				--biller = NULLIF(current_setting('app.biller_id', true), '')::uuid OR
				--appointment_id = NULLIF(current_setting('app.booking_id', true), '')::uuid
			);
	`); err != nil {
			return err
		}
		return nil
	})
}
