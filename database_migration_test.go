package main

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestExistingDatabaseGainsClickStatistics(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
		CREATE TABLE groups (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id INTEGER NOT NULL,
			name TEXT NOT NULL,
			icon TEXT NOT NULL DEFAULT 'Terminal',
			script_path TEXT NOT NULL,
			working_directory TEXT NOT NULL DEFAULT '',
			arguments TEXT NOT NULL DEFAULT '',
			show_terminal INTEGER NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
		);
		INSERT INTO groups(id, name, sort_order, created_at, updated_at)
		VALUES(1, '旧分组', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
		INSERT INTO entries(
			id, group_id, name, icon, script_path, working_directory, arguments,
			show_terminal, sort_order, created_at, updated_at
		) VALUES(
			1, 1, '旧入口', 'Terminal', 'echo', '', 'hello',
			0, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
		);
	`)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	service, err := NewLauncherServiceAt(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = service.close() })
	state, err := service.GetState()
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Groups) != 1 || state.Groups[0].Icon != "Folder" {
		t.Fatalf("legacy group icon was not migrated: %#v", state.Groups)
	}

	entry, err := service.getEntry(1)
	if err != nil {
		t.Fatal(err)
	}
	if entry.ClickCount != 0 || entry.LastClickedAt != "" {
		t.Fatalf("unexpected migrated statistics: %#v", entry)
	}

	result := service.ExecuteEntry(1)
	if result.Status != "success" {
		t.Fatalf("unexpected execution result: %#v", result)
	}
	entry, err = service.getEntry(1)
	if err != nil {
		t.Fatal(err)
	}
	if entry.ClickCount != 1 || entry.LastClickedAt == "" {
		t.Fatalf("click statistics were not recorded: %#v", entry)
	}
}
