package models

import (
	"context"
	"database/sql/driver"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type AppointmentStatus string

const (
	Pending        AppointmentStatus = "pending"
	Confirmed      AppointmentStatus = "confirmed"
	Ongoing        AppointmentStatus = "ongoing"
	Cancelled      AppointmentStatus = "cancelled"
	Completed      AppointmentStatus = "completed"
	AbsentHost     AppointmentStatus = "noshow_host"
	AbsentAttendee AppointmentStatus = "noshow_attendee"
)

type Appointment struct {
	bun.BaseModel
	Timestamps
	ID           uuid.UUID         `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	TenantID     *uuid.UUID        `bun:",type:uuid" json:"tenant_id,omitempty"`
	HostID       uuid.UUID         `bun:",type:uuid"`
	AttendeeID   uuid.UUID         `bun:",type:uuid"`
	StartAt      time.Time         `bun:",type:timestamptz,notnull"`
	EndAt        time.Time         `bun:",type:timestamptz,notnull"`
	Duration     uint              `bun:"duration"`
	CalBookingId *string           `bun:"cal_booking_id"`
	CalMetadata  *map[string]any   `bun:"type:jsonb"`
	Status       AppointmentStatus `bun:"type:appointment_status,default:'pending'"`
	CancelledAt  *time.Time        `bun:",type:timestamptz"`
	CancelReason *string           `bun:"cancel_reason"`
	TzOffset     string            `bun:"tz_offset"`
	StatusGroup  string            `bun:",scanonly"`
	// HostAccessCode  *string           `bun:"host_access_code,type:bytea"`
	// GuestAccessCode *string           `bun:"guest_access_code,type:bytea"`
	SessionSalt     *string            `bun:"session_salt,type:bytea"`
	EncSessionKey   *string            `bun:"session_key,type:bytea"`
	SessionMetadata *SessionAccessCode `bun:",type:jsonb"`

	Tenant      *Tenant          `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
	Tutor       *Tutor           `bun:"rel:belongs-to,join:host_id=id" json:"-"`
	Attendee    *Student         `bun:"rel:belongs-to,join:attendee_id=id" json:"-"`
	Transaction *Transaction     `bun:"rel:has-one,join:id=appointment_id" json:"-"`
	Session     *TutorialSession `bun:"rel:has-one,join:id=appointment_id" json:"-"`
}

func (ct *AppointmentStatus) Scan(value interface{}) error {
	*ct = AppointmentStatus(value.([]byte))
	return nil
}

func (ct AppointmentStatus) Value() (driver.Value, error) {
	return string(ct), nil
}

func CreateAppointmentStatusType(db *bun.DB) error {
	_, err := db.Exec("CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'ongoing', 'cancelled', 'completed', 'noshow_host', 'nowshow_attendee');")
	return err
}

func createAppointmentsRLSPolicies(ctx context.Context, db *bun.DB) {
	if _, err := db.ExecContext(ctx, `
	DROP POLICY IF EXISTS "users create appointment" ON appointments;
	CREATE POLICY "users create appointment"
	ON appointments
	FOR INSERT
	TO authenticated
	WITH CHECK (
		true
		--attendee_id = NULLIF(current_setting('app.student_id', true), '')::uuid OR
		--attendee_id = NULLIF(current_setting('app.parent_id', true), '')::uuid
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}

	if _, err := db.ExecContext(ctx, `
	DROP POLICY IF EXISTS "users update appointment" ON appointments;
	CREATE POLICY "users update appointment"
	ON appointments
	FOR UPDATE
	TO authenticated
	USING (
		true
		--attendee_id = NULLIF(current_setting('app.student_id', true), '')::uuid OR
		--attendee_id = NULLIF(current_setting('app.parent_id', true), '')::uuid
	)
	WITH CHECK (
		true
		--attendee_id = NULLIF(current_setting('app.student_id', true), '')::uuid OR
		--attendee_id = NULLIF(current_setting('app.parent_id', true), '')::uuid
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}

	if _, err := db.ExecContext(ctx, `
	DROP POLICY IF EXISTS "users view appointments" ON appointments;
	CREATE POLICY "users view appointments"
	ON appointments
	FOR SELECT
	TO authenticated
	USING (
		true
		--attendee_id = NULLIF(current_setting('app.student_id', true), '')::uuid OR
		--attendee_id = NULLIF(current_setting('app.parent_id', true), '')::uuid
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}
}

func alterAppointmentsRLSPolicies(ctx context.Context, db *bun.DB) {
	if _, err := db.ExecContext(ctx, `
	DROP POLICY IF EXISTS "users create appointment" ON appointments;
	CREATE POLICY "users create appointment"
	ON appointments
	FOR INSERT
	TO authenticated
	WITH CHECK (
		--true
		host_id = NULLIF(current_setting('app.tutor_id', true), '')::uuid OR
		(
			attendee_id = NULLIF(current_setting('app.student_id', true), '')::uuid OR
			attendee_id = NULLIF(current_setting('app.parent_id', true), '')::uuid
		)
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}

	if _, err := db.ExecContext(ctx, `
	DROP POLICY IF EXISTS "users update appointment" ON appointments;
	CREATE POLICY "users update appointment"
	ON appointments
	FOR UPDATE
	TO authenticated
	USING (
		--true
		host_id = COALESCE(NULLIF(current_setting('app.tutor_id', true), '')::uuid, NULL) OR
		(
			attendee_id = COALESCE(NULLIF(current_setting('app.student_id', true), '')::uuid, NULL) OR
			attendee_id = COALESCE(NULLIF(current_setting('app.parent_id', true), '')::uuid, NULL)
		)
	)
	WITH CHECK (
		--true
		host_id = COALESCE(NULLIF(current_setting('app.tutor_id', true), '')::uuid, NULL) OR
		(
			attendee_id = COALESCE(NULLIF(current_setting('app.student_id', true), '')::uuid, NULL) OR
			attendee_id = COALESCE(NULLIF(current_setting('app.parent_id', true), '')::uuid, NULL)
		)
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}

	if _, err := db.ExecContext(ctx, `
	DROP POLICY IF EXISTS "users view appointments" ON appointments;
	CREATE POLICY "users view appointments"
	ON appointments
	FOR SELECT
	TO authenticated
	USING (
		--true
		(
			current_setting('app.appointment_id', true) IS NOT NULL AND
			id = COALESCE(NULLIF(current_setting('app.appointment_id', true), '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
		) OR
		(
			current_setting('app.appointment_id', true)::uuid IS NULL AND
			(
				host_id = COALESCE(NULLIF(current_setting('app.tutor_id', true), '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid) OR
				attendee_id = COALESCE(NULLIF(current_setting('app.student_id', true), '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid) OR
				attendee_id = COALESCE(NULLIF(current_setting('app.parent_id', true), '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			)
		)
	);
	`); err != nil {
		log.Fatalf("Failed to create policies: %v", err)
	}
}

func SetAppointmentsRLSContext(ctx context.Context, db *bun.DB) (*bun.DB, error) {
	pid := ctx.Value("pid")
	_, err := db.ExecContext(ctx, `
		SET LOCAL ROLE authenticated;
		DO $$
		DECLARE v_id uuid;
		DECLARE v_role user_role;
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

			PERFORM set_config('app.tenant_id', v_id::text, true);
			PERFORM set_config('app.user_id', v_id::text, true);
		END $$;
	`, pid)
	if err != nil {
		log.Println("Failed to set RLS context")
		return nil, err
	}
	return db, nil
}

func CreateAppointment(ctx context.Context, db *bun.DB) (*bun.DB, error) {
	if err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		tenantID, _ := uuid.Parse(ctx.Value("tenant_id").(string))
		appt := Appointment{
			TenantID: &tenantID,
		}
		_, err := tx.NewInsert().Model(&appt).Exec(ctx)
		if err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return db, nil
}
