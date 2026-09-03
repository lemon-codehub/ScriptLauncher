//go:build windows

package main

import (
	"os/exec"
	"strings"
)

func launchInTerminal(command *exec.Cmd) error {
	line := windowsCommandLine(command.Args)
	if command.Dir != "" {
		line = `cd /d "` + strings.ReplaceAll(command.Dir, `"`, `""`) + `" && ` + line
	}
	return exec.Command("cmd", "/C", "start", "", "cmd", "/K", line).Run()
}

func windowsCommandLine(args []string) string {
	quoted := make([]string, len(args))
	for index, arg := range args {
		quoted[index] = `"` + strings.ReplaceAll(arg, `"`, `\"`) + `"`
	}
	return strings.Join(quoted, " ")
}
