package db

import (
	"fmt"
	"regexp"
	"strings"
)

var schemaNameRe = regexp.MustCompile(`^user_[0-9]+$`)

func SchemaName(userID int64) string {
	return fmt.Sprintf("user_%d", userID)
}

func ValidateSchemaName(name string) error {
	if !schemaNameRe.MatchString(name) {
		return fmt.Errorf("invalid schema name %q", name)
	}
	return nil
}

func QuoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
