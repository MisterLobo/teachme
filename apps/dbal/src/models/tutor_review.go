package models

import (
	"context"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type TutorReview struct {
	bun.BaseModel
	Timestamps
	ID           uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	TenantID     uuid.UUID `bun:",type:uuid"`
	TutorID      uuid.UUID `bun:",type:uuid"`
	SessionID    uuid.UUID `bun:",type:uuid"`
	ReviewerID   uuid.UUID `bun:",type:uuid"`
	ReviewerType string
	Comments     *string
	RatingStars  *uint

	Tenant   *Tenant          `gorm:"foreignKey:tenant_id" json:"-"`
	Tutor    *Tutor           `gorm:"foreignKey:tutor_id" json:"-"`
	Session  *TutorialSession `gorm:"foreignKey:session_id" json:"-"`
	Reviewer *Customer        `gorm:"foreignKey:reviewer_id" json:"-"`
}

/* func (m *TutorReview) name() string {
	return "tutor_reviews"
} */

func createTutorReviewRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "allow users to create reviews" ON tutor_reviews;
			CREATE POLICY "allow users to create reviews"
			ON tutor_reviews
			FOR INSERT
			TO authenticated
			WITH CHECK (
				(
					reviewer_id = COALESCE(current_setting('app.student_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) OR
					reviewer_id = COALESCE(current_setting('app.parent_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				) AND
				session_id = COALESCE(current_setting('app.session_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
		`); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "allow users to view reviews" ON tutor_reviews;
			CREATE POLICY "allow users to view reviews"
			ON tutor_reviews
			FOR SELECT
			TO authenticated
			USING (
				(
					tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) AND
					tutor_id = COALESCE(current_setting('app.host_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				) OR
				(
					reviewer_id = COALESCE(current_setting('app.student_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid) OR
					reviewer_id = COALESCE(current_setting('app.parent_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
				)
			);
		`); err != nil {
			return err
		}

		return nil
	})
}
