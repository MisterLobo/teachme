package models

import (
	"context"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type TutorialSession struct {
	bun.BaseModel
	Timestamps
	ID                uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	TutorID           uuid.UUID `bun:",type:uuid"`
	StudentID         uuid.UUID `bun:",type:uuid"`
	Status            string
	Progress          *string
	AppointmentID     uuid.UUID `bun:",type:uuid"`
	SessionID         string
	SessionLink       *string
	SessionLengthSecs uint
	TenantID          uuid.UUID `bun:",type:uuid"`
	Secret            *string

	Tutor       *Tutor       `bun:"rel:belongs-to,join:tutor_id=id" json:"-"`
	Student     *Student     `bun:"rel:belongs-to,join:student_id=id" json:"-"`
	Appointment *Appointment `bun:"rel:belongs-to,join:appointment_id=id" json:"-"`
	Tenant      *Tenant      `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
}

type AccessCodeManifest struct {
	CredentialId  *string `json:"credential_id"`
	KeyCiphertext string  `json:"key_ciphertext"`
	KeyType       string  `json:"key_type"`
}

type SessionAccessCode struct {
	bun.BaseModel
	Timestamps
	ID               uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	SessionID        *uuid.UUID `bun:",type:uuid"`
	EncAccessGroup   *string
	AccessCode       string                `bun:",bytea"`
	Salt             string                `bun:",type:bytea"`
	HostSessionKeys  []*AccessCodeManifest `bun:",jsonb"`
	GuestSessionKeys []*AccessCodeManifest `bun:",jsonb"`

	Session *TutorialSession `bun:"rel:belongs-to,join:session_id=id" json:"-"`
}

func createTutorSessionRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "tutors can create session" ON tutorial_sessions;
			CREATE POLICY "tutors can create session"
			ON tutorial_sessions
			FOR INSERT
			TO authenticated
			WITH CHECK (
				(
					tutor_id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tutor_id = COALESCE(current_setting('app.host_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				) OR
				(student_id = COALESCE(current_setting('app.student_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
			);
		`); err != nil {
			log.Errorf("[TutorSession] error creating RLS policies: %v", err)
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "tutors view own session" ON tutorial_sessions;
			CREATE POLICY "tutors view own session"
			ON tutorial_sessions
			FOR SELECT
			TO authenticated
			USING (
				(
					tutor_id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tutor_id = COALESCE(current_setting('app.host_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					appointment_id = COALESCE(current_setting('app.appointment_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				) OR
				(
					student_id = COALESCE(current_setting('app.student_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					student_id = COALESCE(current_setting('app.attendee_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					appointment_id = COALESCE(current_setting('app.appointment_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				)
			);
		`); err != nil {
			log.Errorf("[TutorSession] error creating RLS policies: %v", err)
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "tutors update own session" ON tutorial_sessions;
			CREATE POLICY "tutors update own session"
			ON tutorial_sessions
			FOR UPDATE
			TO authenticated
			USING (
				(
					tutor_id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tutor_id = COALESCE(current_setting('app.host_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					appointment_id = COALESCE(current_setting('app.appointment_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				) OR
				(
					student_id = COALESCE(current_setting('app.student_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					student_id = COALESCE(current_setting('app.attendee_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					appointment_id = COALESCE(current_setting('app.appointment_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				)
			)
			WITH CHECK (
				(
					tutor_id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tutor_id = COALESCE(current_setting('app.host_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				) OR
				(
					student_id = COALESCE(current_setting('app.student_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					student_id = COALESCE(current_setting('app.attendee_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					appointment_id = COALESCE(current_setting('app.appointment_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				)
			);
		`); err != nil {
			log.Errorf("[TutorSession] error creating RLS policies: %v", err)
			return err
		}
		return nil
	})
}
