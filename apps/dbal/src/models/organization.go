package models

import (
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Organization struct {
	bun.BaseModel
	Timestamps
	ID           uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	Name         string
	ContactEmail string
	TenantID     uuid.UUID `bun:",type:uuid"`
	Size         uint

	Tenant       *Tenant       `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
	Subscription *Subscription `bun:"rel:has-one,join:id=id" json:"-"`
}

/* func (m *Organization) name() string {
	return "organizations"
} */
