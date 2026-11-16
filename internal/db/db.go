package db

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const DefaultDSN = "postgres://record:record@127.0.0.1:5432/record?sslmode=disable"

const maxConnectAttempts = 5

const defaultUserName = "default"

//go:embed schema.sql
var schemaTpl string

const usersDDL = `
CREATE TABLE IF NOT EXISTS public.users (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL
);
`

func Open(dsn string) (*sql.DB, error) {
	var lastErr error
	for attempt := 1; attempt <= maxConnectAttempts; attempt++ {
		database, err := sql.Open("pgx", dsn)
		if err != nil {
			lastErr = err
			log.Printf("database connection attempt %d/%d failed: %v", attempt, maxConnectAttempts, err)
			if attempt < maxConnectAttempts {
				time.Sleep(backoff(attempt))
			}
			continue
		}
		if err := database.Ping(); err != nil {
			lastErr = err
			database.Close()
			log.Printf("database connection attempt %d/%d failed: %v", attempt, maxConnectAttempts, err)
			if attempt < maxConnectAttempts {
				time.Sleep(backoff(attempt))
			}
			continue
		}
		return database, nil
	}
	return nil, fmt.Errorf("database connection failed after %d retries: %w", maxConnectAttempts, lastErr)
}

func Bootstrap(ctx context.Context, database *sql.DB, defaultUserID int64) error {
	if defaultUserID <= 0 {
		return fmt.Errorf("invalid default user id %d", defaultUserID)
	}
	if _, err := database.ExecContext(ctx, usersDDL); err != nil {
		return fmt.Errorf("create users table: %w", err)
	}
	if err := ensureUser(ctx, database, defaultUserID, defaultUserName); err != nil {
		return err
	}
	return EnsureUserSchema(ctx, database, defaultUserID)
}

func ensureUser(ctx context.Context, database *sql.DB, id int64, name string) error {
	var exists int
	err := database.QueryRowContext(ctx, `SELECT 1 FROM public.users WHERE id = $1`, id).Scan(&exists)
	if err == nil {
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}
	_, err = database.ExecContext(ctx,
		`INSERT INTO public.users (id, name, created_at)
		 OVERRIDING SYSTEM VALUE
		 VALUES ($1, $2, $3)`,
		id, name, time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		return fmt.Errorf("insert default user: %w", err)
	}
	_, err = database.ExecContext(ctx, `
		SELECT setval(
			pg_get_serial_sequence('public.users', 'id'),
			GREATEST((SELECT MAX(id) FROM public.users), 1)
		)`)
	if err != nil {
		return fmt.Errorf("sync users sequence: %w", err)
	}
	return nil
}

func EnsureUserSchema(ctx context.Context, database *sql.DB, userID int64) error {
	name := SchemaName(userID)
	if err := ValidateSchemaName(name); err != nil {
		return err
	}
	quoted := QuoteIdent(name)
	if _, err := database.ExecContext(ctx, `CREATE SCHEMA IF NOT EXISTS `+quoted); err != nil {
		return fmt.Errorf("create schema %s: %w", name, err)
	}
	ddl := strings.ReplaceAll(schemaTpl, "__SCHEMA__", quoted)
	if _, err := database.ExecContext(ctx, ddl); err != nil {
		return fmt.Errorf("apply schema %s: %w", name, err)
	}
	return nil
}

func backoff(attempt int) time.Duration {
	return time.Duration(1<<uint(attempt-1)) * time.Second
}
