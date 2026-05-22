package models

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type StudentPreferences struct {
	Budget          []float64 `bun:",array"`
	TimePreferences []string  `bun:",array"`
	Interests       []string  `bun:",array"`
}

type Student struct {
	bun.BaseModel
	Timestamps
	ID              uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	FirstName       string
	LastName        string
	Dob             *string
	Gender          *string
	ParentID        *uuid.UUID `bun:",type:uuid"`
	CustomerID      *uuid.UUID `bun:",type:uuid"`
	DefaultCalendar *string
	Calendars       *map[string]any `bun:",type:jsonb"`
	Country         string
	Currency        string
	Language        string
	Locale          *string
	Timezone        *string
	Preferences     *StudentPreferences `bun:",type:jsonb"`

	Customer     *Customer          `bun:"rel:belongs-to,join:customer_id=id" json:"-"`
	Parent       *Parent            `bun:"rel:belongs-to,join:parent_id=id" json:"-"`
	Sessions     []*TutorialSession `bun:"rel:has-many,join:id=student_id" json:"-"`
	Subscription *Subscription      `bun:"rel:has-one,join:id=id" json:"-"`
}

/* func (m *Student) name() string {
	return "students"
} */

func createStudentsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students select own" ON students;
		CREATE POLICY "students select own"
		ON students
		FOR SELECT
		TO authenticated
		USING (
			--true
			id = current_setting('app.student_id', true)::uuid OR
			customer_id = COALESCE(current_setting('app.customer_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
		);
	`); err != nil {
			log.Fatalf("Failed to create policies")
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students can create" ON students;
		CREATE POLICY "students can create"
		ON students
		FOR INSERT
		TO authenticated
		WITH CHECK (
			--true
			(customer_id = COALESCE(current_setting('app.customer_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
			--(parent_id IS NOT NULL AND parent_id = current_setting('app.parent_id', true)::uuid)
		);
	`); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students can update own" ON students;
		CREATE POLICY "students can update own"
		ON students
		FOR UPDATE
		TO authenticated
		USING (
			--true
			id = current_setting('app.student_id', true)::uuid OR
			(id = current_setting('app.student_id', true)::uuid AND current_setting('app.parent_id', true) IS NULL AND parent_id IS NULL)
			--(parent_id IS NOT NULL AND parent_id = current_setting('app.parent_id', true)::uuid)
		)
		WITH CHECK (
			--true
			id = current_setting('app.student_id', true)::uuid OR
			(customer_id = COALESCE(current_setting('app.customer_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
			--(parent_id IS NOT NULL AND parent_id = current_setting('app.parent_id', true)::uuid)
		);
	`); err != nil {
			return err
		}

		return nil
	})
}

func alterStudentsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students select own" ON students;
		CREATE POLICY "students select own"
		ON students
		FOR SELECT
		TO authenticated
		USING (
			id = COALESCE(NULLIF(current_setting('app.student_id', true), '')::uuid, NULL) OR
			customer_id = COALESCE(NULLIF(current_setting('app.customer_id', true), '')::uuid, NULL)
		);
	`); err != nil {
			log.Fatalf("Failed to create policies")
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students can create" ON students;
		CREATE POLICY "students can create"
		ON students
		FOR INSERT
		TO authenticated
		WITH CHECK (
			customer_id = COALESCE(NULLIF(current_setting('app.customer_id', true), '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			--(parent_id IS NOT NULL AND parent_id = current_setting('app.parent_id', true)::uuid)
		);
	`); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students can update own" ON students;
		CREATE POLICY "students can update own"
		ON students
		FOR UPDATE
		TO authenticated
		USING (
			--true
			id = current_setting('app.student_id', true)::uuid OR
			(id = current_setting('app.student_id', true)::uuid AND current_setting('app.parent_id', true) IS NULL AND parent_id IS NULL)
			--(parent_id IS NOT NULL AND parent_id = current_setting('app.parent_id', true)::uuid)
		)
		WITH CHECK (
			--true
			id = current_setting('app.student_id', true)::uuid OR
			(customer_id = COALESCE(current_setting('app.customer_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
			--(parent_id IS NOT NULL AND parent_id = current_setting('app.parent_id', true)::uuid)
		);
	`); err != nil {
			return err
		}

		return nil
	})
}
