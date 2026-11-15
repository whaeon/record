package service

import (
	"errors"
	"strings"
	"time"

	"github.com/whaeon/record/internal/model"
	"github.com/whaeon/record/internal/repository"
)

var ErrInvalidDate = errors.New("date must be YYYY-MM-DD")
var ErrInvalidMetric = errors.New("metric fields must be non-negative")
var ErrSectorRequired = errors.New("sector_name is required")

type Service struct {
	metrics *repository.MetricRepository
	notes   *repository.NoteRepository
}

func New(metrics *repository.MetricRepository, notes *repository.NoteRepository) *Service {
	return &Service{metrics: metrics, notes: notes}
}

func (s *Service) CreateMetric(m *model.SectorMetric) (*model.SectorMetric, error) {
	m.SectorName = strings.TrimSpace(m.SectorName)
	if err := validateDate(m.Date); err != nil {
		return nil, err
	}
	if m.SectorName == "" {
		return nil, ErrSectorRequired
	}
	if m.TotalPicks < 0 || m.LimitUpCount < 0 || m.FailedLimitCount < 0 {
		return nil, ErrInvalidMetric
	}
	if err := s.metrics.Create(m); err != nil {
		return nil, err
	}
	applyRates(m)
	return m, nil
}

func (s *Service) ListMetrics(from, to, sector string) ([]model.SectorMetric, error) {
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
	list, err := s.metrics.List(from, to, strings.TrimSpace(sector))
	if err != nil {
		return nil, err
	}
	for i := range list {
		applyRates(&list[i])
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
	updatedAt := time.Now().UTC().Format(time.RFC3339)
	return s.notes.Upsert(date, content, updatedAt)
}

func applyRates(m *model.SectorMetric) {
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
