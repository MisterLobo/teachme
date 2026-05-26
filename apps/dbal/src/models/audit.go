package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type AuditLog struct {
	bun.BaseModel
	ID           uuid.UUID  `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Timestamp    *time.Time `bun:",type:timestamptz"`
	UserID       uuid.UUID
	SessionID    uuid.UUID
	Action       string
	ConsentFlags map[string]any `bun:",type:jsonb"`
	MetadatHash  string
	Signature    string
}
