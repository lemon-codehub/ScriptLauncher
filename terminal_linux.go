//go:build linux

package main

import (
	"errors"
	"os/exec"
)

func launchInTerminal(command *exec.Cmd) error {
	line := shellJoin(command.Args)
	if command.Dir != "" {
		line = "cd " + shellJoin([]string{command.Dir}) + " && " + line
	}
	line += `; status=$?; printf "\n\n进程已结束，退出码：%s\n" "$status"; exec bash`
	for _, terminal := range []string{"x-terminal-emulator", "gnome-terminal", "konsole"} {
		if _, err := exec.LookPath(terminal); err != nil {
			continue
		}
		switch terminal {
		case "gnome-terminal":
			return exec.Command(terminal, "--", "bash", "-lc", line).Run()
		case "konsole":
			return exec.Command(terminal, "-e", "bash", "-lc", line).Run()
		default:
			return exec.Command(terminal, "-e", "bash", "-lc", line).Run()
		}
	}
	return errors.New("未找到可用的终端程序")
}
