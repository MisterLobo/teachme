package models

import (
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Purchase struct {
	bun.BaseModel
	Timestamps
	ID            uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	UnitAmount    float64
	Qty           uint
	Total         float64
	ServiceFee    float64
	TransactionID *uuid.UUID `bun:",type:uuid"`
	TenantID      *uuid.UUID `bun:",type:uuid"`

	Transaction *Transaction `bun:"rel:belongs-to,join:transaction_id=id" json:"-"`
	Tenant      *Tenant      `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
}

/* func (m *Purchase) name() string {
	return "purchases"
} */
