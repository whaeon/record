package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

const DefaultPath = "data.db"

const schema = `
CREATE TABLE IF NOT EXISTS sector_metrics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date TEXT NOT NULL,
	sector_name TEXT NOT NULL,
	total_picks INTEGER NOT NULL DEFAULT 0,
	limit_up_count INTEGER NOT NULL DEFAULT 0,
	failed_limit_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_metrics_date_sector ON sector_metrics(date, sector_name);
CREATE TABLE IF NOT EXISTS review_notes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date TEXT NOT NULL UNIQUE,
	content TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL
);
`

func Open(path string) (*sql.DB, error) {
	database, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if err := database.Ping(); err != nil {
		database.Close()
		return nil, err
	}
	if _, err := database.Exec(schema); err != nil {
		database.Close()
		return nil, err
	}
	return database, nil
}
