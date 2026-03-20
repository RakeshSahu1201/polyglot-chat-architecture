package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/polyglot-chat/go-service/internal/auth"
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
	log.Println("Auth Service: PostgreSQL connected")

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

	authGroup := r.Group("/auth")
	{
		authGroup.POST("/register", auth.Register)
		authGroup.POST("/login", auth.Login)
		authGroup.GET("/me", middleware.Auth(), auth.Me)
	}

	// Unprotected route to get all users for the sidebar directory
	r.GET("/users", auth.GetUsersHandler)

	port := os.Getenv("AUTH_PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Auth Service running on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
