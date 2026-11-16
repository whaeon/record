package db

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/whaeon/record/internal/auth"
)

type connKey struct{}

func ContextWithConn(ctx context.Context, conn *sql.Conn) context.Context {
	return context.WithValue(ctx, connKey{}, conn)
}

func ConnFromContext(ctx context.Context) *sql.Conn {
	c, _ := ctx.Value(connKey{}).(*sql.Conn)
	return c
}

func WithUserSchema(database *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := auth.UserIDFromContext(c.Request.Context())
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "unauthorized"})
			return
		}
		schemaName := SchemaName(userID)
		if err := ValidateSchemaName(schemaName); err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "code": "internal"})
			return
		}
		conn, err := database.Conn(c.Request.Context())
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "code": "internal"})
			return
		}
		released := false
		release := func() {
			if released {
				return
			}
			released = true
			_, _ = conn.ExecContext(context.Background(), `SET search_path TO public`)
			_ = conn.Close()
		}
		defer release()

		if _, err := conn.ExecContext(c.Request.Context(), `SET search_path TO `+QuoteIdent(schemaName)); err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "code": "internal"})
			return
		}
		c.Request = c.Request.WithContext(ContextWithConn(c.Request.Context(), conn))
		c.Next()
	}
}
