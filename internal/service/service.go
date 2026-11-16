package service

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/whaeon/record/internal/model"
	"github.com/whaeon/record/internal/repository"
)

var ErrInvalidDate = errors.New("date must be YYYY-MM-DD")
var ErrInvalidMetric = errors.New("metric fields must be non-negative")
var ErrInvalidID = errors.New("invalid id")
var ErrNameRequired = errors.New("name is required")
var ErrDetailRequired = errors.New("current_detail is required")
var ErrStrategyRequired = errors.New("strategy_id is required")
var ErrNameConflict = errors.New("strategy name already exists")
var ErrNotFound = errors.New("not found")
var ErrDeleteConfirmRequired = errors.New("confirm=true is required")

type MetricConflictError struct {
	Existing *model.StrategyMetric
}

func (e *MetricConflictError) Error() string {
	return "metric already exists"
}

type Service struct {
	strategies *repository.StrategyRepository
	metrics    *repository.MetricRepository
	notes      *repository.NoteRepository
}

func New(
	strategies *repository.StrategyRepository,
	metrics *repository.MetricRepository,
	notes *repository.NoteRepository,
) *Service {
	return &Service{strategies: strategies, metrics: metrics, notes: notes}
}

func (s *Service) ListStrategies(ctx context.Context) ([]model.Strategy, error) {
	return s.strategies.List(ctx)
}

func (s *Service) GetStrategy(ctx context.Context, id int64) (*model.Strategy, error) {
	st, err := s.strategies.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	return st, nil
}

func (s *Service) CreateStrategy(ctx context.Context, name, detail string) (*model.Strategy, error) {
	name = strings.TrimSpace(name)
	detail = strings.TrimSpace(detail)
	if name == "" {
		return nil, ErrNameRequired
	}
	if detail == "" {
		return nil, ErrDetailRequired
	}
	existing, err := s.strategies.GetByName(ctx, name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrNameConflict
	}
	now := nowISO()
	st := &model.Strategy{
		Name:          name,
		CurrentDetail: detail,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	rev := &model.StrategyRevision{
		Detail:    detail,
		Note:      "",
		ChangedAt: now,
	}
	if err := s.strategies.Create(ctx, st, rev); err != nil {
		if isUniqueConstraint(err) {
			return nil, ErrNameConflict
		}
		return nil, err
	}
	return st, nil
}

func (s *Service) UpdateStrategy(ctx context.Context, id int64, name, detail, note string) (*model.Strategy, error) {
	name = strings.TrimSpace(name)
	detail = strings.TrimSpace(detail)
	if name == "" {
		return nil, ErrNameRequired
	}
	if detail == "" {
		return nil, ErrDetailRequired
	}
	st, err := s.strategies.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	if name != st.Name {
		dup, err := s.strategies.GetByName(ctx, name)
		if err != nil {
			return nil, err
		}
		if dup != nil && dup.ID != id {
			return nil, ErrNameConflict
		}
	}
	now := nowISO()
	contentChanged := detail != st.CurrentDetail
	st.Name = name
	st.CurrentDetail = detail
	st.UpdatedAt = now

	var rev *model.StrategyRevision
	if contentChanged {
		rev = &model.StrategyRevision{
			StrategyID: id,
			Detail:     detail,
			Note:       strings.TrimSpace(note),
			ChangedAt:  now,
		}
	}
	if err := s.strategies.Update(ctx, st, rev); err != nil {
		if isUniqueConstraint(err) {
			return nil, ErrNameConflict
		}
		return nil, err
	}
	return st, nil
}

func (s *Service) DeleteStrategy(ctx context.Context, id int64, confirm bool) error {
	st, err := s.strategies.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if st == nil {
		return ErrNotFound
	}
	if !confirm {
		metricsCount, err := s.strategies.CountMetrics(ctx, id)
		if err != nil {
			return err
		}
		revCount, err := s.strategies.CountRevisions(ctx, id)
		if err != nil {
			return err
		}
		if metricsCount > 0 || revCount > 0 {
			return ErrDeleteConfirmRequired
		}
	}
	return s.strategies.Delete(ctx, id)
}

func (s *Service) ListRevisions(ctx context.Context, strategyID int64) ([]model.StrategyRevision, error) {
	st, err := s.strategies.GetByID(ctx, strategyID)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	return s.strategies.ListRevisions(ctx, strategyID)
}

func (s *Service) CreateMetric(ctx context.Context, m *model.StrategyMetric) (*model.StrategyMetric, error) {
	if err := validateDate(m.Date); err != nil {
		return nil, err
	}
	if m.StrategyID <= 0 {
		return nil, ErrStrategyRequired
	}
	if m.TotalPicks < 0 || m.LimitUpCount < 0 || m.FailedLimitCount < 0 {
		return nil, ErrInvalidMetric
	}
	st, err := s.strategies.GetByID(ctx, m.StrategyID)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	existing, err := s.metrics.GetByDateAndStrategy(ctx, m.Date, m.StrategyID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		applyRates(existing)
		return nil, &MetricConflictError{Existing: existing}
	}
	if err := s.metrics.Create(ctx, m); err != nil {
		if isUniqueConstraint(err) {
			dup, getErr := s.metrics.GetByDateAndStrategy(ctx, m.Date, m.StrategyID)
			if getErr == nil && dup != nil {
				applyRates(dup)
				return nil, &MetricConflictError{Existing: dup}
			}
		}
		return nil, err
	}
	applyRates(m)
	return m, nil
}

func (s *Service) UpdateMetric(ctx context.Context, id int64, m *model.StrategyMetric) (*model.StrategyMetric, error) {
	if err := validateDate(m.Date); err != nil {
		return nil, err
	}
	if m.StrategyID <= 0 {
		return nil, ErrStrategyRequired
	}
	if m.TotalPicks < 0 || m.LimitUpCount < 0 || m.FailedLimitCount < 0 {
		return nil, ErrInvalidMetric
	}
	current, err := s.metrics.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, ErrNotFound
	}
	st, err := s.strategies.GetByID(ctx, m.StrategyID)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	dup, err := s.metrics.GetByDateAndStrategy(ctx, m.Date, m.StrategyID)
	if err != nil {
		return nil, err
	}
	if dup != nil && dup.ID != id {
		applyRates(dup)
		return nil, &MetricConflictError{Existing: dup}
	}
	m.ID = id
	if err := s.metrics.Update(ctx, m); err != nil {
		return nil, err
	}
	applyRates(m)
	return m, nil
}

func (s *Service) ListMetrics(ctx context.Context, from, to, strategyIDRaw string) ([]model.StrategyMetric, error) {
	if from != "" {
		if err := validateDate(from); err != nil {
			return nil, err
		}
	}
	if to != "" {
		if err := validateDate(to); err != nil {
			return nil, err
		}
	}
	raw := strings.TrimSpace(strategyIDRaw)
	if raw == "all" {
		list, err := s.metrics.ListAggregatedByDate(ctx, from, to)
		if err != nil {
			return nil, err
		}
		for i := range list {
			applyRates(&list[i])
		}
		return list, nil
	}
	var strategyID int64
	if raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			return nil, ErrInvalidID
		}
		strategyID = id
	}
	list, err := s.metrics.List(ctx, from, to, strategyID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		applyRates(&list[i])
	}
	return list, nil
}

func (s *Service) ListMetricDates(ctx context.Context) ([]string, error) {
	return s.metrics.ListDates(ctx)
}

func (s *Service) ExportMetricsCSV(ctx context.Context) ([]byte, error) {
	list, err := s.ListMetrics(ctx, "", "", "")
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	if err := w.Write([]string{
		"id", "date", "strategy_id", "strategy_name",
		"total_picks", "limit_up_count", "failed_limit_count",
		"seal_rate", "break_rate",
	}); err != nil {
		return nil, err
	}
	for _, m := range list {
		if err := w.Write([]string{
			strconv.FormatInt(m.ID, 10),
			m.Date,
			strconv.FormatInt(m.StrategyID, 10),
			m.StrategyName,
			strconv.Itoa(m.TotalPicks),
			strconv.Itoa(m.LimitUpCount),
			strconv.Itoa(m.FailedLimitCount),
			fmt.Sprintf("%.6f", m.SealRate),
			fmt.Sprintf("%.6f", m.BreakRate),
		}); err != nil {
			return nil, err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (s *Service) ExportNotesZip(ctx context.Context) ([]byte, error) {
	list, err := s.notes.List(ctx)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, n := range list {
		name := n.Date + ".md"
		f, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := f.Write([]byte(n.Content)); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (s *Service) ListNotes(ctx context.Context) ([]model.ReviewNote, error) {
	list, err := s.notes.List(ctx)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].Content = summarizeRunes(list[i].Content, 50)
	}
	return list, nil
}

func (s *Service) GetNote(ctx context.Context, date string) (*model.ReviewNote, error) {
	if err := validateDate(date); err != nil {
		return nil, err
	}
	n, err := s.notes.GetByDate(ctx, date)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return &model.ReviewNote{Date: date, Content: ""}, nil
	}
	return n, nil
}

func (s *Service) UpsertNote(ctx context.Context, date, content string) (*model.ReviewNote, error) {
	if err := validateDate(date); err != nil {
		return nil, err
	}
	return s.notes.Upsert(ctx, date, content, nowISO())
}

func applyRates(m *model.StrategyMetric) {
	if m.TotalPicks > 0 {
		m.SealRate = float64(m.LimitUpCount) / float64(m.TotalPicks)
	}
	total := m.LimitUpCount + m.FailedLimitCount
	if total > 0 {
		m.BreakRate = float64(m.FailedLimitCount) / float64(total)
	}
}

func validateDate(date string) error {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return ErrInvalidDate
	}
	if t.Format("2006-01-02") != date {
		return ErrInvalidDate
	}
	return nil
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func summarizeRunes(text string, max int) string {
	t := strings.Join(strings.Fields(text), " ")
	runes := []rune(t)
	if len(runes) <= max {
		return t
	}
	return string(runes[:max]) + "..."
}

func isUniqueConstraint(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "UNIQUE constraint failed") ||
		strings.Contains(msg, "duplicate key value violates unique constraint") ||
		strings.Contains(msg, "SQLSTATE 23505")
}
