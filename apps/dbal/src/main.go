package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"flag"

	"github.com/gofiber/contrib/v3/circuitbreaker"
	jwtware "github.com/gofiber/contrib/v3/jwt"
	"github.com/gofiber/fiber/v3"
	_ "github.com/gofiber/fiber/v3/client"
	"github.com/gofiber/fiber/v3/extractors"
	"github.com/gofiber/fiber/v3/log"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/healthcheck"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/idempotency"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/gofiber/fiber/v3/middleware/logger"
	recoverer "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/gofiber/fiber/v3/middleware/responsetime"
	"github.com/gofiber/storage/redis/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"
	"github.com/misterlobo/teachme/src/boot"
	"github.com/misterlobo/teachme/src/cmd"
	"github.com/misterlobo/teachme/src/db"
	"github.com/misterlobo/teachme/src/lib"
	"github.com/misterlobo/teachme/src/workers"
	redigo "github.com/redis/go-redis/v9"
	"github.com/spf13/cobra"
	"github.com/stripe/stripe-go/v85"
	"github.com/stripe/stripe-go/v85/webhook"
)

type SampleTaskPayload struct {
	UserID string
	Name   string
}

func main() {
	var cli bool
	command := cobra.Command{
		Use:              "serve or cmd",
		Args:             cobra.MatchAll(cobra.ExactArgs(1), cobra.OnlyValidArgs),
		TraverseChildren: true,
		Run: func(cmd *cobra.Command, args []string) {
			cmd.Flags().BoolVarP(&cli, "cli", "s", false, "start server")
		},
	}
	command.Execute()
	if cli {
		cmd.Execute()
		return
	}
	srvMain()
}

func srvMain() {
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Could not load environment: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	redisAddr := os.Getenv("REDIS_HOST")

	boot.InitContext(ctx)

	//------------------| Scheduler |------------------
	// boot.InitScheduler(ctx)
	//------------------| NATS |------------------
	// boot.InitEventBus(ctx)
	//------------------| asynq |------------------
	// boot.InitTaskQueue(ctx)
	//------------------| Redis storage |------------------
	client := redigo.NewUniversalClient(&redigo.UniversalOptions{
		Addrs:    []string{redisAddr},
		Password: os.Getenv("REDIS_PASSWORD"),
	})
	store := redis.NewFromConnection(client)
	store.Set("teststorage", []byte("test"), 30*time.Minute)

	//------------------| Fiber |------------------
	app := fiber.New(fiber.Config{
		AppName:  "TeachMe DBAL",
		Services: []fiber.Service{},
	})
	app.Use(limiter.New())
	app.Use(responsetime.New())
	app.Use(idempotency.New(idempotency.Config{
		Lifetime: 5 * time.Minute,
		Storage:  store,
	}))
	app.Use(requestid.New())
	app.Use(logger.New())
	app.Use(recoverer.New())
	app.Use(helmet.New())
	app.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			return true
		},
		AllowCredentials: true,
	}))
	cb := circuitbreaker.New(circuitbreaker.DefaultConfig)
	app.Use(circuitbreaker.Middleware(cb))

	app.Get(healthcheck.LivenessEndpoint, healthcheck.New())
	app.Get(healthcheck.ReadinessEndpoint, healthcheck.New(healthcheck.Config{
		Probe: func(c fiber.Ctx) bool {
			return true
		},
	}))
	app.Get(healthcheck.StartupEndpoint, healthcheck.New())

	app.Get("/", func(c fiber.Ctx) error {
		return c.SendString("Hello, world")
	})
	app.Post("/webhook/stripe", func(c fiber.Ctx) error {
		body := c.Body()
		whsec := os.Getenv("STRIPE_WEBHOOK_SECRET")
		event, err := webhook.ConstructEvent(body, c.Get("Stripe-Signature"), whsec)
		if err != nil {
			log.Errorf("Error verifying webhook signature: %s\n", err.Error())
			return c.SendStatus(http.StatusBadRequest)
		}
		log.Infof("[StripeEvent] %s\n", event.Type)
		switch event.Type {
		case "payment_intent.created":
			var pi stripe.PaymentIntent
			err := json.Unmarshal(event.Data.Raw, &pi)
			if err != nil {
				log.Errorf("[Stripe] Error parsing PaymentIntent: %s\n", err.Error())
				break
			}
		case "customer.created":
			break
		case "account.created":
			break
		case "customer.subscription.created":
			break
		case "payment_intent.succeeded":
			var pi stripe.PaymentIntent
			if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
				log.Errorf("[WEBHOOK] Error parsing PaymentIntent: %s", err)
				break
			}

			log.Infof("[stripe:payment_intent.paid] PaymentIntent: %T %#v", pi, pi)

			tc := lib.GetTaskClient()
			defer tc.Close()

			args := workers.PaymentConfirmedWorkerArgs{
				EventID:  event.ID,
				In:       pi,
				CacheKey: fmt.Sprintf("payment:%s:%s", event.ID, pi.ID),
			}
			paymentPayload, err := json.Marshal(args)
			if err != nil {
				log.Errorf("error starting worker: %s", workers.PaymentConfirmed)
				return c.SendStatus(500)
			}
			rc := lib.GetRedisClient(ctx)
			if _, err := rc.JSONSet(ctx, args.CacheKey, "$", pi).Result(); err != nil {
				log.Errorf("[WEBHOOK] failed to write data to cache: %v", err)
				return c.SendStatus(500)
			}
			log.Infof("[asynq] queuing task: %s", workers.PaymentConfirmed)
			paymentTask := asynq.NewTask(workers.PaymentConfirmed, paymentPayload)
			_, err = tc.Enqueue(paymentTask, asynq.Queue("critical"))
			if err != nil {
				log.Errorf("[asynq] could not enqueue task: %v", err)
				return c.SendStatus(500)
			}
		}
		return c.SendStatus(200)
	}).Post("/webhook/cal", func(c fiber.Ctx) error {
		body := c.Body()
		var jbody map[string]any
		json.Unmarshal(body, &jbody)
		log.Infof("json body: %v", jbody)
		return c.SendStatus(200)
	})

	api := app.Group("/api", func(ctx fiber.Ctx) error {
		user := jwtware.FromContext(ctx)
		if user == nil {
			return fiber.ErrUnauthorized
		}
		claims := user.Claims.(jwt.MapClaims)
		name := claims["name"].(string)
		return ctx.SendString("welcome " + name)
	})
	api.Use(jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(os.Getenv("JWT_SECRET"))},
		Extractor:  extractors.FromAuthHeader("Bearer"),
	}))

	go func() {
		log.Fatal(app.Listen(":7890", fiber.ListenConfig{
			CertFile:    "./certs/new/localhost.san.pem",
			CertKeyFile: "./certs/new/san-key.pem",
		}))
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	<-quit
	log.Info("shutting down server")

	log.Info("Closing NATS connection")
	nats, _, _ := lib.GetNatsInstance()
	nats.Close()

	log.Info("Closing Redis connection")
	rd := lib.GetRedisClient(ctx)
	rd.Close()

	log.Info("Closing Qdrant connection")
	qd, _ := lib.GetQdrantClient(ctx)
	qd.Close()

	log.Info("Closing Neo4j connection")
	neo, _ := lib.GetGraphDb(ctx)
	(*neo).Close(ctx)

	log.Info("Closing DB connection")
	db := db.GetDb()
	db.Close()

	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Errorf("shutdown error: %v", err)
		log.Fatalf("Could not shutdown properly")
	}
	log.Info("server shutdown completed")
}

var migrateFlag bool
var resetFlag bool

func init() {
	flag.BoolVar(&migrateFlag, "migrate", false, "whether to run migrations")
	flag.BoolVar(&resetFlag, "reset", false, "whether to reset db")
}
