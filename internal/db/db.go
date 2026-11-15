package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

const DefaultPath = "data.db"

const schema = `
CREATE TABLE IF NOT EXISTS strategies (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	current_detail TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS strategy_revisions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	strategy_id INTEGER NOT NULL,
	detail TEXT NOT NULL,
	note TEXT NOT NULL DEFAULT '',
	changed_at TEXT NOT NULL,
	FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_revisions_strategy ON strategy_revisions(strategy_id, changed_at);
CREATE TABLE IF NOT EXISTS strategy_metrics (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date TEXT NOT NULL,
	strategy_id INTEGER NOT NULL,
	total_picks INTEGER NOT NULL DEFAULT 0,
	limit_up_count INTEGER NOT NULL DEFAULT 0,
	failed_limit_count INTEGER NOT NULL DEFAULT 0,
	UNIQUE(date, strategy_id),
	FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_metrics_date_strategy ON strategy_metrics(date, strategy_id);
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
	database.SetMaxOpenConns(1)
	if err := database.Ping(); err != nil {
		database.Close()
		return nil, err
	}
	if _, err := database.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		database.Close()
		return nil, err
	}
	if _, err := database.Exec(schema); err != nil {
		database.Close()
		return nil, err
	}
	return database, nil
}
