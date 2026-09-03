package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/shlex"
)

const maxExecutionOutput = 12 * 1024

type runningExecution struct {
	cmd  *exec.Cmd
	done chan struct{}

	mu            sync.Mutex
	stopRequested bool
}

func (execution *runningExecution) requestStop() {
	execution.mu.Lock()
	execution.stopRequested = true
	execution.mu.Unlock()
}

func (execution *runningExecution) wasStopRequested() bool {
	execution.mu.Lock()
	defer execution.mu.Unlock()
	return execution.stopRequested
}

func (s *LauncherService) ExecuteEntry(id int64) (result ExecutionResult) {
	started := time.Now()
	result = ExecutionResult{
		EntryID:   id,
		Status:    "failed",
		ExitCode:  -1,
		StartedAt: started.UTC().Format(time.RFC3339Nano),
	}
	entryName := ""
	defer func() {
		ended := time.Now()
		result.EndedAt = ended.UTC().Format(time.RFC3339Nano)
		result.DurationMS = ended.Sub(started).Milliseconds()
		s.emitExecutionEvent(ExecutionEvent{
			EntryID:    id,
			EntryName:  entryName,
			Kind:       "finished",
			Stream:     "system",
			Status:     result.Status,
			Error:      result.Error,
			ExitCode:   result.ExitCode,
			Timestamp:  result.EndedAt,
			DurationMS: result.DurationMS,
		})
	}()

	entry, err := s.getEntry(id)
	if err != nil {
		result.Error = err.Error()
		result.Message = "执行失败"
		return
	}
	entryName = entry.Name
	if err := s.recordEntryClick(id, result.StartedAt); err != nil {
		result.Error = err.Error()
		result.Message = "记录点击失败"
		return
	}
	s.emitExecutionEvent(ExecutionEvent{
		EntryID:   id,
		EntryName: entry.Name,
		Kind:      "started",
		Stream:    "system",
		Status:    "running",
		Timestamp: result.StartedAt,
	})

	cmd, err := prepareCommand(entry)
	if err != nil {
		result.Error = err.Error()
		result.Message = "无法启动"
		return
	}

	if entry.ShowTerminal {
		if err := launchInTerminal(cmd); err != nil {
			result.Error = err.Error()
			result.Message = "打开终端失败"
			return
		}
		s.emitExecutionEvent(ExecutionEvent{
			EntryID:   id,
			EntryName: entry.Name,
			Kind:      "output",
			Stream:    "system",
			Text:      "已在系统终端中启动，后续输出请在终端窗口中查看。\n",
			Status:    "running",
			Timestamp: nowString(),
		})
		result.Status = "success"
		result.ExitCode = 0
		result.Message = "已在终端中启动"
		return
	}

	var output tailBuffer
	cmd.Stdout = &executionStreamWriter{
		entryID: id, entryName: entry.Name, stream: "stdout",
		output: &output, emit: s.emitExecutionEvent,
	}
	cmd.Stderr = &executionStreamWriter{
		entryID: id, entryName: entry.Name, stream: "stderr",
		output: &output, emit: s.emitExecutionEvent,
	}
	running, err := s.startExecution(id, cmd)
	if err != nil {
		result.Error = err.Error()
		result.Message = "无法启动"
		return
	}
	defer s.finishExecution(id, running)

	err = cmd.Wait()
	result.Output = strings.TrimSpace(output.String())
	if running.wasStopRequested() {
		result.Status = "stopped"
		result.Message = "运行已终止"
		var exitError *exec.ExitError
		if errors.As(err, &exitError) {
			result.ExitCode = exitError.ExitCode()
		}
		return
	}
	if err != nil {
		result.Error = err.Error()
		result.Message = "执行失败"
		var exitError *exec.ExitError
		if errors.As(err, &exitError) {
			result.ExitCode = exitError.ExitCode()
		}
		return
	}

	result.Status = "success"
	result.ExitCode = 0
	result.Message = "执行成功"
	return
}

func (s *LauncherService) startExecution(entryID int64, cmd *exec.Cmd) (*runningExecution, error) {
	configureCommandForTermination(cmd)

	s.executionsMu.Lock()
	defer s.executionsMu.Unlock()
	if _, exists := s.executions[entryID]; exists {
		return nil, errors.New("该入口正在运行，请先终止当前进程")
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	running := &runningExecution{cmd: cmd, done: make(chan struct{})}
	s.executions[entryID] = running
	return running, nil
}

func (s *LauncherService) finishExecution(entryID int64, running *runningExecution) {
	s.executionsMu.Lock()
	if current := s.executions[entryID]; current == running {
		delete(s.executions, entryID)
		close(running.done)
	}
	s.executionsMu.Unlock()
}

// StopEntry terminates the running process and all child processes started by it.
func (s *LauncherService) StopEntry(entryID int64) error {
	s.executionsMu.Lock()
	running := s.executions[entryID]
	if running == nil {
		s.executionsMu.Unlock()
		return errors.New("该入口当前没有运行中的进程")
	}
	running.requestStop()
	s.executionsMu.Unlock()

	s.emitExecutionEvent(ExecutionEvent{
		EntryID:   entryID,
		Kind:      "output",
		Stream:    "system",
		Text:      "正在终止进程…\n",
		Status:    "running",
		Timestamp: nowString(),
	})
	if err := terminateCommand(running.cmd, running.done); err != nil {
		return fmt.Errorf("终止进程失败: %w", err)
	}
	return nil
}

func (s *LauncherService) stopAllExecutions() {
	s.executionsMu.Lock()
	entryIDs := make([]int64, 0, len(s.executions))
	for entryID := range s.executions {
		entryIDs = append(entryIDs, entryID)
	}
	s.executionsMu.Unlock()
	for _, entryID := range entryIDs {
		_ = s.StopEntry(entryID)
	}
}

func (s *LauncherService) emitExecutionEvent(event ExecutionEvent) {
	if s.app == nil {
		return
	}
	s.app.Event.Emit("execution:log", event)
}

func prepareCommand(entry Entry) (*exec.Cmd, error) {
	args, err := shlex.Split(entry.Arguments)
	if err != nil {
		return nil, fmt.Errorf("启动参数格式不正确: %w", err)
	}

	scriptPath := expandHome(entry.ScriptPath)
	info, statErr := os.Stat(scriptPath)
	pathExists := statErr == nil
	if pathExists && info.IsDir() && strings.ToLower(filepath.Ext(scriptPath)) != ".app" {
		return nil, errors.New("脚本路径不能是普通目录")
	}
	if statErr != nil && !errors.Is(statErr, os.ErrNotExist) {
		return nil, fmt.Errorf("读取脚本失败: %w", statErr)
	}

	var cmd *exec.Cmd
	extension := strings.ToLower(filepath.Ext(scriptPath))
	if pathExists && runtime.GOOS != "windows" && isScriptExtension(extension) {
		shebangCommand, found, err := commandFromShebang(scriptPath, args)
		if err != nil {
			return nil, err
		}
		if found {
			cmd = shebangCommand
		}
	}

	if cmd == nil {
		switch extension {
		case ".sh", ".bash":
			cmd = exec.Command("sh", append([]string{scriptPath}, args...)...)
		case ".zsh":
			cmd = exec.Command("zsh", append([]string{scriptPath}, args...)...)
		case ".py":
			interpreter := "python3"
			if runtime.GOOS == "windows" {
				interpreter = "python"
			}
			cmd = exec.Command(interpreter, append([]string{scriptPath}, args...)...)
		case ".js", ".mjs", ".cjs":
			cmd = exec.Command("node", append([]string{scriptPath}, args...)...)
		case ".ps1":
			interpreter := "pwsh"
			if _, err := exec.LookPath(interpreter); err != nil && runtime.GOOS == "windows" {
				interpreter = "powershell"
			}
			cmd = exec.Command(interpreter, append([]string{"-File", scriptPath}, args...)...)
		case ".bat", ".cmd":
			if runtime.GOOS != "windows" {
				return nil, errors.New("Batch 脚本仅支持在 Windows 上运行")
			}
			cmd = exec.Command("cmd", append([]string{"/C", scriptPath}, args...)...)
		case ".app":
			if runtime.GOOS != "darwin" {
				return nil, errors.New("macOS App 仅支持在 macOS 上运行")
			}
			openArgs := []string{"-a", scriptPath}
			if len(args) > 0 {
				openArgs = append(openArgs, "--args")
				openArgs = append(openArgs, args...)
			}
			cmd = exec.Command("open", openArgs...)
		default:
			if !pathExists {
				resolved, err := exec.LookPath(scriptPath)
				if err != nil {
					return nil, fmt.Errorf("找不到脚本、程序或命令: %s", entry.ScriptPath)
				}
				scriptPath = resolved
			}
			cmd = exec.Command(scriptPath, args...)
		}
	}

	if entry.WorkingDirectory != "" {
		directory := expandHome(entry.WorkingDirectory)
		info, err := os.Stat(directory)
		if err != nil {
			return nil, fmt.Errorf("工作目录不可用: %w", err)
		}
		if !info.IsDir() {
			return nil, errors.New("工作目录不是文件夹")
		}
		cmd.Dir = directory
	} else if pathExists && extension != ".app" {
		cmd.Dir = filepath.Dir(scriptPath)
	}
	applyUserShellEnvironment(cmd)
	return cmd, nil
}

func isScriptExtension(extension string) bool {
	switch extension {
	case ".sh", ".bash", ".zsh", ".py", ".js", ".mjs", ".cjs", ".ps1":
		return true
	default:
		return false
	}
}

func commandFromShebang(scriptPath string, args []string) (*exec.Cmd, bool, error) {
	file, err := os.Open(scriptPath)
	if err != nil {
		return nil, false, fmt.Errorf("读取脚本解释器失败: %w", err)
	}
	defer file.Close()

	line, err := bufio.NewReader(file).ReadString('\n')
	if err != nil && len(line) == 0 {
		return nil, false, fmt.Errorf("读取脚本解释器失败: %w", err)
	}
	line = strings.TrimSpace(line)
	if !strings.HasPrefix(line, "#!") {
		return nil, false, nil
	}
	parts, err := shlex.Split(strings.TrimSpace(strings.TrimPrefix(line, "#!")))
	if err != nil {
		return nil, false, fmt.Errorf("脚本 shebang 格式不正确: %w", err)
	}
	if len(parts) == 0 {
		return nil, false, errors.New("脚本 shebang 未指定解释器")
	}
	commandArgs := append([]string{}, parts[1:]...)
	commandArgs = append(commandArgs, scriptPath)
	commandArgs = append(commandArgs, args...)
	return exec.Command(parts[0], commandArgs...), true, nil
}

func expandHome(path string) string {
	if path == "~" || strings.HasPrefix(path, "~/") || strings.HasPrefix(path, `~\`) {
		if home, err := os.UserHomeDir(); err == nil {
			if len(path) == 1 {
				return home
			}
			return filepath.Join(home, path[2:])
		}
	}
	return path
}

type tailBuffer struct {
	mu        sync.Mutex
	data      []byte
	truncated bool
}

func (b *tailBuffer) Write(chunk []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	originalLength := len(chunk)
	if originalLength >= maxExecutionOutput {
		b.data = append(b.data[:0], chunk[originalLength-maxExecutionOutput:]...)
		b.truncated = true
		return originalLength, nil
	}
	b.data = append(b.data, chunk...)
	if overflow := len(b.data) - maxExecutionOutput; overflow > 0 {
		copy(b.data, b.data[overflow:])
		b.data = b.data[:maxExecutionOutput]
		b.truncated = true
	}
	return originalLength, nil
}

func (b *tailBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.truncated {
		return "…\n" + string(b.data)
	}
	return string(b.data)
}

type executionStreamWriter struct {
	entryID   int64
	entryName string
	stream    string
	output    *tailBuffer
	emit      func(ExecutionEvent)
}

func (w *executionStreamWriter) Write(chunk []byte) (int, error) {
	length, err := w.output.Write(chunk)
	if length > 0 && w.emit != nil {
		w.emit(ExecutionEvent{
			EntryID:   w.entryID,
			EntryName: w.entryName,
			Kind:      "output",
			Stream:    w.stream,
			Text:      string(chunk[:length]),
			Status:    "running",
			Timestamp: nowString(),
		})
	}
	return length, err
}

func shellJoin(args []string) string {
	quoted := make([]string, 0, len(args))
	for _, arg := range args {
		if arg == "" {
			quoted = append(quoted, "''")
			continue
		}
		quoted = append(quoted, "'"+strings.ReplaceAll(arg, "'", "'\"'\"'")+"'")
	}
	return strings.Join(quoted, " ")
}
