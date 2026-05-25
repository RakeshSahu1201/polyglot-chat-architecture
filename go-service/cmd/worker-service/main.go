package main

import (
	"context"

	"github.com/joho/godotenv"
	"github.com/polyglot-chat/go-service/internal/worker"
	"github.com/polyglot-chat/go-service/pkg/db"
	"github.com/polyglot-chat/go-service/pkg/logs"
)

func main() {
	if err := godotenv.Load(); err != nil {
		logs.Info("worker service: no .env file, reading from environment")
	}

	ctx := context.Background()

	if err := db.InitPostgres(ctx); err != nil {
		panic(err)
	}
	logs.Info("worker service: PostgreSQL connected")

	if err := db.InitMongo(ctx); err != nil {
		panic(err)
	}
	logs.Info("worker service: MongoDB connected")

	service := worker.NewService()
	service.Start(ctx)

	logs.Info("worker service: cleanup loops running")
	select {}
}
