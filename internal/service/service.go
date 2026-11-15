package service

import (
	"errors"
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

func (s *Service) ListStrategies() ([]model.Strategy, error) {
	return s.strategies.List()
}

func (s *Service) GetStrategy(id int64) (*model.Strategy, error) {
	st, err := s.strategies.GetByID(id)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	return st, nil
}

func (s *Service) CreateStrategy(name, detail string) (*model.Strategy, error) {
	name = strings.TrimSpace(name)
	detail = strings.TrimSpace(detail)
	if name == "" {
		return nil, ErrNameRequired
	}
	if detail == "" {
		return nil, ErrDetailRequired
	}
	existing, err := s.strategies.GetByName(name)
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
	if err := s.strategies.Create(st, rev); err != nil {
		if isUniqueConstraint(err) {
			return nil, ErrNameConflict
		}
		return nil, err
	}
	return st, nil
}

func (s *Service) UpdateStrategy(id int64, name, detail, note string) (*model.Strategy, error) {
	name = strings.TrimSpace(name)
	detail = strings.TrimSpace(detail)
	if name == "" {
		return nil, ErrNameRequired
	}
	if detail == "" {
		return nil, ErrDetailRequired
	}
	st, err := s.strategies.GetByID(id)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	if name != st.Name {
		dup, err := s.strategies.GetByName(name)
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
	if err := s.strategies.Update(st, rev); err != nil {
		if isUniqueConstraint(err) {
			return nil, ErrNameConflict
		}
		return nil, err
	}
	return st, nil
}

func (s *Service) DeleteStrategy(id int64, confirm bool) error {
	st, err := s.strategies.GetByID(id)
	if err != nil {
		return err
	}
	if st == nil {
		return ErrNotFound
	}
	if !confirm {
		metricsCount, err := s.strategies.CountMetrics(id)
		if err != nil {
			return err
		}
		revCount, err := s.strategies.CountRevisions(id)
		if err != nil {
			return err
		}
		if metricsCount > 0 || revCount > 0 {
			return ErrDeleteConfirmRequired
		}
	}
	return s.strategies.Delete(id)
}

func (s *Service) ListRevisions(strategyID int64) ([]model.StrategyRevision, error) {
	st, err := s.strategies.GetByID(strategyID)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	return s.strategies.ListRevisions(strategyID)
}

func (s *Service) CreateMetric(m *model.StrategyMetric) (*model.StrategyMetric, error) {
	if err := validateDate(m.Date); err != nil {
		return nil, err
	}
	if m.StrategyID <= 0 {
		return nil, ErrStrategyRequired
	}
	if m.TotalPicks < 0 || m.LimitUpCount < 0 || m.FailedLimitCount < 0 {
		return nil, ErrInvalidMetric
	}
	st, err := s.strategies.GetByID(m.StrategyID)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	existing, err := s.metrics.GetByDateAndStrategy(m.Date, m.StrategyID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		applyRates(existing)
		return nil, &MetricConflictError{Existing: existing}
	}
	if err := s.metrics.Create(m); err != nil {
		if isUniqueConstraint(err) {
			dup, getErr := s.metrics.GetByDateAndStrategy(m.Date, m.StrategyID)
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

func (s *Service) UpdateMetric(id int64, m *model.StrategyMetric) (*model.StrategyMetric, error) {
	if err := validateDate(m.Date); err != nil {
		return nil, err
	}
	if m.StrategyID <= 0 {
		return nil, ErrStrategyRequired
	}
	if m.TotalPicks < 0 || m.LimitUpCount < 0 || m.FailedLimitCount < 0 {
		return nil, ErrInvalidMetric
	}
	current, err := s.metrics.GetByID(id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, ErrNotFound
	}
	st, err := s.strategies.GetByID(m.StrategyID)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, ErrNotFound
	}
	dup, err := s.metrics.GetByDateAndStrategy(m.Date, m.StrategyID)
	if err != nil {
		return nil, err
	}
	if dup != nil && dup.ID != id {
		applyRates(dup)
		return nil, &MetricConflictError{Existing: dup}
	}
	m.ID = id
	if err := s.metrics.Update(m); err != nil {
		return nil, err
	}
	applyRates(m)
	return m, nil
}

func (s *Service) ListMetrics(from, to, strategyIDRaw string) ([]model.StrategyMetric, error) {
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
	var strategyID int64
	if strings.TrimSpace(strategyIDRaw) != "" {
		id, err := strconv.ParseInt(strategyIDRaw, 10, 64)
		if err != nil || id <= 0 {
			return nil, ErrInvalidID
		}
		strategyID = id
	}
	list, err := s.metrics.List(from, to, strategyID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		applyRates(&list[i])
	}
	return list, nil
}

func (s *Service) ListMetricDates() ([]string, error) {
	return s.metrics.ListDates()
}

func (s *Service) ListNotes() ([]model.ReviewNote, error) {
	list, err := s.notes.List()
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i].Content = summarizeRunes(list[i].Content, 50)
	}
	return list, nil
}

func (s *Service) GetNote(date string) (*model.ReviewNote, error) {
	if err := validateDate(date); err != nil {
		return nil, err
	}
	n, err := s.notes.GetByDate(date)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return &model.ReviewNote{Date: date, Content: ""}, nil
	}
	return n, nil
}

func (s *Service) UpsertNote(date, content string) (*model.ReviewNote, error) {
	if err := validateDate(date); err != nil {
		return nil, err
	}
	return s.notes.Upsert(date, content, nowISO())
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
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}
