package main

import (
	"os"
	"path/filepath"
	"testing"
)

func newTestService(t *testing.T) *LauncherService {
	t.Helper()
	service, err := NewLauncherServiceAt(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = service.close() })
	return service
}

func TestGroupAndEntryCRUD(t *testing.T) {
	service := newTestService(t)
	group, err := service.CreateGroup(GroupInput{Name: "测试", Icon: "Boxes"})
	if err != nil {
		t.Fatal(err)
	}
	if group.Icon != "Boxes" {
		t.Fatalf("group icon was not saved: %#v", group)
	}
	group, err = service.UpdateGroup(group.ID, GroupInput{Name: "测试分组", Icon: "Rocket"})
	if err != nil {
		t.Fatal(err)
	}
	if group.Name != "测试分组" || group.Icon != "Rocket" {
		t.Fatalf("group was not updated: %#v", group)
	}
	entry, err := service.CreateEntry(EntryInput{
		GroupID: group.ID, Name: "打印", Icon: "Terminal", ScriptPath: "echo", Arguments: "hello",
	})
	if err != nil {
		t.Fatal(err)
	}
	if entry.GroupID != group.ID || entry.SortOrder != 0 {
		t.Fatalf("unexpected entry: %#v", entry)
	}

	updated, err := service.UpdateEntry(entry.ID, EntryInput{
		GroupID: group.ID, Name: "打印文本", Icon: "Code2", ScriptPath: "echo", Arguments: `"hello world"`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "打印文本" {
		t.Fatalf("entry was not updated: %#v", updated)
	}

	if err := service.DeleteGroup(group.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.getEntry(entry.ID); err == nil {
		t.Fatal("expected cascade delete")
	}
}

func TestReorderGroupsAndEntries(t *testing.T) {
	service := newTestService(t)
	first, _ := service.CreateGroup(GroupInput{Name: "A"})
	second, _ := service.CreateGroup(GroupInput{Name: "B"})
	if err := service.ReorderGroups([]int64{second.ID, first.ID}); err != nil {
		t.Fatal(err)
	}
	state, err := service.GetState()
	if err != nil {
		t.Fatal(err)
	}
	if state.Groups[0].ID != second.ID {
		t.Fatalf("expected group %d first, got %d", second.ID, state.Groups[0].ID)
	}

	one, _ := service.CreateEntry(EntryInput{GroupID: first.ID, Name: "1", ScriptPath: "echo"})
	two, _ := service.CreateEntry(EntryInput{GroupID: first.ID, Name: "2", ScriptPath: "echo"})
	if err := service.ReorderEntries(first.ID, []int64{two.ID, one.ID}); err != nil {
		t.Fatal(err)
	}
	state, _ = service.GetState()
	var ordered []int64
	for _, entry := range state.Entries {
		if entry.GroupID == first.ID {
			ordered = append(ordered, entry.ID)
		}
	}
	if len(ordered) != 2 || ordered[0] != two.ID {
		t.Fatalf("unexpected entry order: %v", ordered)
	}
}

func TestExecuteShellScript(t *testing.T) {
	service := newTestService(t)
	group, _ := service.CreateGroup(GroupInput{Name: "执行"})
	script := filepath.Join(t.TempDir(), "hello.sh")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nprintf 'hello %s' \"$1\"\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	entry, err := service.CreateEntry(EntryInput{
		GroupID: group.ID, Name: "Hello", ScriptPath: script, Arguments: "launcher",
	})
	if err != nil {
		t.Fatal(err)
	}
	result := service.ExecuteEntry(entry.ID)
	if result.Status != "success" || result.Output != "hello launcher" {
		t.Fatalf("unexpected result: %#v", result)
	}
	updated, err := service.getEntry(entry.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.ClickCount != 1 || updated.LastClickedAt == "" {
		t.Fatalf("click statistics were not recorded: %#v", updated)
	}
}

func TestTailBufferKeepsLatestOutput(t *testing.T) {
	var buffer tailBuffer
	first := make([]byte, maxExecutionOutput)
	for index := range first {
		first[index] = 'a'
	}
	if _, err := buffer.Write(first); err != nil {
		t.Fatal(err)
	}
	if _, err := buffer.Write([]byte("latest")); err != nil {
		t.Fatal(err)
	}
	output := buffer.String()
	if len(output) != maxExecutionOutput+4 || output[len(output)-6:] != "latest" {
		t.Fatalf("unexpected tail buffer output length=%d", len(output))
	}
}

func TestExecutionStreamWriterEmitsOutput(t *testing.T) {
	var output tailBuffer
	var event ExecutionEvent
	writer := executionStreamWriter{
		entryID: 7, entryName: "实时日志", stream: "stdout", output: &output,
		emit: func(value ExecutionEvent) { event = value },
	}

	if _, err := writer.Write([]byte("第一行\n")); err != nil {
		t.Fatal(err)
	}
	if output.String() != "第一行\n" {
		t.Fatalf("unexpected buffered output: %q", output.String())
	}
	if event.Kind != "output" || event.EntryID != 7 || event.Text != "第一行\n" {
		t.Fatalf("unexpected execution event: %#v", event)
	}
}
