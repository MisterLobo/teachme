package boot

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/misterlobo/teachme/src/workers"
)

type SampleTaskPayload struct {
	UserID string
	Name   string
}

func InitTaskQueue(ctx context.Context) *asynq.Client {
	redisAddr := os.Getenv("REDIS_HOST")
	redisPass := os.Getenv("REDIS_PASSWORD")

	tlsConfig, _ := utils.GetTLSConfig()
	srv := asynq.NewServer(
		asynq.RedisClientOpt{
			Addr:      redisAddr,
			Username:  "default",
			Password:  redisPass,
			TLSConfig: tlsConfig,
		},
		asynq.Config{
			Concurrency: 20,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
		},
	)
	mux := asynq.NewServeMux()
	mux.HandleFunc("stripe:payments", func(ctx context.Context, t *asynq.Task) error {
		var p SampleTaskPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
		}
		log.Printf("Received message from %s", p.Name)
		return nil
	})
	registerWorkers(ctx, mux)
	asynqSrv := func() {
		if err := srv.Run(mux); err != nil {
			log.Fatalf("could not run server: %v", err)
		}
		log.Println("[asynq] server is running")
	}
	go asynqSrv()

	sampleTask := func() (*asynq.Task, error) {
		payload, err := json.Marshal(SampleTaskPayload{
			UserID: "12345",
			Name:   "User",
		})
		if err != nil {
			return nil, err
		}
		return asynq.NewTask("stripe:payments", payload), nil
	}
	/* asynqclient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:      redisAddr,
		Password:  redisPass,
		TLSConfig: tlsConfig,
	}) */
	asynqclient := lib.GetTaskClient()
	defer asynqclient.Close()

	task, err := sampleTask()
	if err != nil {
		log.Fatalf("could not create task: %v", err)
	}
	_, err = asynqclient.Enqueue(task, asynq.Queue("critical"))
	if err != nil {
		log.Fatalf("could not enqueue task: %v", err)
	}
	return asynqclient
}

func registerWorkers(ctx context.Context, mux *asynq.ServeMux) {
	ctx = context.WithValue(ctx, "mux", mux)
	wstripe := workers.StripeAccountsCreateWorker{
		Name: "StripeAccountsCreateWorker",
	}
	ctx = context.WithValue(ctx, "redis", lib.GetRedisClient(ctx))
	mux.HandleFunc(workers.StripeAccountsCreate, wstripe.HandleWork)

	wcal := workers.CalAccountsCreateWorker{
		Name: "CalAccountsCreateWorker",
	}
	mux.HandleFunc(workers.CalAccountsCreate, wcal.HandleWork)

	wscus := workers.StripeCustomerCreateWorker{
		Name: "StripeCustomerCreateWorker",
	}
	mux.HandleFunc(workers.StripeCustomersCreate, wscus.HandleWork)

	wssub := workers.StripeSubscriptionCreateWorker{
		Name: "StripeSubscriptionCreateWorker",
	}
	mux.HandleFunc(workers.StripeSubscriptionsCreate, wssub.HandleWork)

	wembed := workers.TutorEmbeddingCreateWorker{
		Name: "TutorEmbeddingCreateWorker",
	}
	mux.HandleFunc(workers.TutorEmbeddingsCreate, wembed.HandleWork)

	wpayment := workers.PaymentConfirmedWorker{
		Name: "PaymentConfirmedWorker",
	}
	mux.HandleFunc(workers.PaymentConfirmed, wpayment.HandleWork)
}
