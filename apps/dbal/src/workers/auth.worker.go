package workers

import (
	"context"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/models"
)

const (
	AuthCaching = "auth.caching"
)

type AuthCachingWorkerArgs struct {
	PID  uuid.UUID
	ID   uuid.UUID
	Role models.UserRole
}
type AuthCachingWorker struct {
	Name string
}

func (s *AuthCachingWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	// var p *BookingCreateWorkerArgs

	return nil
}
