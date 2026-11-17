package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/whaeon/record/internal/auth"
	"github.com/whaeon/record/internal/calendar"
	"github.com/whaeon/record/internal/model"
	"github.com/whaeon/record/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterPublic(r *gin.Engine, a *auth.CookieAuth) {
	api := r.Group("/api")
	api.POST("/login", a.HandleLogin)
	api.POST("/logout", a.HandleLogout)
	api.GET("/me", a.HandleMe)
}

func (h *Handler) Register(r *gin.Engine, mws ...gin.HandlerFunc) {
	api := r.Group("/api")
	if len(mws) > 0 {
		api.Use(mws...)
	}
	api.GET("/strategies", h.ListStrategies)
	api.POST("/strategies", h.CreateStrategy)
	api.GET("/strategies/:id/revisions", h.ListRevisions)
	api.GET("/strategies/:id", h.GetStrategy)
	api.PUT("/strategies/:id/active", h.SetStrategyActive)
	api.PUT("/strategies/:id", h.UpdateStrategy)
	api.DELETE("/strategies/:id", h.DeleteStrategy)

	api.GET("/metrics/dates", h.ListMetricDates)
	api.GET("/metrics", h.ListMetrics)
	api.POST("/metrics", h.CreateMetric)
	api.PUT("/metrics/:id", h.UpdateMetric)

	api.GET("/notes", h.ListNotes)
	api.GET("/notes/:date", h.GetNote)
	api.PUT("/notes/:date", h.UpsertNote)

	api.GET("/export/metrics.csv", h.ExportMetricsCSV)
	api.GET("/export/notes.md", h.ExportNotesZip)

	api.GET("/calendar", h.ListCalendar)
}

type strategyRequest struct {
	Name          string `json:"name"`
	CurrentDetail string `json:"current_detail"`
	Note          string `json:"note"`
}

type strategyActiveRequest struct {
	IsActive *bool `json:"is_active"`
}

type metricRequest struct {
	Date             string `json:"date"`
	StrategyID       int64  `json:"strategy_id"`
	TotalPicks       int    `json:"total_picks"`
	LimitUpCount     int    `json:"limit_up_count"`
	FailedLimitCount int    `json:"failed_limit_count"`
}

type upsertNoteRequest struct {
	Content string `json:"content"`
}

func (h *Handler) ListStrategies(c *gin.Context) {
	list, err := h.svc.ListStrategies(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) CreateStrategy(c *gin.Context) {
	var req strategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	st, err := h.svc.CreateStrategy(c.Request.Context(), req.Name, req.CurrentDetail)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *Handler) GetStrategy(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	st, err := h.svc.GetStrategy(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *Handler) UpdateStrategy(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var req strategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	st, err := h.svc.UpdateStrategy(c.Request.Context(), id, req.Name, req.CurrentDetail, req.Note)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *Handler) SetStrategyActive(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var req strategyActiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.IsActive == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "is_active is required"})
		return
	}
	st, err := h.svc.SetStrategyActive(c.Request.Context(), id, *req.IsActive)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *Handler) DeleteStrategy(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	confirm := c.Query("confirm") == "true"
	if err := h.svc.DeleteStrategy(c.Request.Context(), id, confirm); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusOK)
}

func (h *Handler) ListRevisions(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	list, err := h.svc.ListRevisions(c.Request.Context(), id)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) CreateMetric(c *gin.Context) {
	var req metricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m, err := h.svc.CreateMetric(c.Request.Context(), &model.StrategyMetric{
		Date:             req.Date,
		StrategyID:       req.StrategyID,
		TotalPicks:       req.TotalPicks,
		LimitUpCount:     req.LimitUpCount,
		FailedLimitCount: req.FailedLimitCount,
	})
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, m)
}

func (h *Handler) UpdateMetric(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var req metricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m, err := h.svc.UpdateMetric(c.Request.Context(), id, &model.StrategyMetric{
		Date:             req.Date,
		StrategyID:       req.StrategyID,
		TotalPicks:       req.TotalPicks,
		LimitUpCount:     req.LimitUpCount,
		FailedLimitCount: req.FailedLimitCount,
	})
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, m)
}

func (h *Handler) ListMetrics(c *gin.Context) {
	list, err := h.svc.ListMetrics(c.Request.Context(), c.Query("from"), c.Query("to"), c.Query("strategy_id"))
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) ListMetricDates(c *gin.Context) {
	dates, err := h.svc.ListMetricDates(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, dates)
}

func (h *Handler) ListNotes(c *gin.Context) {
	list, err := h.svc.ListNotes(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) GetNote(c *gin.Context) {
	n, err := h.svc.GetNote(c.Request.Context(), c.Param("date"))
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, n)
}

func (h *Handler) ListCalendar(c *gin.Context) {
	days, err := calendar.Range(c.Query("from"), c.Query("to"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, days)
}

func (h *Handler) ExportMetricsCSV(c *gin.Context) {
	data, err := h.svc.ExportMetricsCSV(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="metrics.csv"`)
	c.Data(http.StatusOK, "text/csv; charset=utf-8", data)
}

func (h *Handler) ExportNotesZip(c *gin.Context) {
	data, err := h.svc.ExportNotesZip(c.Request.Context())
	if err != nil {
		writeError(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="notes.zip"`)
	c.Data(http.StatusOK, "application/zip", data)
}

func (h *Handler) UpsertNote(c *gin.Context) {
	var req upsertNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	n, err := h.svc.UpsertNote(c.Request.Context(), c.Param("date"), req.Content)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, n)
}

func pathID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": service.ErrInvalidID.Error()})
		return 0, false
	}
	return id, true
}

func writeError(c *gin.Context, err error) {
	var conflict *service.MetricConflictError
	if errors.As(err, &conflict) {
		c.JSON(http.StatusConflict, conflict.Existing)
		return
	}
	switch {
	case errors.Is(err, service.ErrNameConflict), errors.Is(err, service.ErrDeleteConfirmRequired):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, service.ErrInvalidDate),
		errors.Is(err, service.ErrInvalidMetric),
		errors.Is(err, service.ErrInvalidID),
		errors.Is(err, service.ErrNameRequired),
		errors.Is(err, service.ErrDetailRequired),
		errors.Is(err, service.ErrStrategyRequired):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
