//go:build linux

package main

import (
	"os"
	"os/exec"
	"path/filepath"
)

func revealInFileManager(path string) error {
	target := filepath.Dir(path)
	if info, err := os.Stat(path); err == nil && info.IsDir() {
		target = path
	}
	return exec.Command("xdg-open", target).Run()
}
