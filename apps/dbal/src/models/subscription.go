package models

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Subscription struct {
	bun.BaseModel
	Timestamps
	ID                   uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Plan                 *string
	TenantID             *uuid.UUID `bun:",type:uuid"`
	SubscriberID         uuid.UUID  `bun:",type:uuid"`
	SubscriberType       UserRole   `bun:",type:user_role"`
	StripeProductId      *string
	StripePriceId        *string
	StripeCustomerId     *string
	StripeSubscriptionId *string
	PeriodStart          *time.Time
	PeriodEnd            *time.Time
	NextBillingAt        *time.Time
	TrialActive          bool
	TrialStartsAt        *time.Time
	TrialEndsAt          *time.Time
	TrialDuration        *uint
	UnlockedFeatures     UnlockedFeatures `bun:",type:jsonb"`
	Status               *string
	EndedAt              *time.Time
	CancelAt             *time.Time
	CanceledAt           *time.Time
	CancelReason         *string

	Tenant             *Tenant   `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
	TenantSubscriber   *Tenant   `bun:"rel:belongs-to,join:subscriber_id=id" json:"-"`
	CustomerSubscriber *Customer `bun:"rel:belongs-to,join:subscriber_id=id" json:"-"`
}

/* func (m *Subscription) name() string {
	return "subscriptions"
} */

type UnlockedFeatures struct {
	Full                    bool
	Assistant               bool
	SmartSearch             bool
	BoostRanking            bool
	ReviewSessionRecordings bool
	GenerateTranscripts     bool
	OrgSize                 int
	TrialCredits            uint
	TrialDays               uint
}

func TrialFeatures() UnlockedFeatures {
	return UnlockedFeatures{
		Full:         true,
		TrialCredits: 5,
		TrialDays:    30,
	}
}

func FullFeatures() UnlockedFeatures {
	return UnlockedFeatures{
		Full: true,
	}
}

func BasicFeatures() UnlockedFeatures {
	return UnlockedFeatures{
		Full:      false,
		Assistant: true,
	}
}

func CreateSubscriptionForUser(ctx context.Context, db *bun.DB, subscriberID *uuid.UUID, tenantID *uuid.UUID, subcriberType UserRole) (*uuid.UUID, error) {
	id := subscriberID
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		features := TrialFeatures()
		sub := Subscription{
			ID:               *id,
			TenantID:         nil,
			SubscriberType:   subcriberType,
			UnlockedFeatures: features,
		}
		_, err := tx.NewInsert().Model(&sub).Exec(ctx)
		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return id, nil
}

func createSubscriptionsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users select own subscriptions" ON subscriptions;
		CREATE POLICY "users select own subscriptions"
		ON subscriptions
		FOR SELECT
		TO authenticated
		USING (
			subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid OR
			subscriber_id = COALESCE(NULLIF(current_setting('app.tenant_id', true), '')::uuid, NULLIF(current_setting('app.customer_id', true), '')::uuid)
		);
	`); err != nil {
			log.Fatalf("Failed to create policies")
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users can create subscription" ON subscriptions;
		CREATE POLICY "users can create subscription"
		ON subscriptions
		FOR INSERT
		TO authenticated
		WITH CHECK (
			subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid OR
			tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		)
	`); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users can update own subscription" ON subscriptions;
		CREATE POLICY "users can update own subscription"
		ON subscriptions
		FOR UPDATE
		TO authenticated
		USING (
			subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid OR
			tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		)
		WITH CHECK (
			subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid OR
			tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		)
	`); err != nil {
			return err
		}

		return nil
	})
}

func alterSubscriptionsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users select own subscriptions" ON subscriptions;
		CREATE POLICY "users select own subscriptions"
		ON subscriptions
		FOR SELECT
		TO authenticated
		USING (
			(
				subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid AND
				NULLIF(current_setting('app.student_id', true), '')::uuid IS NOT NULL AND
				tenant_id IS NULL
			) OR
			(
				subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid AND
				NULLIF(current_setting('app.tutor_id', true), '')::uuid IS NOT NULL AND
				tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
			)
		);
	`); err != nil {
			log.Fatalf("Failed to create policies")
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users can create subscription" ON subscriptions;
		CREATE POLICY "users can create subscription"
		ON subscriptions
		FOR INSERT
		TO authenticated
		WITH CHECK (
			subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid
		)
	`); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users can update own subscription" ON subscriptions;
		CREATE POLICY "users can update own subscription"
		ON subscriptions
		FOR UPDATE
		TO authenticated
		USING (
			subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid OR
			tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		)
		WITH CHECK (
			subscriber_id = NULLIF(current_setting('app.subscriber_id', true), '')::uuid OR
			tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		)
	`); err != nil {
			return err
		}

		return nil
	})
}
