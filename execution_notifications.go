package main

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

type notificationBackend interface {
	ServiceStartup(context.Context, application.ServiceOptions) error
	ServiceShutdown() error
	RequestNotificationAuthorization() (bool, error)
	CheckNotificationAuthorization() (bool, error)
	SendNotification(notifications.NotificationOptions) error
	OnNotificationResponse(func(notifications.NotificationResult))
}

type executionNotifications struct {
	app          *application.App
	backend      notificationBackend
	isForeground func() bool
	openLog      func(int64)
	ctx          context.Context
	ready        chan struct{}
	available    bool
	closing      atomic.Bool
}

func newExecutionNotifications(app *application.App, window *application.WebviewWindow) *executionNotifications {
	// On macOS a window may remain key while its application is inactive.
	// Track application activation as well as the native window focus state.
	var active atomic.Bool
	active.Store(true)
	app.Event.OnApplicationEvent(events.Mac.ApplicationDidBecomeActive, func(*application.ApplicationEvent) {
		active.Store(true)
	})
	app.Event.OnApplicationEvent(events.Mac.ApplicationDidResignActive, func(*application.ApplicationEvent) {
		active.Store(false)
	})
	return &executionNotifications{
		app: app, backend: notifications.New(), ready: make(chan struct{}),
		isForeground: func() bool {
			if !active.Load() {
				return false
			}
			for _, candidate := range app.Window.GetAll() {
				if candidate.IsVisible() && !candidate.IsMinimised() && candidate.IsFocused() {
					return true
				}
			}
			return false
		},
		openLog: func(entryID int64) {
			window.Show()
			if window.IsMinimised() {
				window.UnMinimise()
			}
			window.Focus()
			app.Event.Emit("execution:open-log", entryID)
		},
	}
}

func (n *executionNotifications) start(ctx context.Context, options application.ServiceOptions) {
	n.ctx = ctx
	if err := n.backend.ServiceStartup(ctx, options); err != nil {
		log.Printf("系统通知不可用: %v", err)
		close(n.ready)
		return
	}
	n.available = true
	n.backend.OnNotificationResponse(n.handleResponse)
	// Ask after the app has opened. Waiting for the system permission dialog
	// must not block startup or an execution result.
	var once sync.Once
	n.app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		once.Do(func() {
			go func() {
				defer close(n.ready)
				if authorized, err := n.backend.RequestNotificationAuthorization(); err != nil {
					log.Printf("请求系统通知权限失败: %v", err)
				} else if !authorized {
					log.Print("系统通知未获授权，可在系统设置中允许 Script Launcher 发送通知")
				}
			}()
		})
	})
}

func (n *executionNotifications) shutdown() {
	n.closing.Store(true)
	if n.available {
		if err := n.backend.ServiceShutdown(); err != nil {
			log.Printf("关闭系统通知失败: %v", err)
		}
	}
}

func (n *executionNotifications) notifyCompletion(entryName string, result ExecutionResult) {
	if !n.available || n.closing.Load() || (result.Status != "success" && result.Status != "failed") || n.isForeground() {
		return
	}
	go n.deliver(entryName, result)
}

func (n *executionNotifications) deliver(entryName string, result ExecutionResult) {
	select {
	case <-n.ctx.Done():
		return
	case <-n.ready:
	}
	if n.closing.Load() || n.ctx.Err() != nil {
		return
	}
	// Recheck permission so enabling notifications in system settings takes
	// effect without restarting the launcher.
	authorized, err := n.backend.CheckNotificationAuthorization()
	if err != nil {
		log.Printf("检查系统通知权限失败: %v", err)
		return
	}
	if !authorized || n.closing.Load() || n.ctx.Err() != nil || n.isForeground() {
		return
	}
	if err := n.backend.SendNotification(completionNotification(entryName, result)); err != nil {
		log.Printf("发送任务完成通知失败: %v", err)
	}
}

func completionNotification(entryName string, result ExecutionResult) notifications.NotificationOptions {
	name := strings.Join(strings.Fields(entryName), " ")
	if name == "" {
		name = fmt.Sprintf("入口 %d", result.EntryID)
	}
	if runes := []rune(name); len(runes) > 80 {
		name = string(runes[:80]) + "…"
	}
	title := "任务执行成功"
	body := fmt.Sprintf("%s\n已完成，用时 %.1f 秒。点击查看执行日志。", name, float64(result.DurationMS)/1000)
	if result.Status == "failed" {
		title = "任务执行失败"
		body = fmt.Sprintf("%s\n退出码 %d。点击查看错误信息和执行日志。", name, result.ExitCode)
	}
	return notifications.NotificationOptions{
		ID:    fmt.Sprintf("execution-%d-%d", result.EntryID, time.Now().UnixNano()),
		Title: title, Body: body,
		ThreadID: fmt.Sprintf("entry-%d", result.EntryID),
		Data:     map[string]interface{}{"entryId": strconv.FormatInt(result.EntryID, 10)},
	}
}

func (n *executionNotifications) handleResponse(result notifications.NotificationResult) {
	if result.Error != nil || n.closing.Load() {
		return
	}
	action := result.Response.ActionIdentifier
	if action != notifications.DefaultActionIdentifier && action != "com.apple.UNNotificationDefaultActionIdentifier" {
		return
	}
	entryID, err := strconv.ParseInt(fmt.Sprint(result.Response.UserInfo["entryId"]), 10, 64)
	if err != nil || entryID <= 0 {
		return
	}
	n.openLog(entryID)
}
