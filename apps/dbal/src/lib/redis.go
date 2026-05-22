package lib

import (
	"context"
	"os"
	"time"

	"github.com/gofiber/fiber/v3/log"
	"github.com/misterlobo/teachme/src/utils"
	"github.com/redis/go-redis/v9"
)

var redisClient *redis.Client

func GetRedisClient(ctx context.Context) *redis.Client {
	if redisClient != nil {
		return redisClient
	}
	redisAddr := os.Getenv("REDIS_URL")
	redisPass := os.Getenv("REDIS_PASSWORD")
	opt, err := redis.ParseURL(redisAddr)
	if err != nil {
		log.Fatalf("[redis] failed to establish connection: %v", err)
	}
	opt.Password = redisPass
	tlsConfig, err := utils.GetTLSConfig()
	if err != nil {
		log.Fatalf("[redis] error configuring TLS: %v", err)
	}
	opt.TLSConfig = tlsConfig
	_cli := redis.NewClient(opt)
	_cli.Set(ctx, "testkey", "testvalue", 5*time.Minute)
	_cli.Set(ctx, "key5m", "testvalue", 5*time.Minute)
	redisClient = _cli
	log.Info("[redis] connection established!\n")
	return _cli
}
