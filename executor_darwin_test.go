//go:build darwin

package main

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestShellScriptHonorsZshShebang(t *testing.T) {
	service := newTestService(t)
	group, err := service.CreateGroup(GroupInput{Name: "Shebang"})
	if err != nil {
		t.Fatal(err)
	}

	script := filepath.Join(t.TempDir(), "uses-zsh.sh")
	content := "#!/bin/zsh\nif [[ -n \"$ZSH_VERSION\" ]]; then printf 'zsh'; else printf 'wrong-shell'; fi\n"
	if err := os.WriteFile(script, []byte(content), 0o755); err != nil {
		t.Fatal(err)
	}
	entry, err := service.CreateEntry(EntryInput{
		GroupID: group.ID, Name: "Zsh Script", ScriptPath: script,
	})
	if err != nil {
		t.Fatal(err)
	}

	result := service.ExecuteEntry(entry.ID)
	if result.Status != "success" || result.Output != "zsh" {
		t.Fatalf("expected zsh shebang to be honored, got %#v", result)
	}
}

func TestQueryUserShellPathLoadsInteractiveConfiguration(t *testing.T) {
	configDirectory := t.TempDir()
	if err := os.WriteFile(
		filepath.Join(configDirectory, ".zshrc"),
		[]byte("export PATH=\"/tmp/script-launcher-pnpm-bin:$PATH\"\n"),
		0o600,
	); err != nil {
		t.Fatal(err)
	}

	environment := environmentWithValue(os.Environ(), "ZDOTDIR", configDirectory)
	path := queryUserShellPath("/bin/zsh", environment)
	if !strings.HasPrefix(path, "/tmp/script-launcher-pnpm-bin:") {
		t.Fatalf("interactive shell PATH was not loaded: %q", path)
	}
}

func TestEnvironmentWithValueReplacesDuplicateValues(t *testing.T) {
	environment := environmentWithValue([]string{"A=1", "PATH=/bin", "PATH=/usr/bin", "B=2"}, "PATH", "/custom/bin")
	expected := []string{"A=1", "PATH=/custom/bin", "B=2"}
	if len(environment) != len(expected) {
		t.Fatalf("unexpected environment: %#v", environment)
	}
	for index := range expected {
		if environment[index] != expected[index] {
			t.Fatalf("unexpected environment: %#v", environment)
		}
	}
}

func TestPreparedScriptInheritsInteractiveShellPath(t *testing.T) {
	configDirectory := t.TempDir()
	binaryDirectory := filepath.Join(t.TempDir(), "bin")
	if err := os.MkdirAll(binaryDirectory, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(configDirectory, ".zshrc"),
		[]byte("export PATH=\""+binaryDirectory+":$PATH\"\n"),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(binaryDirectory, "script-launcher-tool"),
		[]byte("#!/bin/sh\nprintf 'loaded-from-user-path'\n"),
		0o755,
	); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(t.TempDir(), "run-tool.sh")
	if err := os.WriteFile(
		script,
		[]byte("#!/bin/zsh\nscript-launcher-tool\n"),
		0o755,
	); err != nil {
		t.Fatal(err)
	}

	t.Setenv("ZDOTDIR", configDirectory)
	t.Setenv("SHELL", "/bin/zsh")
	t.Setenv("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
	userShellPathOnce = sync.Once{}
	userShellPath = ""
	t.Cleanup(func() {
		userShellPathOnce = sync.Once{}
		userShellPath = ""
	})

	command, err := prepareCommand(Entry{ScriptPath: script})
	if err != nil {
		t.Fatal(err)
	}
	output, err := command.Output()
	if err != nil {
		t.Fatal(err)
	}
	if string(output) != "loaded-from-user-path" {
		t.Fatalf("unexpected script output: %q", output)
	}
}
