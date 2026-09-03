//go:build windows

package main

import (
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"syscall"
	"time"
)

const processStopGracePeriod = 3 * time.Second

func configureCommandForTermination(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.CreationFlags |= syscall.CREATE_NEW_PROCESS_GROUP
}

func terminateCommand(cmd *exec.Cmd, done <-chan struct{}) error {
	if cmd == nil || cmd.Process == nil {
		return errors.New("进程尚未启动")
	}

	pid := strconv.Itoa(cmd.Process.Pid)
	if err := exec.Command("taskkill", "/PID", pid, "/T", "/F").Run(); err != nil {
		select {
		case <-done:
			return nil
		default:
		}
		if killErr := cmd.Process.Kill(); killErr != nil {
			return fmt.Errorf("taskkill: %v; kill: %w", err, killErr)
		}
	}
	select {
	case <-done:
		return nil
	case <-time.After(processStopGracePeriod):
		return errors.New("等待进程退出超时")
	}
}
