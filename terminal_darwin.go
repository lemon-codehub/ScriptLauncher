//go:build darwin

package main

import (
	"os/exec"
	"strings"
)

func launchInTerminal(command *exec.Cmd) error {
	line := shellJoin(command.Args)
	if command.Dir != "" {
		line = "cd " + shellJoin([]string{command.Dir}) + " && " + line
	}
	line += `; status=$?; printf "\n\n进程已结束，退出码：%s\n" "$status"`
	script := `tell application "Terminal"
activate
do script "` + escapeAppleScript(line) + `"
end tell`
	return exec.Command("osascript", "-e", script).Run()
}

func escapeAppleScript(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `"`, `\"`)
	return value
}
