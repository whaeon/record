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

	"github.com/whaeon/record/internal/auth"
)

const DefaultDSN = "postgres://record:record@127.0.0.1:5432/record?sslmode=disable"

const maxConnectAttempts = 5

const defaultDisplayName = "admin"

//go:embed schema.sql
var schemaTpl string

const usersDDL = `
CREATE TABLE IF NOT EXISTS public.users (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name TEXT NOT NULL,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL
);
`

const usersMigrateDDL = `
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON public.users (username) WHERE username <> '';
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

type BootstrapOpts struct {
	UserID      int64
	Username    string
	Password    string
	DisplayName string
}

func Bootstrap(ctx context.Context, database *sql.DB, opts BootstrapOpts) error {
	if opts.UserID <= 0 {
		return fmt.Errorf("invalid default user id %d", opts.UserID)
	}
	if strings.TrimSpace(opts.Password) == "" {
		return fmt.Errorf("INITIAL_PASSWORD is required")
	}
	username := strings.TrimSpace(opts.Username)
	if username == "" {
		username = "admin"
	}
	display := strings.TrimSpace(opts.DisplayName)
	if display == "" {
		display = defaultDisplayName
	}
	if _, err := database.ExecContext(ctx, usersDDL); err != nil {
		return fmt.Errorf("create users table: %w", err)
	}
	if _, err := database.ExecContext(ctx, usersMigrateDDL); err != nil {
		return fmt.Errorf("migrate users table: %w", err)
	}
	if err := ensureUser(ctx, database, opts.UserID, username, display); err != nil {
		return err
	}
	if err := seedPassword(ctx, database, opts.UserID, username, opts.Password); err != nil {
		return err
	}
	return EnsureUserSchema(ctx, database, opts.UserID)
}

func ensureUser(ctx context.Context, database *sql.DB, id int64, username, name string) error {
	var exists int
	err := database.QueryRowContext(ctx, `SELECT 1 FROM public.users WHERE id = $1`, id).Scan(&exists)
	if err == nil {
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}
	_, err = database.ExecContext(ctx,
		`INSERT INTO public.users (id, name, username, password_hash, created_at)
		 OVERRIDING SYSTEM VALUE
		 VALUES ($1, $2, $3, '', $4)`,
		id, name, username, time.Now().UTC().Format(time.RFC3339),
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

func seedPassword(ctx context.Context, database *sql.DB, id int64, username, password string) error {
	var hash string
	err := database.QueryRowContext(ctx, `SELECT password_hash FROM public.users WHERE id = $1`, id).Scan(&hash)
	if err != nil {
		return fmt.Errorf("read password_hash: %w", err)
	}
	if hash != "" {
		return nil
	}
	hashed, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	_, err = database.ExecContext(ctx,
		`UPDATE public.users SET username = $1, password_hash = $2 WHERE id = $3 AND password_hash = ''`,
		username, hashed, id,
	)
	if err != nil {
		return fmt.Errorf("seed password: %w", err)
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
