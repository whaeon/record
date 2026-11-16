package auth

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
)

type contextKey struct{}

type User struct {
	ID int64
}

type Authenticator interface {
	CurrentUser(c *gin.Context) (*User, error)
}

type staticAuth struct {
	id int64
}

func NewStatic(userID int64) Authenticator {
	return &staticAuth{id: userID}
}

func (s *staticAuth) CurrentUser(c *gin.Context) (*User, error) {
	return &User{ID: s.id}, nil
}

func Middleware(a Authenticator) gin.HandlerFunc {
	return func(c *gin.Context) {
		u, err := a.CurrentUser(c)
		if err != nil || u == nil || u.ID <= 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "unauthorized"})
			return
		}
		ctx := ContextWithUserID(c.Request.Context(), u.ID)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func ContextWithUserID(ctx context.Context, id int64) context.Context {
	return context.WithValue(ctx, contextKey{}, id)
}

func UserIDFromContext(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(contextKey{}).(int64)
	return id, ok && id > 0
}
