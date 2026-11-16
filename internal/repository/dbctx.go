package repository

import (
	"context"
	"database/sql"

	appdb "github.com/whaeon/record/internal/db"
)

type querier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func q(ctx context.Context, database *sql.DB) querier {
	if c := appdb.ConnFromContext(ctx); c != nil {
		return c
	}
	return database
}

func beginTx(ctx context.Context, database *sql.DB) (*sql.Tx, error) {
	if c := appdb.ConnFromContext(ctx); c != nil {
		return c.BeginTx(ctx, nil)
	}
	return database.BeginTx(ctx, nil)
}
