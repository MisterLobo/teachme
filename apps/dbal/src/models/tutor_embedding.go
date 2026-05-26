package models

import (
	"context"

	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"
	"github.com/pgvector/pgvector-go"
	"github.com/uptrace/bun"
)

type TutorEmbedding struct {
	bun.BaseModel
	Timestamps
	ID        uuid.UUID         `bun:",pk,type:uuid"`
	Embedding []pgvector.Vector `bun:"type:vector(384)[]"`
}

/* func (m *TutorEmbedding) name() string {
	return "tutor_embeddings"
} */

func createTutorEmbeddingsRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "tutors can create embedding" ON tutor_embeddings;
			CREATE POLICY "tutors can create embedding"
			ON tutor_embeddings
			FOR INSERT
			TO authenticated
			WITH CHECK (
				--true
				id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
	`); err != nil {
			log.Errorf("[TutorEmbeddings] error creating RLS policies: %v", err)
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			DROP POLICY IF EXISTS "tutors view own embedding" ON tutor_embeddings;
			CREATE POLICY "tutors view own embedding"
			ON tutor_embeddings
			FOR SELECT
			TO authenticated
			USING (
				--true
				id = COALESCE(current_setting('app.tutor_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
			);
	`); err != nil {
			log.Errorf("[TutorEmbeddings] error creating RLS policies: %v", err)
			return err
		}
		return nil
	})
}
