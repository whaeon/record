package repository

import (
	"database/sql"

	"github.com/whaeon/record/internal/model"
)

type MetricRepository struct {
	db *sql.DB
}

func NewMetricRepository(db *sql.DB) *MetricRepository {
	return &MetricRepository{db: db}
}

func (r *MetricRepository) Create(m *model.SectorMetric) error {
	res, err := r.db.Exec(
		`INSERT INTO sector_metrics (date, sector_name, total_picks, limit_up_count, failed_limit_count)
		 VALUES (?, ?, ?, ?, ?)`,
		m.Date, m.SectorName, m.TotalPicks, m.LimitUpCount, m.FailedLimitCount,
	)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	m.ID = id
	return nil
}

func (r *MetricRepository) List(from, to, sector string) ([]model.SectorMetric, error) {
	query := `SELECT id, date, sector_name, total_picks, limit_up_count, failed_limit_count
		FROM sector_metrics WHERE 1=1`
	args := make([]any, 0, 3)
	if from != "" {
		query += ` AND date >= ?`
		args = append(args, from)
	}
	if to != "" {
		query += ` AND date <= ?`
		args = append(args, to)
	}
	if sector != "" {
		query += ` AND sector_name = ?`
		args = append(args, sector)
	}
	query += ` ORDER BY date ASC, sector_name ASC`

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.SectorMetric, 0)
	for rows.Next() {
		var m model.SectorMetric
		if err := rows.Scan(&m.ID, &m.Date, &m.SectorName, &m.TotalPicks, &m.LimitUpCount, &m.FailedLimitCount); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, rows.Err()
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
