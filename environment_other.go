//go:build !darwin

package main

import "os/exec"

func applyUserShellEnvironment(_ *exec.Cmd) {}
