//go:build darwin

package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

var (
	userShellPathOnce sync.Once
	userShellPath     string
)

// applyUserShellEnvironment supplies GUI-launched processes with the PATH that
// the user gets in an interactive terminal. Finder-launched applications
// otherwise inherit only macOS's small default PATH.
func applyUserShellEnvironment(command *exec.Cmd) {
	userShellPathOnce.Do(func() {
		shell := os.Getenv("SHELL")
		if shell == "" {
			shell = "/bin/zsh"
		}
		userShellPath = queryUserShellPath(shell, os.Environ())
	})
	if userShellPath == "" {
		return
	}
	command.Env = environmentWithValue(os.Environ(), "PATH", userShellPath)
}

func queryUserShellPath(shell string, environment []string) string {
	if !filepath.IsAbs(shell) {
		return ""
	}
	if info, err := os.Stat(shell); err != nil || info.IsDir() {
		return ""
	}

	const startMarker = "__SCRIPT_LAUNCHER_PATH_START__"
	const endMarker = "__SCRIPT_LAUNCHER_PATH_END__"
	probe := exec.Command(shell, "-l", "-i", "-c", "printf '"+startMarker+"%s"+endMarker+"' \"$PATH\"")
	probe.Env = environment
	output, err := probe.Output()
	if err != nil {
		return ""
	}

	start := bytes.LastIndex(output, []byte(startMarker))
	if start < 0 {
		return ""
	}
	start += len(startMarker)
	endOffset := bytes.Index(output[start:], []byte(endMarker))
	if endOffset < 0 {
		return ""
	}
	return strings.TrimSpace(string(output[start : start+endOffset]))
}

func environmentWithValue(environment []string, key, value string) []string {
	prefix := key + "="
	result := make([]string, 0, len(environment)+1)
	replaced := false
	for _, item := range environment {
		if strings.HasPrefix(item, prefix) {
			if !replaced {
				result = append(result, prefix+value)
				replaced = true
			}
			continue
		}
		result = append(result, item)
	}
	if !replaced {
		result = append(result, prefix+value)
	}
	return result
}
