package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/whaeon/record/internal/auth"
	"github.com/whaeon/record/internal/db"
	"github.com/whaeon/record/internal/handler"
	"github.com/whaeon/record/internal/repository"
	"github.com/whaeon/record/internal/service"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = db.DefaultDSN
	}

	defaultUserID, err := parseDefaultUserID()
	if err != nil {
		log.Fatalf("DEFAULT_USER_ID: %v", err)
	}

	database, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer database.Close()

	if err := db.Bootstrap(context.Background(), database, defaultUserID); err != nil {
		log.Fatalf("bootstrap: %v", err)
	}

	svc := service.New(
		repository.NewStrategyRepository(database),
		repository.NewMetricRepository(database),
		repository.NewNoteRepository(database),
	)

	r := gin.Default()
	handler.New(svc).Register(r, auth.Middleware(auth.NewStatic(defaultUserID)), db.WithUserSchema(database))
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}

func parseDefaultUserID() (int64, error) {
	raw := os.Getenv("DEFAULT_USER_ID")
	if raw == "" {
		return 1, nil
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid DEFAULT_USER_ID %q: %w", raw, err)
	}
	if id <= 0 {
		return 0, fmt.Errorf("invalid DEFAULT_USER_ID %q", raw)
	}
	return id, nil
}
