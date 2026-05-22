package models

import (
	"database/sql/driver"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type CreditUsageStatus string

const (
	UsageSuccess   CreditUsageStatus = "success"
	UsagePending   CreditUsageStatus = "pending"
	UsageCancelled CreditUsageStatus = "cancelled"
	UsageRefunded  CreditUsageStatus = "refunded"
)

type CreditUsage struct {
	bun.BaseModel
	Timestamps
	ID       uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	TenantID uuid.UUID `bun:",type:uuid"`
	UserID   uuid.UUID `bun:",type:uuid"`
	Amount   uint
	Purpose  *string
	Status   CreditUsageStatus `bun:"type:credit_usage_status,default:'pending'" json:"status"`

	Tenant       *Tenant   `bun:"rel:belongs-to,join:tenant_id=id" json:"-"`
	TenantUser   *Tenant   `bun:"rel:belongs-to,join:user_id=id" json:"-"`
	CustomerUser *Customer `bun:"rel:belongs-to,join:user_id=id" json:"-"`
}

/* func (m *CreditUsage) name() string {
	return "credit_usage"
} */

func (ct *CreditUsageStatus) Scan(value interface{}) error {
	*ct = CreditUsageStatus(value.([]byte))
	return nil
}

func (ct CreditUsageStatus) Value() (driver.Value, error) {
	return string(ct), nil
}

func CreateCreditUsageStatusType(db *bun.DB) error {
	_, err := db.Exec("CREATE TYPE credit_usage_status AS ENUM ('success', 'pending', 'cancelled', 'refunded');")
	return err
}
