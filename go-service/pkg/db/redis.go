package db

import (
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"
)

var Redis *redis.Client

func InitRedis() error {
	opt, err := redis.ParseURL(os.Getenv("REDIS_URL"))
	if err != nil {
		return fmt.Errorf("redis ParseURL: %w", err)
	}
	Redis = redis.NewClient(opt)
	return nil
}
