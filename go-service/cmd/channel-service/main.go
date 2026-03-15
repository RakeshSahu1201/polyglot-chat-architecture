package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/polyglot-chat/go-service/internal/channels"
	"github.com/polyglot-chat/go-service/pkg/db"
	"github.com/polyglot-chat/go-service/pkg/middleware"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file, reading from environment")
	}

	ctx := context.Background()

	// PostgreSQL
	if err := db.InitPostgres(ctx); err != nil {
		log.Fatalf("postgres init: %v", err)
	}
	defer db.Pool.Close()
	log.Println("Channel Service: PostgreSQL connected")

	// Redis
	if err := db.InitRedis(); err != nil {
		log.Fatalf("redis init: %v", err)
	}
	log.Println("Channel Service: Redis connected")

	r := gin.Default()

	// CORS
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", os.Getenv("CORS_ORIGIN"))
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	chanGroup := r.Group("/channels", middleware.Auth())
	{
		chanGroup.POST("", channels.CreateChannelHandler)
		chanGroup.POST("/join", channels.JoinChannelHandler)
		chanGroup.GET("", channels.ListUserChannelsHandler)
		chanGroup.GET("/:id/messages", channels.GetMessagesHandler)
	}

	// WebSocket
	r.GET("/ws/channels/:id", channels.WsHandler)

	port := os.Getenv("CHANNEL_PORT")
	if port == "" {
		port = "8081"
	}
	log.Printf("Channel Service running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
