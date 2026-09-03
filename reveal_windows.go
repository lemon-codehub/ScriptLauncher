//go:build windows

package main

import (
	"os/exec"
	"path/filepath"
)

func revealInFileManager(path string) error {
	return exec.Command("explorer", "/select,"+filepath.Clean(path)).Run()
}
