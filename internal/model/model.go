package model

type SectorMetric struct {
	ID               int64   `json:"id"`
	Date             string  `json:"date"`
	SectorName       string  `json:"sector_name"`
	TotalPicks       int     `json:"total_picks"`
	LimitUpCount     int     `json:"limit_up_count"`
	FailedLimitCount int     `json:"failed_limit_count"`
	SealRate         float64 `json:"seal_rate"`
	BreakRate        float64 `json:"break_rate"`
}

type ReviewNote struct {
	ID        int64  `json:"id"`
	Date      string `json:"date"`
	Content   string `json:"content"`
	UpdatedAt string `json:"updated_at"`
}
