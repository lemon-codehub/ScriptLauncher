//go:build !windows

package main

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestStopEntryTerminatesProcessGroup(t *testing.T) {
	service := newTestService(t)
	group, err := service.CreateGroup(GroupInput{Name: "终止测试"})
	if err != nil {
		t.Fatal(err)
	}

	directory := t.TempDir()
	childPIDPath := filepath.Join(directory, "child.pid")
	scriptPath := filepath.Join(directory, "long-running.sh")
	script := "#!/bin/sh\nsleep 30 &\nchild=$!\nprintf '%s' \"$child\" > \"$1\"\nwait \"$child\"\n"
	if err := os.WriteFile(scriptPath, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	entry, err := service.CreateEntry(EntryInput{
		GroupID:    group.ID,
		Name:       "长时间任务",
		ScriptPath: scriptPath,
		Arguments:  shellJoin([]string{childPIDPath}),
	})
	if err != nil {
		t.Fatal(err)
	}

	resultChannel := make(chan ExecutionResult, 1)
	go func() {
		resultChannel <- service.ExecuteEntry(entry.ID)
	}()

	var childPID int
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		contents, readErr := os.ReadFile(childPIDPath)
		if readErr == nil {
			childPID, err = strconv.Atoi(strings.TrimSpace(string(contents)))
			if err == nil && childPID > 0 {
				break
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	if childPID <= 0 {
		t.Fatal("child process did not start")
	}

	if err := service.StopEntry(entry.ID); err != nil {
		t.Fatal(err)
	}
	select {
	case result := <-resultChannel:
		if result.Status != "stopped" || result.Message != "运行已终止" {
			t.Fatalf("unexpected stopped result: %#v", result)
		}
	case <-time.After(4 * time.Second):
		t.Fatal("execution did not finish after stop")
	}

	deadline = time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		err = syscall.Kill(childPID, 0)
		if errors.Is(err, syscall.ESRCH) {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("child process %d is still running", childPID)
}

func TestStopEntryRejectsInactiveEntry(t *testing.T) {
	service := newTestService(t)
	if err := service.StopEntry(42); err == nil {
		t.Fatal("expected an error for an inactive entry")
	}
}
