package models

import (
	"context"
	"database/sql/driver"
	"errors"
	"log"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type CustomerType string

const (
	StudentLearner CustomerType = "student_learner"
	ParentGuardian CustomerType = "parent_guardian"
	// TutorSingle       CustomerType = "tutor_single"
	// TutorOrganization CustomerType = "tutor_organization"
)

type Customer struct {
	bun.BaseModel
	Timestamps
	ID           uuid.UUID    `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UserID       uuid.UUID    `bun:",type:uuid"`
	CustomerType CustomerType `bun:"type:customer_type"`
	Plan         *string
	Status       string

	Reviews         []*TutorReview `bun:"rel:has-many,join:id=reviewer_id" json:"reviews,omitempty"`
	User            *User          `bun:"rel:belongs-to,join:user_id=id" json:"-"`
	Subscription    *Subscription  `bun:"rel:has-one,join:id=subscriber_id" json:"-"`
	Credit          *Credit        `bun:"rel:has-one,join:id=id,join:customer_type=owner_type,polymorphic"`
	StudentCustomer *Student       `bun:"rel:has-one,join:id=customer_id"`
	ParentCustomer  *Parent        `bun:"rel:has-one,join:id=customer_id"`
	// Transactions []*Transaction `bun:"rel:has-many,join:id=id,join:customer_type=billed_to_type,polymorphic"`
}

/* func (m *Customer) name() string {
	return "customers"
} */

func (ct *CustomerType) Scan(value any) error {
	*ct = CustomerType(value.([]byte))
	return nil
}

func (ct CustomerType) Value() (driver.Value, error) {
	return string(ct), nil
}

func CreateCustomerTypeType(db *bun.DB) error {
	_, err := db.Exec("CREATE TYPE customer_type AS ENUM ('student_learner', 'parent_guardian');")
	return err
}

func createCustomersRLSPolicies(ctx context.Context, db *bun.DB) {
	if _, err := db.ExecContext(ctx, `
	DROP POLICY IF EXISTS "view customer data" ON customers;
	CREATE POLICY "view customer data"
	ON customers
	FOR SELECT
	TO authenticated
	USING (user_id = current_setting('app.user_id')::uuid);

	DROP POLICY IF EXISTS "allow create customer data" ON customers;
	CREATE POLICY "allow create customer data"
	ON customers
	FOR INSERT
	TO authenticated
	WITH CHECK (user_id = current_setting('app.user_id')::uuid);

	DROP POLICY IF EXISTS "allow update customer data" ON customers;
	CREATE POLICY "allow update customer data"
	ON customers
	FOR UPDATE
	TO authenticated
	USING (user_id = current_setting('app.user_id')::uuid)
	WITH CHECK (user_id = current_setting('app.user_id')::uuid);
	`); err != nil {
		log.Fatalf("[Customer] Error setting up RLS: %v", err)
	}
}

func alterCustomersRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := db.ExecContext(ctx, `
			DROP POLICY IF EXISTS "view customer data" ON customers;
			CREATE POLICY "view customer data"
			ON customers
			FOR SELECT
			TO authenticated
			USING (user_id = COALESCE(NULLIF(current_setting('app.user_id', true), '')::uuid, NULL));
		`); err != nil {
			log.Fatalf("[Customer] Error setting up RLS: %v", err)
		}
		if _, err := db.ExecContext(ctx, `
			DROP POLICY IF EXISTS "allow create customer data" ON customers;
			CREATE POLICY "allow create customer data"
			ON customers
			FOR INSERT
			TO authenticated
			WITH CHECK (user_id = COALESCE(NULLIF(current_setting('app.user_id', true), '')::uuid, NULL));
		`); err != nil {
			log.Fatalf("[Customer] Error setting up RLS: %v", err)
		}
		if _, err := db.ExecContext(ctx, `
			DROP POLICY IF EXISTS "allow update customer data" ON customers;
			CREATE POLICY "allow update customer data"
			ON customers
			FOR UPDATE
			TO authenticated
			USING (user_id = COALESCE(NULLIF(current_setting('app.user_id', true), '')::uuid, NULL))
			WITH CHECK (user_id = COALESCE(NULLIF(current_setting('app.user_id', true), '')::uuid, NULL));
		`); err != nil {
			log.Fatalf("[Customer] Error setting up RLS: %v", err)
		}
		return nil
	})
}

func SetCustomersRLSContext(ctx context.Context, db *bun.DB) (*bun.DB, error) {
	pid := ctx.Value("pid")
	if pid == nil {
		return nil, errors.New("missing pid in context")
	}
	_, err := db.ExecContext(ctx, `
		SET LOCAL ROLE authenticated;
		DO $$
		DECLARE v_id uuid;
		DECLARE v_role user_role;
		DECLARE v_profile_id uuid;
		BEGIN
			SELECT id, role INTO v_id, v_role FROM users WHERE pid = $1;

			IF v_id IS NULL THEN
				RAISE EXCEPTION 'invalid user';
			END IF;

			IF v_role = 'tenant' THEN
				SELECT id into tenant_id FROM tenants WHERE owner_id = v_id;
			END IF;

			IF v_role = 'customer' THEN
				SELECT id into customer_id FROM customers WHERE user_id = v_id;
			END IF;

			PERFORM set_config('app.profile_id', v_profile_id::text, true);
		END $$;
	`, pid)
	if err != nil {
		log.Println("Failed to set RLS context")
		return nil, err
	}
	return db, nil
}
