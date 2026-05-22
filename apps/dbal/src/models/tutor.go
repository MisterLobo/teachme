package models

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Tutor struct {
	bun.BaseModel
	Timestamps
	ID                    uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	FirstName             string
	LastName              string
	Country               string
	City                  *string
	Timezone              string
	Currency              string
	Title                 *string
	OrganizationID        *uuid.UUID `bun:",type:uuid"`
	Dob                   *string
	PrimaryLanguage       *string
	OtherLanguages        *map[string]any `bun:",type:jsonb"`
	Languages             *string
	Bio                   *string
	Categories            *string
	Subjects              *string
	AvailabilitySchedules *map[string]any `bun:",type:jsonb"`
	EventTypes            *map[string]any `bun:",type:jsonb"`
	Code                  *string
	StripeConnectId       *string `json:"-"`
	Status                string
	DefaultCalendar       *string
	Calendars             *map[string]any `bun:",type:jsonb"`
	TenantID              uuid.UUID       `bun:",type:uuid"`
	SessionDuration       uint
	SessionPrice          int64
	CalMetadata           *TutorCalMetadata `bun:",type:jsonb"`
	AverageRating         *float64
	MaxSessionPrice       *float64

	Tenant       *Tenant            `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
	Organization *Organization      `bun:"rel:belongs-to,join:organization_id=id" json:"-"`
	Appointments []*Appointment     `bun:"rel:has-many,join:id=host_id"`
	Credit       *Credit            `bun:"rel:has-one,join:id=id"`
	Sessions     []*TutorialSession `bun:"rel:has-many,join:id=tutor_id" json:"-"`
	Subscription *Subscription      `bun:"rel:has-one,join:id=id" json:"-"`
}

/* func (m *Tutor) name() string {
	return "tutors"
} */

type TutorCalMetadata struct {
	Org       TutorCalMetadataOrgSlug   `json:"org"`
	User      TutorCalMetadataUser      `json:"user"`
	Team      TutorCalMetadataTeam      `json:"team"`
	Schedules TutorCalMetadataSchedules `json:"schedules"`
	EventType TutorCalMetadataEventType `json:"eventType"`
}
type TutorCalMetadataOrgSlug string
type TutorCalMetadataUser struct {
	Id       int    `json:"id"`
	Username string `json:"username"`
}
type TutorCalMetadataTeam struct {
	TeamId   int    `json:"teamId"`
	Slug     string `json:"slug"`
	MemberId int    `json:"memberId"`
}
type TutorCalMetadataSchedules struct {
	Team int `jons:"team"`
	User int `json:"user"`
}
type TutorCalMetadataEventType struct {
	Id   int    `json:"id"`
	Slug string `json:"slug"`
}

func createTutorsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users create tutor profile" ON tutors;
			CREATE POLICY "users create tutor profile"
			ON tutors
			FOR INSERT
			TO authenticated
			WITH CHECK (
				--true
				tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
	`); err != nil {
			log.Fatalf("Failed to create policies: %v", err)
		}

		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users update tutor profile" ON tutors;
			CREATE POLICY "users update tutor profile"
			ON tutors
			FOR UPDATE
			TO authenticated
			USING (
				--true
				id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
				tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			)
			WITH CHECK (
				--true
				id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
				tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
	`); err != nil {
			log.Fatalf("Failed to create policies: %v", err)
		}

		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users view tutor profile" ON tutors;
			CREATE POLICY "users view tutor profile"
			ON tutors
			FOR SELECT
			TO authenticated
			USING (
				id = NULLIF(current_setting('app.tutor_id', true), '')::uuid OR
				id = NULLIF(current_setting('app.host_id', true), '')::uuid OR
				COALESCE(NULLIF(current_setting('app.student_id', true), '')::uuid, NULL) IS NOT NULL
			);
	`); err != nil {
			log.Fatalf("Failed to create policies: %v", err)
		}
		return nil
	})
}

func alterTutorsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users create tutor profile" ON tutors;
			CREATE POLICY "users create tutor profile"
			ON tutors
			FOR INSERT
			TO authenticated
			WITH CHECK (
				--true
				tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR
				id = NULLIF(current_setting('app.tutor_id', true), '')::uuid OR
				id = NULLIF(current_setting('app.host_id', true), '')::uuid
			);
	`); err != nil {
			log.Fatalf("Failed to create policies: %v", err)
		}

		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users update tutor profile" ON tutors;
			CREATE POLICY "users update tutor profile"
			ON tutors
			FOR UPDATE
			TO authenticated
			USING (
				--true
				tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR
				id = NULLIF(current_setting('app.tutor_id', true), '')::uuid OR
				id = NULLIF(current_setting('app.host_id', true), '')::uuid
			)
			WITH CHECK (
				--true
				tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid OR
				id = NULLIF(current_setting('app.tutor_id', true), '')::uuid OR
				id = NULLIF(current_setting('app.host_id', true), '')::uuid
			);
	`); err != nil {
			log.Fatalf("Failed to create policies: %v", err)
		}

		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "users view tutor profile" ON tutors;
			CREATE POLICY "users view tutor profile"
			ON tutors
			FOR SELECT
			TO authenticated
			USING (
				--true
				tenant_id = COALESCE(NULLIF(current_setting('app.tenant_id', true), '')::uuid, NULL) OR
				id = COALESCE(NULLIF(current_setting('app.tutor_id', true), '')::uuid, NULL) OR
				id = COALESCE(NULLIF(current_setting('app.host_id', true), '')::uuid, NULL) OR
				COALESCE(NULLIF(current_setting('app.student_id', true), '')::uuid, NULL) IS NOT NULL
			);
	`); err != nil {
			log.Fatalf("Failed to create policies: %v", err)
		}
		return nil
	})
}
