package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveEntryPathUsesWorkingDirectory(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "deploy.sh")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	resolved, err := resolveEntryPath(Entry{ScriptPath: "deploy.sh", WorkingDirectory: directory})
	if err != nil {
		t.Fatal(err)
	}
	if resolved != path {
		t.Fatalf("resolved path = %q, want %q", resolved, path)
	}
}

func TestResolveEntryPathRejectsShellExpression(t *testing.T) {
	if _, err := resolveEntryPath(Entry{ScriptPath: "echo hello"}); err == nil {
		t.Fatal("expected unresolved path error")
	}
}
