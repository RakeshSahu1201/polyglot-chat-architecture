package db

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	MongoClient   *mongo.Client
	MongoDatabase *mongo.Database
)

func InitMongo(ctx context.Context) error {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		uri = "mongodb://127.0.0.1:27017/chat"
	}

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return fmt.Errorf("mongo connect: %w", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("mongo ping: %w", err)
	}

	dbName := os.Getenv("MONGO_DB")
	if dbName == "" {
		dbName = mongoDatabaseNameFromURI(uri)
	}
	if dbName == "" {
		dbName = "chat"
	}

	MongoClient = client
	MongoDatabase = client.Database(dbName)
	return nil
}

func mongoDatabaseNameFromURI(uri string) string {
	parsed, err := url.Parse(uri)
	if err != nil {
		return ""
	}

	name := strings.Trim(parsed.Path, "/")
	if idx := strings.Index(name, "?"); idx >= 0 {
		name = name[:idx]
	}
	return name
}
