package main

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEncodeIconDataURL(t *testing.T) {
	data := []byte{0x89, 0x50, 0x4e, 0x47}
	path := filepath.Join(t.TempDir(), "icon.png")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	value, err := encodeIconDataURL(path)
	if err != nil {
		t.Fatal(err)
	}
	const prefix = "custom:data:image/png;base64,"
	if !strings.HasPrefix(value, prefix) {
		t.Fatalf("unexpected data URL prefix: %q", value)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, prefix))
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != string(data) {
		t.Fatalf("decoded data mismatch: %v", decoded)
	}
}

func TestEncodeIconDataURLRejectsUnsupportedFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "icon.svg")
	if err := os.WriteFile(path, []byte("<svg/>"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := encodeIconDataURL(path); err == nil {
		t.Fatal("expected unsupported image error")
	}
}
