package backup

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const retain = 14

func Dir() string {
	d := os.Getenv("BACKUP_DIR")
	if d == "" {
		return "backups"
	}
	return d
}

func dumpBin() string {
	b := os.Getenv("PGDUMP_BIN")
	if b == "" {
		return "pg_dump"
	}
	return b
}

func Start(dsn string) {
	go func() {
		runOnce(dsn)
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			runOnce(dsn)
		}
	}()
}

func runOnce(dsn string) {
	if err := Run(dsn, time.Now()); err != nil {
		log.Printf("backup: %v", err)
	}
}

func Run(dsn string, now time.Time) error {
	dir := Dir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", dir, err)
	}
	day := now.Format("2006-01-02")
	out := filepath.Join(dir, "record-"+day+".sql")
	if _, err := os.Stat(out); err == nil {
		return prune(dir)
	}
	cmd := exec.Command(dumpBin(), "--dbname="+dsn, "--no-owner", "--no-acl", "--file="+out)
	cmd.Env = os.Environ()
	output, err := cmd.CombinedOutput()
	if err != nil {
		_ = os.Remove(out)
		msg := strings.TrimSpace(string(output))
		if msg == "" {
			return fmt.Errorf("pg_dump: %w", err)
		}
		return fmt.Errorf("pg_dump: %w: %s", err, msg)
	}
	log.Printf("backup: wrote %s", out)
	return prune(dir)
}

func prune(dir string) error {
	matches, err := filepath.Glob(filepath.Join(dir, "record-*.sql"))
	if err != nil {
		return err
	}
	sort.Strings(matches)
	if len(matches) <= retain {
		return nil
	}
	for _, p := range matches[:len(matches)-retain] {
		if err := os.Remove(p); err != nil {
			log.Printf("backup: remove %s: %v", p, err)
			continue
		}
		log.Printf("backup: pruned %s", p)
	}
	return nil
}
