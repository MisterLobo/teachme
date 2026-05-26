package boot

import (
	"context"
	"log"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/misterlobo/teachme/src/lib"
)

func InitScheduler(ctx context.Context) context.Context {
	sched := lib.GetScheduler()
	job, err := sched.NewJob(
		gocron.DurationJob(12*time.Hour),
		gocron.NewTask(
			func(a string, b int) {
				log.Printf("%s %d", a, b)
			},
			"hello",
			1,
		),
	)
	if err != nil {
		log.Fatalf("Could not create job: %v", err)
	}
	log.Printf("New job: %s", job.ID())
	go sched.Start()

	ctx = context.WithValue(ctx, "cron", sched)
	return ctx
}
