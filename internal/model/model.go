package model

type Strategy struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	CurrentDetail string `json:"current_detail"`
	IsActive      bool   `json:"is_active"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

type StrategyRevision struct {
	ID         int64  `json:"id"`
	StrategyID int64  `json:"strategy_id"`
	Detail     string `json:"detail"`
	Note       string `json:"note"`
	ChangedAt  string `json:"changed_at"`
}

type StrategyMetric struct {
	ID               int64   `json:"id"`
	Date             string  `json:"date"`
	StrategyID       int64   `json:"strategy_id"`
	StrategyName     string  `json:"strategy_name"`
	TotalPicks       int     `json:"total_picks"`
	LimitUpCount     int     `json:"limit_up_count"`
	FailedLimitCount int     `json:"failed_limit_count"`
	Source           string  `json:"source"`
	SealRate         float64 `json:"seal_rate"`
	BreakRate        float64 `json:"break_rate"`
}

type ReviewNote struct {
	ID        int64  `json:"id"`
	Date      string `json:"date"`
	Content   string `json:"content"`
	UpdatedAt string `json:"updated_at"`
}
