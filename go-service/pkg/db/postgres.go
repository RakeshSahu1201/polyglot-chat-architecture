package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	_ "github.com/lib/pq"
	"github.com/polyglot-chat/go-service/ent"
)

// Client is the global ent client shared by both services.
var Client *ent.Client

// InitPostgres opens the database connection via ent and runs auto-migration.
func InitPostgres(ctx context.Context) error {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("PG_HOST"),
		os.Getenv("PG_PORT"),
		os.Getenv("PG_USER"),
		os.Getenv("PG_PASSWORD"),
		os.Getenv("PG_DB"),
		os.Getenv("PG_SSLMODE"),
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("sql.Open: %w", err)
	}

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("postgres ping: %w", err)
	}

	drv := entsql.OpenDB(dialect.Postgres, db)
	Client = ent.NewClient(ent.Driver(drv))

	// Auto-migrate: create/alter tables to match the ent schema.
	if err := Client.Schema.Create(ctx); err != nil {
		return fmt.Errorf("ent auto-migrate: %w", err)
	}

	return nil
}
