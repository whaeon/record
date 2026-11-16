package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/whaeon/record/internal/model"
)

type StrategyRepository struct {
	db *sql.DB
}

func NewStrategyRepository(db *sql.DB) *StrategyRepository {
	return &StrategyRepository{db: db}
}

func (r *StrategyRepository) Create(ctx context.Context, s *model.Strategy, revision *model.StrategyRevision) error {
	tx, err := beginTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	err = tx.QueryRowContext(ctx,
		`INSERT INTO strategies (name, current_detail, created_at, updated_at)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		s.Name, s.CurrentDetail, s.CreatedAt, s.UpdatedAt,
	).Scan(&s.ID)
	if err != nil {
		return err
	}
	revision.StrategyID = s.ID

	err = tx.QueryRowContext(ctx,
		`INSERT INTO strategy_revisions (strategy_id, detail, note, changed_at)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		revision.StrategyID, revision.Detail, revision.Note, revision.ChangedAt,
	).Scan(&revision.ID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *StrategyRepository) GetByID(ctx context.Context, id int64) (*model.Strategy, error) {
	var s model.Strategy
	err := q(ctx, r.db).QueryRowContext(ctx,
		`SELECT id, name, current_detail, created_at, updated_at FROM strategies WHERE id = $1`,
		id,
	).Scan(&s.ID, &s.Name, &s.CurrentDetail, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *StrategyRepository) GetByName(ctx context.Context, name string) (*model.Strategy, error) {
	var s model.Strategy
	err := q(ctx, r.db).QueryRowContext(ctx,
		`SELECT id, name, current_detail, created_at, updated_at FROM strategies WHERE name = $1`,
		name,
	).Scan(&s.ID, &s.Name, &s.CurrentDetail, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *StrategyRepository) List(ctx context.Context) ([]model.Strategy, error) {
	rows, err := q(ctx, r.db).QueryContext(ctx,
		`SELECT id, name, current_detail, created_at, updated_at FROM strategies ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.Strategy, 0)
	for rows.Next() {
		var s model.Strategy
		if err := rows.Scan(&s.ID, &s.Name, &s.CurrentDetail, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (r *StrategyRepository) Update(ctx context.Context, s *model.Strategy, revision *model.StrategyRevision) error {
	tx, err := beginTx(ctx, r.db)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx,
		`UPDATE strategies SET name = $1, current_detail = $2, updated_at = $3 WHERE id = $4`,
		s.Name, s.CurrentDetail, s.UpdatedAt, s.ID,
	)
	if err != nil {
		return err
	}
	if revision != nil {
		err = tx.QueryRowContext(ctx,
			`INSERT INTO strategy_revisions (strategy_id, detail, note, changed_at)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id`,
			revision.StrategyID, revision.Detail, revision.Note, revision.ChangedAt,
		).Scan(&revision.ID)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *StrategyRepository) Delete(ctx context.Context, id int64) error {
	_, err := q(ctx, r.db).ExecContext(ctx, `DELETE FROM strategies WHERE id = $1`, id)
	return err
}

func (r *StrategyRepository) CountMetrics(ctx context.Context, strategyID int64) (int, error) {
	var n int
	err := q(ctx, r.db).QueryRowContext(ctx, `SELECT COUNT(*) FROM strategy_metrics WHERE strategy_id = $1`, strategyID).Scan(&n)
	return n, err
}

func (r *StrategyRepository) CountRevisions(ctx context.Context, strategyID int64) (int, error) {
	var n int
	err := q(ctx, r.db).QueryRowContext(ctx, `SELECT COUNT(*) FROM strategy_revisions WHERE strategy_id = $1`, strategyID).Scan(&n)
	return n, err
}

func (r *StrategyRepository) ListRevisions(ctx context.Context, strategyID int64) ([]model.StrategyRevision, error) {
	rows, err := q(ctx, r.db).QueryContext(ctx,
		`SELECT id, strategy_id, detail, note, changed_at
		 FROM strategy_revisions WHERE strategy_id = $1
		 ORDER BY changed_at DESC, id DESC`,
		strategyID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.StrategyRevision, 0)
	for rows.Next() {
		var rev model.StrategyRevision
		if err := rows.Scan(&rev.ID, &rev.StrategyID, &rev.Detail, &rev.Note, &rev.ChangedAt); err != nil {
			return nil, err
		}
		list = append(list, rev)
	}
	return list, rows.Err()
}

type MetricRepository struct {
	db *sql.DB
}

func NewMetricRepository(db *sql.DB) *MetricRepository {
	return &MetricRepository{db: db}
}

const metricSelect = `SELECT m.id, m.date, m.strategy_id, s.name, m.total_picks, m.limit_up_count, m.failed_limit_count
	FROM strategy_metrics m JOIN strategies s ON s.id = m.strategy_id`

func scanMetric(scanner interface {
	Scan(dest ...any) error
}) (model.StrategyMetric, error) {
	var m model.StrategyMetric
	err := scanner.Scan(&m.ID, &m.Date, &m.StrategyID, &m.StrategyName, &m.TotalPicks, &m.LimitUpCount, &m.FailedLimitCount)
	return m, err
}

func (r *MetricRepository) Create(ctx context.Context, m *model.StrategyMetric) error {
	err := q(ctx, r.db).QueryRowContext(ctx,
		`INSERT INTO strategy_metrics (date, strategy_id, total_picks, limit_up_count, failed_limit_count)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		m.Date, m.StrategyID, m.TotalPicks, m.LimitUpCount, m.FailedLimitCount,
	).Scan(&m.ID)
	if err != nil {
		return err
	}
	return r.fillName(ctx, m)
}

func (r *MetricRepository) fillName(ctx context.Context, m *model.StrategyMetric) error {
	full, err := r.GetByID(ctx, m.ID)
	if err != nil || full == nil {
		return err
	}
	*m = *full
	return nil
}

func (r *MetricRepository) GetByID(ctx context.Context, id int64) (*model.StrategyMetric, error) {
	row := q(ctx, r.db).QueryRowContext(ctx, metricSelect+` WHERE m.id = $1`, id)
	m, err := scanMetric(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MetricRepository) GetByDateAndStrategy(ctx context.Context, date string, strategyID int64) (*model.StrategyMetric, error) {
	row := q(ctx, r.db).QueryRowContext(ctx, metricSelect+` WHERE m.date = $1 AND m.strategy_id = $2`, date, strategyID)
	m, err := scanMetric(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MetricRepository) Update(ctx context.Context, m *model.StrategyMetric) error {
	_, err := q(ctx, r.db).ExecContext(ctx,
		`UPDATE strategy_metrics
		 SET date = $1, strategy_id = $2, total_picks = $3, limit_up_count = $4, failed_limit_count = $5
		 WHERE id = $6`,
		m.Date, m.StrategyID, m.TotalPicks, m.LimitUpCount, m.FailedLimitCount, m.ID,
	)
	if err != nil {
		return err
	}
	return r.fillName(ctx, m)
}

func (r *MetricRepository) List(ctx context.Context, from, to string, strategyID int64) ([]model.StrategyMetric, error) {
	query := metricSelect + ` WHERE TRUE`
	args := make([]any, 0, 3)
	if from != "" {
		args = append(args, from)
		query += fmt.Sprintf(` AND m.date >= $%d`, len(args))
	}
	if to != "" {
		args = append(args, to)
		query += fmt.Sprintf(` AND m.date <= $%d`, len(args))
	}
	if strategyID > 0 {
		args = append(args, strategyID)
		query += fmt.Sprintf(` AND m.strategy_id = $%d`, len(args))
	}
	query += ` ORDER BY m.date ASC, s.name ASC`

	rows, err := q(ctx, r.db).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.StrategyMetric, 0)
	for rows.Next() {
		m, err := scanMetric(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, rows.Err()
}

func (r *MetricRepository) ListDates(ctx context.Context) ([]string, error) {
	rows, err := q(ctx, r.db).QueryContext(ctx, `SELECT DISTINCT date FROM strategy_metrics ORDER BY date ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dates := make([]string, 0)
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		dates = append(dates, d)
	}
	return dates, rows.Err()
}

type NoteRepository struct {
	db *sql.DB
}

func NewNoteRepository(db *sql.DB) *NoteRepository {
	return &NoteRepository{db: db}
}

func (r *NoteRepository) List(ctx context.Context) ([]model.ReviewNote, error) {
	rows, err := q(ctx, r.db).QueryContext(ctx,
		`SELECT id, date, content, updated_at FROM review_notes ORDER BY date DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.ReviewNote, 0)
	for rows.Next() {
		var n model.ReviewNote
		if err := rows.Scan(&n.ID, &n.Date, &n.Content, &n.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

func (r *NoteRepository) GetByDate(ctx context.Context, date string) (*model.ReviewNote, error) {
	var n model.ReviewNote
	err := q(ctx, r.db).QueryRowContext(ctx,
		`SELECT id, date, content, updated_at FROM review_notes WHERE date = $1`,
		date,
	).Scan(&n.ID, &n.Date, &n.Content, &n.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *NoteRepository) Upsert(ctx context.Context, date, content, updatedAt string) (*model.ReviewNote, error) {
	_, err := q(ctx, r.db).ExecContext(ctx,
		`INSERT INTO review_notes (date, content, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (date) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at`,
		date, content, updatedAt,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByDate(ctx, date)
}
