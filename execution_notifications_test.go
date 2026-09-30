package main

import (
	"context"
	"errors"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

type testNotificationBackend struct {
	authorized bool
	startupErr error
	sendErr    error
	sent       chan notifications.NotificationOptions
	checks     atomic.Int32
}

func (b *testNotificationBackend) ServiceStartup(context.Context, application.ServiceOptions) error {
	return b.startupErr
}
func (b *testNotificationBackend) ServiceShutdown() error { return nil }
func (b *testNotificationBackend) RequestNotificationAuthorization() (bool, error) {
	return b.authorized, nil
}
func (b *testNotificationBackend) CheckNotificationAuthorization() (bool, error) {
	b.checks.Add(1)
	return b.authorized, nil
}
func (b *testNotificationBackend) SendNotification(options notifications.NotificationOptions) error {
	b.sent <- options
	return b.sendErr
}
func (b *testNotificationBackend) OnNotificationResponse(func(notifications.NotificationResult)) {}

func newTestNotifications(t *testing.T) (*executionNotifications, *testNotificationBackend) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	backend := &testNotificationBackend{authorized: true, sent: make(chan notifications.NotificationOptions, 4)}
	n := &executionNotifications{
		backend: backend, ctx: ctx, available: true, ready: make(chan struct{}),
		isForeground: func() bool { return false },
	}
	close(n.ready)
	return n, backend
}

func TestExecuteEntryBackgroundNotifications(t *testing.T) {
	for _, status := range []string{"success", "failed"} {
		t.Run(status, func(t *testing.T) {
			service := newTestService(t)
			n, backend := newTestNotifications(t)
			service.notifications = n
			group, err := service.CreateGroup(GroupInput{Name: "通知测试"})
			if err != nil {
				t.Fatal(err)
			}
			exitCode := "0"
			if status == "failed" {
				exitCode = "7"
			}
			path, args := "sh", "-c 'exit "+exitCode+"'"
			if runtime.GOOS == "windows" {
				path, args = "cmd.exe", "/C exit "+exitCode
			}
			entry, err := service.CreateEntry(EntryInput{GroupID: group.ID, Name: "测试部署", ScriptPath: path, Arguments: args})
			if err != nil {
				t.Fatal(err)
			}
			result := service.ExecuteEntry(entry.ID)
			if result.Status != status {
				t.Fatalf("result = %#v", result)
			}
			select {
			case notification := <-backend.sent:
				if !strings.Contains(notification.Body, entry.Name) || notification.Data["entryId"] != "1" {
					t.Fatalf("notification = %#v", notification)
				}
				if status == "success" && notification.Title != "任务执行成功" {
					t.Fatal(notification.Title)
				}
				if status == "failed" && (notification.Title != "任务执行失败" || !strings.Contains(notification.Body, "退出码 7")) {
					t.Fatalf("notification = %#v", notification)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("background completion notification was not sent")
			}
		})
	}
}

func TestCompletionNotificationsSuppressed(t *testing.T) {
	for _, status := range []string{"success", "failed", "stopped", "running"} {
		t.Run(status, func(t *testing.T) {
			n, backend := newTestNotifications(t)
			n.isForeground = func() bool { return status == "success" || status == "failed" }
			n.notifyCompletion("部署", ExecutionResult{EntryID: 1, Status: status})
			if backend.checks.Load() != 0 {
				t.Fatal("foreground/stopped execution attempted a notification")
			}
			select {
			case <-backend.sent:
				t.Fatal("unexpected notification")
			default:
			}
		})
	}
}

func TestNotificationDeliveryRechecksFocusAndPermission(t *testing.T) {
	for _, condition := range []string{"foreground", "denied", "cancelled", "shutdown"} {
		t.Run(condition, func(t *testing.T) {
			n, backend := newTestNotifications(t)
			switch condition {
			case "foreground":
				n.isForeground = func() bool { return true }
			case "denied":
				backend.authorized = false
			case "cancelled":
				ctx, cancel := context.WithCancel(context.Background())
				cancel()
				n.ctx = ctx
			case "shutdown":
				n.shutdown()
			}
			n.deliver("部署", ExecutionResult{EntryID: 1, Status: "success"})
			select {
			case <-backend.sent:
				t.Fatal("unexpected notification")
			default:
			}
		})
	}
}

func TestNotificationPermissionWaitDoesNotBlockCompletion(t *testing.T) {
	n, backend := newTestNotifications(t)
	n.ready = make(chan struct{})
	returned := make(chan struct{})
	go func() {
		n.notifyCompletion("部署", ExecutionResult{EntryID: 1, Status: "success"})
		close(returned)
	}()
	select {
	case <-returned:
	case <-time.After(time.Second):
		t.Fatal("completion blocked on notification permission")
	}
	select {
	case <-backend.sent:
		t.Fatal("notification sent before authorization completed")
	default:
	}
	close(n.ready)
	select {
	case <-backend.sent:
	case <-time.After(time.Second):
		t.Fatal("notification not sent after authorization")
	}
}

func TestNotificationStartupFailureIsOptional(t *testing.T) {
	n, backend := newTestNotifications(t)
	n.available = false
	n.ready = make(chan struct{})
	backend.startupErr = errors.New("no bundle identifier")
	service := &LauncherService{notifications: n}
	if err := service.ServiceStartup(context.Background(), application.ServiceOptions{}); err != nil {
		t.Fatal(err)
	}
	n.notifyCompletion("部署", ExecutionResult{EntryID: 1, Status: "success"})
	if backend.checks.Load() != 0 {
		t.Fatal("unavailable notifications should be skipped")
	}
}

func TestNotificationClickSelectsExecutionLog(t *testing.T) {
	n, _ := newTestNotifications(t)
	var opened int64
	n.openLog = func(id int64) { opened = id }
	for _, action := range []string{notifications.DefaultActionIdentifier, "com.apple.UNNotificationDefaultActionIdentifier"} {
		n.handleResponse(notifications.NotificationResult{Response: notifications.NotificationResponse{
			ActionIdentifier: action, UserInfo: map[string]interface{}{"entryId": "42"},
		}})
		if opened != 42 {
			t.Fatal("notification did not select the correct task")
		}
		opened = 0
	}
	n.handleResponse(notifications.NotificationResult{Response: notifications.NotificationResponse{
		ActionIdentifier: "dismiss", UserInfo: map[string]interface{}{"entryId": "42"},
	}})
	if opened != 0 {
		t.Fatal("dismissing a notification reopened the launcher")
	}
}
