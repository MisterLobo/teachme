package workers

import (
	"context"

	"github.com/hibiken/asynq"
	bookingpb "github.com/misterlobo/teachme/generated/v1/booking"
)

const (
	BookingCreate = "bookings.create"
)

type BookingCreateWorkerArgs struct {
	in *bookingpb.BookingCreate
}
type BookingCreateWorker struct {
	Name string
}

func (s *BookingCreateWorker) HandleWork(ctx context.Context, t *asynq.Task) error {
	// var p *BookingCreateWorkerArgs

	return nil
}
