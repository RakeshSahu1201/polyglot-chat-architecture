package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

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

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("pgxpool.New: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("postgres ping: %w", err)
	}

	Pool = pool
	return nil
}

// Migrate creates all required tables if they don't exist.
func Migrate(ctx context.Context) error {
	queries := []string{
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

		`CREATE TABLE IF NOT EXISTS users (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name        TEXT UNIQUE NOT NULL,
			password    TEXT NOT NULL,
			created_at  TIMESTAMPTZ DEFAULT now()
		)`,

		`CREATE TABLE IF NOT EXISTS channels (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name        TEXT NOT NULL,
			type        TEXT NOT NULL DEFAULT 'open',
			invite_code TEXT UNIQUE NOT NULL,
			owner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
			created_at  TIMESTAMPTZ DEFAULT now()
		)`,

		`CREATE TABLE IF NOT EXISTS channel_members (
			channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
			user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
			joined_at   TIMESTAMPTZ DEFAULT now(),
			PRIMARY KEY (channel_id, user_id)
		)`,

		`CREATE TABLE IF NOT EXISTS channel_messages (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
			user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
			user_name   TEXT NOT NULL,
			body        TEXT,
			media_url   TEXT,
			created_at  TIMESTAMPTZ DEFAULT now()
		)`,
	}

	for _, q := range queries {
		if _, err := Pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}
