package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	application.RegisterEvent[ExecutionEvent]("execution:log")
	application.RegisterEvent[int64]("execution:open-log")
}

func main() {
	service, err := NewLauncherService()
	if err != nil {
		log.Fatal(err)
	}
	defer service.close()

	app := application.New(application.Options{
		Name:        "Script Launcher",
		Description: "统一管理和执行本地脚本、程序及常用命令",
		Services: []application.Service{
			application.NewService(service),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	service.setApp(app)

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "Script Launcher",
		Width:     1180,
		Height:    760,
		MinWidth:  860,
		MinHeight: 560,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(246, 247, 249),
		URL:              "/",
	})
	service.notifications = newExecutionNotifications(app, window)

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
