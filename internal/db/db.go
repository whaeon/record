package db

import (
	"database/sql"
	_ "embed"
	"fmt"
	"log"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const DefaultDSN = "postgres://record:record@127.0.0.1:5432/record?sslmode=disable"

const maxConnectAttempts = 5

//go:embed schema.sql
var schema string

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
		if _, err := database.Exec(schema); err != nil {
			database.Close()
			return nil, err
		}
		return database, nil
	}
	return nil, fmt.Errorf("database connection failed after %d retries: %w", maxConnectAttempts, lastErr)
}

func backoff(attempt int) time.Duration {
	return time.Duration(1<<uint(attempt-1)) * time.Second
}
