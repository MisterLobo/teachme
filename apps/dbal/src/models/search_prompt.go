package models

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/pgvector/pgvector-go"
	"github.com/uptrace/bun"
)

type SearchPrompt struct {
	bun.BaseModel
	Timestamps
	ID        uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	RequestID *uuid.UUID `bun:",type:uuid"`
	Prompt    string
	Embedding []pgvector.Vector `bun:"type:vector(384)[]"`
}

func createSearchPromptssRLSPolicies(ctx context.Context, db *bun.DB) error {
	return db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students select own prompts" ON search_promps;
		CREATE POLICY "students select own prompts"
		ON search_promps
		FOR SELECT
		TO authenticated
		USING (
			request_id = COALESCE(current_setting('app.student_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
		);
	`); err != nil {
			log.Fatalf("Failed to create policies")
		}

		if _, err := tx.ExecContext(ctx, `
		DROP POLICY IF EXISTS "students can save prompts" ON search_promps;
		CREATE POLICY "students can save prompts"
		ON search_promps
		FOR INSERT
		TO authenticated
		WITH CHECK (
			request_id = NULLIF(current_setting('app.student_id', true))::uuid
		);
	`); err != nil {
			return err
		}

		return nil
	})
}
