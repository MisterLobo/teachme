package models

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type TutorBoost struct {
	bun.BaseModel
	Timestamps
	ID            uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	TutorID       uuid.UUID `bun:",type:uuid"`
	BoostStart    time.Time
	BoostEnd      time.Time
	BoostDuration uint

	Tutor *Tutor `gorm:"foreignKey:tutor_id" json:"-"`
}

/* func (m *TutorBoost) name() string {
	return "tutor_boosts"
} */

func createTutorBoostRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "allow tutors to create boosts" ON tutor_boosts;
			CREATE POLICY "allow tutors to create boosts"
			ON tutor_boosts
			FOR INSERT
			TO authenticated
			WITH CHECK (
				tutor_id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
		`); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "allow tutors to view their boosts" ON tutor_boosts;
			CREATE POLICY "allow tutors to view their boosts"
			ON tutor_boosts
			FOR SELECT
			TO authenticated
			USING (
				tutor_id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
		`); err != nil {
			return err
		}

		return nil
	})
}
