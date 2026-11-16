CREATE TABLE IF NOT EXISTS __SCHEMA__.strategies (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	current_detail TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS __SCHEMA__.strategy_revisions (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	strategy_id INTEGER NOT NULL,
	detail TEXT NOT NULL,
	note TEXT NOT NULL DEFAULT '',
	changed_at TEXT NOT NULL,
	FOREIGN KEY (strategy_id) REFERENCES __SCHEMA__.strategies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_revisions_strategy ON __SCHEMA__.strategy_revisions (strategy_id, changed_at);
CREATE TABLE IF NOT EXISTS __SCHEMA__.strategy_metrics (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	date TEXT NOT NULL,
	strategy_id INTEGER NOT NULL,
	total_picks INTEGER NOT NULL DEFAULT 0,
	limit_up_count INTEGER NOT NULL DEFAULT 0,
	failed_limit_count INTEGER NOT NULL DEFAULT 0,
	UNIQUE(date, strategy_id),
	FOREIGN KEY (strategy_id) REFERENCES __SCHEMA__.strategies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_metrics_date_strategy ON __SCHEMA__.strategy_metrics(date, strategy_id);
CREATE TABLE IF NOT EXISTS __SCHEMA__.review_notes (
	id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	date TEXT NOT NULL UNIQUE,
	content TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL
);
