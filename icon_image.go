package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"strings"
)

const maxIconImageBytes = 2 * 1024 * 1024

var supportedIconImageTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
	"image/gif":  true,
}

func encodeIconDataURL(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("无法读取图标：%w", err)
	}
	if info.Size() > maxIconImageBytes {
		return "", errors.New("自定义图标不能超过 2 MB")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("无法读取图标：%w", err)
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(mime.TypeByExtension(filepath.Ext(path)), ";")[0]))
	if !supportedIconImageTypes[contentType] {
		return "", errors.New("仅支持 PNG、JPG、WebP 或 GIF 图片")
	}
	return "custom:data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}
