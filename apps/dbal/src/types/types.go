package types

import (
	"time"

	"github.com/google/uuid"
)

type AnyMap map[string]any

type EventMessagePayload struct {
	Service string
	Channel string
	Payload any
}

type EventMessage struct {
	EventID     string     `json:"eventId"`
	UID         uuid.UUID  `json:"uid"`
	ServiceName string     `json:"serviceName"`
	Channel     string     `json:"channel"`
	Timestamp   *time.Time `json:"timestamp"`
	Payload     *AnyMap    `json:"payload"`
}
