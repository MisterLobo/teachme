package lib

import (
	"os"

	"github.com/hibiken/asynq"
	"github.com/misterlobo/teachme/src/utils"
)

var cli *asynq.Client

func GetTaskClient() *asynq.Client {
	/* if cli != nil {
		return cli
	} */
	redisAddr := os.Getenv("REDIS_HOST")
	redisPass := os.Getenv("REDIS_PASSWORD")

	tlsConfig, _ := utils.GetTLSConfig()
	asynqclient := asynq.NewClient(asynq.RedisClientOpt{
		Addr:      redisAddr,
		Password:  redisPass,
		TLSConfig: tlsConfig,
	})

	cli = asynqclient
	return cli
}
