package models

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type TenantType string

const (
	TutorIndividual   TenantType = "tutor_individual"
	TutorOrganization TenantType = "tutor_organization"
)

type Tenant struct {
	bun.BaseModel
	Timestamps
	ID                   uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	OwnerID              uuid.UUID  `bun:",type:uuid"`
	TenantType           TenantType `bun:"type:tenant_type"`
	Name                 string
	Plan                 string
	StripeCustomerID     *string
	StripeSubscriptionID *string
	Status               string
	TrialEndsAt          *time.Time

	Owner         *User           `bun:"rel:belongs-to,join:owner_id=id" json:"-"`
	Subscription  *Subscription   `bun:"rel:has-one,join:id=tenant_id" json:"-"`
	Subscriptions []*Subscription `bun:"rel:has-many,join:id=tenant_id" json:"-"`
	Credit        *Credit         `bun:"rel:has-one,join:id=id,join:tenant_type=owner_type,polymorphic"`
}

/* func (m *Tenant) name() string {
	return "tenants"
} */

func CreateTenantTypeType(db *bun.DB) error {
	_, err := db.Exec("CREATE TYPE tenant_type AS ENUM ('tutor_individual', 'tutor_organization');")
	return err
}

func CreateTenantsRLSPolicies(ctx context.Context, db *bun.DB) {
	if _, err := db.Exec(`
	DROP POLICY IF EXISTS "users create tenant" ON tenants;
	CREATE POLICY "users create tenant"
	ON tenants
	FOR INSERT
	TO authenticated
	WITH CHECK (owner_id = COALESCE(current_setting('app.user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid));
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}

	if _, err := db.Exec(`
	DROP POLICY IF EXISTS "users view tenant" ON tenants;
	CREATE POLICY "users view tenant"
	ON tenants
	FOR SELECT
	TO authenticated
	USING (
		--true
		owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
		id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}

	if _, err := db.Exec(`
	DROP POLICY IF EXISTS "users update tenant" ON tenants;
	CREATE POLICY "users update tenant"
	ON tenants
	FOR UPDATE
	TO authenticated
	USING (
		--true
		owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
		id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
	)
	WITH CHECK (
		--true
		owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
		id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}
}

func alterTenantsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users create tenant" ON tenants;
		CREATE POLICY "users create tenant"
		ON tenants
		FOR INSERT
		TO authenticated
		WITH CHECK (
			--true
			owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
			id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		);
		`); err != nil {
			log.Printf("Failed to create policies: %v", err)
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users view tenant" ON tenants;
		CREATE POLICY "users view tenant"
		ON tenants
		FOR SELECT
		TO authenticated
		USING (
			--true
			owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
			id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		);
		`); err != nil {
			log.Printf("Failed to create policies: %v", err)
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "users update tenant" ON tenants;
		CREATE POLICY "users update tenant"
		ON tenants
		FOR UPDATE
		TO authenticated
		USING (
			--true
			owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
			id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		)
		WITH CHECK (
			--true
			owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR
			id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
		);
		`); err != nil {
			log.Printf("Failed to create policies: %v", err)
			return err
		}
		return nil
	})
}
