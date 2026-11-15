package repository

import (
	"database/sql"

	"github.com/whaeon/record/internal/model"
)

type StrategyRepository struct {
	db *sql.DB
}

func NewStrategyRepository(db *sql.DB) *StrategyRepository {
	return &StrategyRepository{db: db}
}

func (r *StrategyRepository) Create(s *model.Strategy, revision *model.StrategyRevision) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`INSERT INTO strategies (name, current_detail, created_at, updated_at)
		 VALUES (?, ?, ?, ?)`,
		s.Name, s.CurrentDetail, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	s.ID = id
	revision.StrategyID = id

	revRes, err := tx.Exec(
		`INSERT INTO strategy_revisions (strategy_id, detail, note, changed_at)
		 VALUES (?, ?, ?, ?)`,
		revision.StrategyID, revision.Detail, revision.Note, revision.ChangedAt,
	)
	if err != nil {
		return err
	}
	revID, err := revRes.LastInsertId()
	if err != nil {
		return err
	}
	revision.ID = revID
	return tx.Commit()
}

func (r *StrategyRepository) GetByID(id int64) (*model.Strategy, error) {
	var s model.Strategy
	err := r.db.QueryRow(
		`SELECT id, name, current_detail, created_at, updated_at FROM strategies WHERE id = ?`,
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

func (r *StrategyRepository) GetByName(name string) (*model.Strategy, error) {
	var s model.Strategy
	err := r.db.QueryRow(
		`SELECT id, name, current_detail, created_at, updated_at FROM strategies WHERE name = ?`,
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

func (r *StrategyRepository) List() ([]model.Strategy, error) {
	rows, err := r.db.Query(
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

func (r *StrategyRepository) Update(s *model.Strategy, revision *model.StrategyRevision) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`UPDATE strategies SET name = ?, current_detail = ?, updated_at = ? WHERE id = ?`,
		s.Name, s.CurrentDetail, s.UpdatedAt, s.ID,
	)
	if err != nil {
		return err
	}
	if revision != nil {
		res, err := tx.Exec(
			`INSERT INTO strategy_revisions (strategy_id, detail, note, changed_at)
			 VALUES (?, ?, ?, ?)`,
			revision.StrategyID, revision.Detail, revision.Note, revision.ChangedAt,
		)
		if err != nil {
			return err
		}
		id, err := res.LastInsertId()
		if err != nil {
			return err
		}
		revision.ID = id
	}
	return tx.Commit()
}

func (r *StrategyRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM strategies WHERE id = ?`, id)
	return err
}

func (r *StrategyRepository) CountMetrics(strategyID int64) (int, error) {
	var n int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM strategy_metrics WHERE strategy_id = ?`, strategyID).Scan(&n)
	return n, err
}

func (r *StrategyRepository) CountRevisions(strategyID int64) (int, error) {
	var n int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM strategy_revisions WHERE strategy_id = ?`, strategyID).Scan(&n)
	return n, err
}

func (r *StrategyRepository) ListRevisions(strategyID int64) ([]model.StrategyRevision, error) {
	rows, err := r.db.Query(
		`SELECT id, strategy_id, detail, note, changed_at
		 FROM strategy_revisions WHERE strategy_id = ?
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

func (r *MetricRepository) Create(m *model.StrategyMetric) error {
	res, err := r.db.Exec(
		`INSERT INTO strategy_metrics (date, strategy_id, total_picks, limit_up_count, failed_limit_count)
		 VALUES (?, ?, ?, ?, ?)`,
		m.Date, m.StrategyID, m.TotalPicks, m.LimitUpCount, m.FailedLimitCount,
	)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	m.ID = id
	return r.fillName(m)
}

func (r *MetricRepository) fillName(m *model.StrategyMetric) error {
	full, err := r.GetByID(m.ID)
	if err != nil || full == nil {
		return err
	}
	*m = *full
	return nil
}

func (r *MetricRepository) GetByID(id int64) (*model.StrategyMetric, error) {
	row := r.db.QueryRow(metricSelect+` WHERE m.id = ?`, id)
	m, err := scanMetric(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MetricRepository) GetByDateAndStrategy(date string, strategyID int64) (*model.StrategyMetric, error) {
	row := r.db.QueryRow(metricSelect+` WHERE m.date = ? AND m.strategy_id = ?`, date, strategyID)
	m, err := scanMetric(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MetricRepository) Update(m *model.StrategyMetric) error {
	_, err := r.db.Exec(
		`UPDATE strategy_metrics
		 SET date = ?, strategy_id = ?, total_picks = ?, limit_up_count = ?, failed_limit_count = ?
		 WHERE id = ?`,
		m.Date, m.StrategyID, m.TotalPicks, m.LimitUpCount, m.FailedLimitCount, m.ID,
	)
	if err != nil {
		return err
	}
	return r.fillName(m)
}

func (r *MetricRepository) List(from, to string, strategyID int64) ([]model.StrategyMetric, error) {
	query := metricSelect + ` WHERE 1=1`
	args := make([]any, 0, 3)
	if from != "" {
		query += ` AND m.date >= ?`
		args = append(args, from)
	}
	if to != "" {
		query += ` AND m.date <= ?`
		args = append(args, to)
	}
	if strategyID > 0 {
		query += ` AND m.strategy_id = ?`
		args = append(args, strategyID)
	}
	query += ` ORDER BY m.date ASC, s.name ASC`

	rows, err := r.db.Query(query, args...)
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

func (r *MetricRepository) ListDates() ([]string, error) {
	rows, err := r.db.Query(`SELECT DISTINCT date FROM strategy_metrics ORDER BY date ASC`)
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

func (r *NoteRepository) GetByDate(date string) (*model.ReviewNote, error) {
	var n model.ReviewNote
	err := r.db.QueryRow(
		`SELECT id, date, content, updated_at FROM review_notes WHERE date = ?`,
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

func (r *NoteRepository) Upsert(date, content, updatedAt string) (*model.ReviewNote, error) {
	_, err := r.db.Exec(
		`INSERT INTO review_notes (date, content, updated_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
		date, content, updatedAt,
	)
	if err != nil {
		return nil, err
	}
	return r.GetByDate(date)
}
