package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const (
	cookieName   = "sid"
	cookieMaxAge = 30 * 24 * 3600
	sessionTTL   = 30 * 24 * time.Hour
)

type contextKey struct{}

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
}

type Authenticator interface {
	CurrentUser(c *gin.Context) (*User, error)
}

type CookieAuth struct {
	db     *sql.DB
	secret []byte
}

func NewCookie(database *sql.DB, secret []byte) *CookieAuth {
	return &CookieAuth{db: database, secret: secret}
}

func RandomSecret() ([]byte, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	return b, err
}

func (a *CookieAuth) CurrentUser(c *gin.Context) (*User, error) {
	id, err := a.userIDFromCookie(c)
	if err != nil {
		return nil, err
	}
	return a.loadUser(c.Request.Context(), id)
}

func (a *CookieAuth) HandleLogin(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid"})
		return
	}
	u, err := a.verifyPassword(c.Request.Context(), strings.TrimSpace(req.Username), req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "unauthorized"})
		return
	}
	token, err := issueToken(a.secret, u.ID, time.Now().Add(sessionTTL))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "unauthorized", "code": "internal"})
		return
	}
	setSessionCookie(c, token, cookieMaxAge)
	c.JSON(http.StatusOK, u)
}

func (a *CookieAuth) HandleLogout(c *gin.Context) {
	setSessionCookie(c, "", -1)
	c.Status(http.StatusOK)
}

func (a *CookieAuth) HandleMe(c *gin.Context) {
	u, err := a.CurrentUser(c)
	if err != nil || u == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "code": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, u)
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

func (a *CookieAuth) userIDFromCookie(c *gin.Context) (int64, error) {
	raw, err := c.Cookie(cookieName)
	if err != nil || raw == "" {
		return 0, errUnauthorized
	}
	id, exp, err := parseToken(a.secret, raw)
	if err != nil {
		return 0, errUnauthorized
	}
	if time.Now().After(exp) {
		return 0, errUnauthorized
	}
	return id, nil
}

func (a *CookieAuth) loadUser(ctx context.Context, id int64) (*User, error) {
	var u User
	err := a.db.QueryRowContext(ctx,
		`SELECT id, username, name FROM public.users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Username, &u.Name)
	if err != nil {
		return nil, errUnauthorized
	}
	return &u, nil
}

func (a *CookieAuth) verifyPassword(ctx context.Context, username, password string) (*User, error) {
	if username == "" || password == "" {
		return nil, errUnauthorized
	}
	var u User
	var hash string
	err := a.db.QueryRowContext(ctx,
		`SELECT id, username, name, password_hash FROM public.users WHERE username = $1`, username,
	).Scan(&u.ID, &u.Username, &u.Name, &hash)
	if err != nil {
		return nil, errUnauthorized
	}
	if hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return nil, errUnauthorized
	}
	return &u, nil
}

var errUnauthorized = errors.New("unauthorized")

func setSessionCookie(c *gin.Context, value string, maxAge int) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, value, maxAge, "/", "", false, true)
}

func issueToken(secret []byte, userID int64, exp time.Time) (string, error) {
	if len(secret) == 0 {
		return "", errUnauthorized
	}
	payload := make([]byte, 16)
	binary.BigEndian.PutUint64(payload[0:8], uint64(userID))
	binary.BigEndian.PutUint64(payload[8:16], uint64(exp.Unix()))
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(payload)
	sig := mac.Sum(nil)
	out := append(payload, sig...)
	return base64.RawURLEncoding.EncodeToString(out), nil
}

func parseToken(secret []byte, raw string) (int64, time.Time, error) {
	if len(secret) == 0 {
		return 0, time.Time{}, errUnauthorized
	}
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || len(b) != 48 {
		return 0, time.Time{}, errUnauthorized
	}
	payload, sig := b[:16], b[16:]
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(payload)
	if !hmac.Equal(mac.Sum(nil), sig) {
		return 0, time.Time{}, errUnauthorized
	}
	id := int64(binary.BigEndian.Uint64(payload[0:8]))
	exp := time.Unix(int64(binary.BigEndian.Uint64(payload[8:16])), 0)
	if id <= 0 {
		return 0, time.Time{}, errUnauthorized
	}
	return id, exp, nil
}

func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
