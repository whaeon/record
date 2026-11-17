package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/whaeon/record/internal/auth"
	"github.com/whaeon/record/internal/backup"
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

	password := os.Getenv("INITIAL_PASSWORD")
	if password == "" {
		log.Fatal("INITIAL_PASSWORD is required")
	}
	username := os.Getenv("INITIAL_USERNAME")
	if username == "" {
		username = "admin"
	}

	database, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer database.Close()

	if err := db.Bootstrap(context.Background(), database, db.BootstrapOpts{
		UserID:   defaultUserID,
		Username: username,
		Password: password,
	}); err != nil {
		log.Fatalf("bootstrap: %v", err)
	}

	svc := service.New(
		repository.NewStrategyRepository(database),
		repository.NewMetricRepository(database),
		repository.NewNoteRepository(database),
	)

	backup.Start(dsn)

	secret, err := sessionSecret()
	if err != nil {
		log.Fatalf("SESSION_SECRET: %v", err)
	}
	cookieAuth := auth.NewCookie(database, secret)

	r := gin.Default()
	h := handler.New(svc)
	h.RegisterPublic(r, cookieAuth)
	h.Register(r, auth.Middleware(cookieAuth), db.WithUserSchema(database))
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

func sessionSecret() ([]byte, error) {
	raw := os.Getenv("SESSION_SECRET")
	if raw != "" {
		return []byte(raw), nil
	}
	return auth.RandomSecret()
}
