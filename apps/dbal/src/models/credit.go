package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Credit struct {
	bun.BaseModel
	Timestamps
	ID          uuid.UUID `bun:"id,pk,type:uuid"`
	OwnerType   UserRole  `bun:",type:user_role"`
	Amount      uint
	ExpiresAt   *time.Time
	Description *string

	TenantOwner   *Tenant   `bun:"rel:belongs-to,join:id=id" json:"-"`
	CustomerOwner *Customer `bun:"rel:belongs-to,join:id=id" json:"-"`
}

/* func (m *Credit) name() string {
	return "credits"
} */
