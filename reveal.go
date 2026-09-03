package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func resolveEntryPath(entry Entry) (string, error) {
	path := expandHome(strings.TrimSpace(entry.ScriptPath))
	if path == "" {
		return "", errors.New("脚本路径为空")
	}
	if !filepath.IsAbs(path) && strings.TrimSpace(entry.WorkingDirectory) != "" {
		path = filepath.Join(expandHome(strings.TrimSpace(entry.WorkingDirectory)), path)
	}
	if absolute, err := filepath.Abs(path); err == nil {
		if _, statErr := os.Stat(absolute); statErr == nil {
			return absolute, nil
		}
	}
	if executable, err := exec.LookPath(strings.TrimSpace(entry.ScriptPath)); err == nil {
		if absolute, absErr := filepath.Abs(executable); absErr == nil {
			return absolute, nil
		}
		return executable, nil
	}
	return "", errors.New("脚本路径不是可定位的本地文件")
}
