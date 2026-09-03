//go:build !windows

package main

import (
	"errors"
	"os/exec"
	"syscall"
	"time"
)

const processStopGracePeriod = 1500 * time.Millisecond

func configureCommandForTermination(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setpgid = true
}

func terminateCommand(cmd *exec.Cmd, done <-chan struct{}) error {
	if cmd == nil || cmd.Process == nil {
		return errors.New("进程尚未启动")
	}

	processGroupID := -cmd.Process.Pid
	if err := syscall.Kill(processGroupID, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
		return err
	}
	select {
	case <-done:
		return nil
	case <-time.After(processStopGracePeriod):
	}

	if err := syscall.Kill(processGroupID, syscall.SIGKILL); err != nil && !errors.Is(err, syscall.ESRCH) {
		return err
	}
	select {
	case <-done:
		return nil
	case <-time.After(processStopGracePeriod):
		return errors.New("等待进程退出超时")
	}
}
