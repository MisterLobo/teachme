package boot

import (
	"context"
	"os"

	"github.com/gofiber/fiber/v3/log"
	"github.com/misterlobo/teachme/src/lib"
)

func InitContext(ctx context.Context) context.Context {
	createVaultKeys(ctx)

	if os.Getenv("RESET_DB") == "true" {
		InitDB(ctx)
	}
	RunDBUpdates(ctx)

	ctx = InitEventBus(ctx)
	ctx = InitScheduler(ctx)

	asynqclient := InitTaskQueue(ctx)
	ctx = context.WithValue(ctx, "task", asynqclient)

	vault, _ := lib.GetVault(ctx)
	ctx = context.WithValue(ctx, "vault", vault)

	vecdb, _ := lib.GetQdrantClient(ctx)
	ctx = context.WithValue(ctx, "vecdb", vecdb)

	graph, _ := lib.GetGraphDb(ctx)
	if err := lib.CreateGraphSchema(ctx, *graph); err != nil {
		log.Fatalf("[CRITICAL] failed to initialize Graph: %v", err)
	}
	ctx = context.WithValue(ctx, "graph", graph)

	cache := lib.GetRedisClient(ctx)
	ctx = context.WithValue(ctx, "cache", cache)

	go StartGrpcServer(ctx)

	lib.LoadStripe()

	return ctx
}

func createVaultKeys(ctx context.Context) error {
	return nil
}
