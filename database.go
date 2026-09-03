package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func defaultDatabasePath() (string, error) {
	if override := os.Getenv("SCRIPT_LAUNCHER_DATA_DIR"); override != "" {
		if err := os.MkdirAll(override, 0o755); err != nil {
			return "", fmt.Errorf("创建数据目录失败: %w", err)
		}
		return filepath.Join(override, "scriptlauncher.db"), nil
	}

	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("获取系统配置目录失败: %w", err)
	}
	dataDir := filepath.Join(base, "ScriptLauncher")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return "", fmt.Errorf("创建数据目录失败: %w", err)
	}
	return filepath.Join(dataDir, "scriptlauncher.db"), nil
}

func openDatabase(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}
	db.SetMaxOpenConns(1)

	pragmas := []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA journal_mode = WAL",
		"PRAGMA busy_timeout = 5000",
	}
	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("初始化数据库失败: %w", err)
		}
	}

	if err := migrateDatabase(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func migrateDatabase(db *sql.DB) error {
	const schema = `
CREATE TABLE IF NOT EXISTS groups (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	icon TEXT NOT NULL DEFAULT 'Folder',
	sort_order INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	group_id INTEGER NOT NULL,
	name TEXT NOT NULL,
	icon TEXT NOT NULL DEFAULT 'Terminal',
	script_path TEXT NOT NULL,
	working_directory TEXT NOT NULL DEFAULT '',
	arguments TEXT NOT NULL DEFAULT '',
	show_terminal INTEGER NOT NULL DEFAULT 0,
	sort_order INTEGER NOT NULL DEFAULT 0,
	click_count INTEGER NOT NULL DEFAULT 0,
	last_clicked_at TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_groups_sort ON groups(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_entries_group_sort ON entries(group_id, sort_order, id);

CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
`
	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("创建数据库表失败: %w", err)
	}
	if err := ensureColumn(db, "groups", "icon", "TEXT NOT NULL DEFAULT 'Folder'"); err != nil {
		return err
	}
	if err := ensureColumn(db, "entries", "click_count", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "entries", "last_clicked_at", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if _, err := db.Exec("CREATE INDEX IF NOT EXISTS idx_entries_click_count ON entries(click_count DESC, last_clicked_at DESC, id)"); err != nil {
		return fmt.Errorf("创建点击统计索引失败: %w", err)
	}

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM groups").Scan(&count); err != nil {
		return fmt.Errorf("检查初始数据失败: %w", err)
	}
	if count == 0 {
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		now := nowString()
		for index, name := range []string{"开发", "服务器", "日常工具"} {
			if _, err := tx.Exec(
				"INSERT INTO groups(name, sort_order, created_at, updated_at) VALUES(?, ?, ?, ?)",
				name, index, now, now,
			); err != nil {
				tx.Rollback()
				return fmt.Errorf("创建默认分组失败: %w", err)
			}
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("提交默认分组失败: %w", err)
		}
	}
	return nil
}

func ensureColumn(db *sql.DB, table, column, definition string) error {
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return fmt.Errorf("检查数据库字段失败: %w", err)
	}
	found := false
	for rows.Next() {
		var cid int
		var name, dataType string
		var notNull, primaryKey int
		var defaultValue any
		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return fmt.Errorf("读取数据库字段失败: %w", err)
		}
		if name == column {
			found = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if found {
		return nil
	}
	if _, err := db.Exec("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition); err != nil {
		return fmt.Errorf("升级数据库字段 %s 失败: %w", column, err)
	}
	return nil
}
