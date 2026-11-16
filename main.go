package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
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

	database, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer database.Close()

	svc := service.New(
		repository.NewStrategyRepository(database),
		repository.NewMetricRepository(database),
		repository.NewNoteRepository(database),
	)

	r := gin.Default()
	handler.New(svc).Register(r)
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
