package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/polyglot-chat/go-service/internal/auth"
	"github.com/polyglot-chat/go-service/internal/channels"
	"github.com/polyglot-chat/go-service/pkg/db"
	"github.com/polyglot-chat/go-service/pkg/middleware"
)

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file, reading from environment")
	}

	ctx := context.Background()

	// PostgreSQL
	if err := db.InitPostgres(ctx); err != nil {
		log.Fatalf("postgres init: %v", err)
	}
	defer db.Pool.Close()
	log.Println("PostgreSQL connected")

	// Run migrations
	if err := db.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("Migrations applied")

	// Redis
	if err := db.InitRedis(); err != nil {
		log.Fatalf("redis init: %v", err)
	}
	log.Println("Redis connected")

	// Gin router
	r := gin.Default()

	// CORS — allow frontend origin
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

	// ── Auth routes (public) ─────────────────────────────────
	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", auth.Register)
		authGroup.POST("/login", auth.Login)
		authGroup.GET("/me", middleware.Auth(), auth.Me)
	}

	// ── Channel routes (protected) ───────────────────────────
	chanGroup := r.Group("/channels", middleware.Auth())
	{
		chanGroup.POST("", channels.CreateChannelHandler)
		chanGroup.POST("/join", channels.JoinChannelHandler)
		chanGroup.GET("", channels.ListUserChannelsHandler)
		chanGroup.GET("/:id/messages", channels.GetMessagesHandler)
	}

	// ── WebSocket (auth via ?token= query param) ─────────────
	r.GET("/ws/channels/:id", channels.WsHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Go service running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
