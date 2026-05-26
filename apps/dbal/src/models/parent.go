package models

import (
	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type Parent struct {
	bun.BaseModel
	Timestamps
	ID         uuid.UUID `bun:"id,pk,type:uuid,default:gen_random_uuid()"`
	FirstName  string
	LastName   string
	Dob        *string
	Sex        *string
	NumChild   uint
	CustomerID *uuid.UUID `bun:",type:uuid"`
	Country    string
	Currency   string
	Language   string
	Locale     *string

	Customer     Customer      `bun:"rel:belongs-to,join:customer_id=id" json:"-"`
	Children     []*Student    `bun:"rel:has-many,join:id=parent_id" json:"-"`
	Subscription *Subscription `bun:"rel:has-one,join:id=id" json:"-"`
}

/* func (m *Parent) name() string {
	return "parents"
} */
