package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/whaeon/record/internal/model"
	"github.com/whaeon/record/internal/service"
)

type Handler struct {
	svc *service.Service
}

func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r *gin.Engine) {
	api := r.Group("/api")
	api.POST("/metrics", h.CreateMetric)
	api.GET("/metrics", h.ListMetrics)
	api.GET("/notes/:date", h.GetNote)
	api.PUT("/notes/:date", h.UpsertNote)
}

type createMetricRequest struct {
	Date             string `json:"date"`
	SectorName       string `json:"sector_name"`
	TotalPicks       int    `json:"total_picks"`
	LimitUpCount     int    `json:"limit_up_count"`
	FailedLimitCount int    `json:"failed_limit_count"`
}

type upsertNoteRequest struct {
	Content string `json:"content"`
}

func (h *Handler) CreateMetric(c *gin.Context) {
	var req createMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	m, err := h.svc.CreateMetric(&model.SectorMetric{
		Date:             req.Date,
		SectorName:       req.SectorName,
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
	list, err := h.svc.ListMetrics(c.Query("from"), c.Query("to"), c.Query("sector"))
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) GetNote(c *gin.Context) {
	n, err := h.svc.GetNote(c.Param("date"))
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, n)
}

func (h *Handler) UpsertNote(c *gin.Context) {
	var req upsertNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	n, err := h.svc.UpsertNote(c.Param("date"), req.Content)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, n)
}

func writeError(c *gin.Context, err error) {
	if errors.Is(err, service.ErrInvalidDate) ||
		errors.Is(err, service.ErrInvalidMetric) ||
		errors.Is(err, service.ErrSectorRequired) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}
