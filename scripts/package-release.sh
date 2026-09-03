#!/usr/bin/env bash

set -euo pipefail

APP_NAME="ScriptLauncher"
BINARY_NAME="scriptlauncher"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
用法：
  ./scripts/package-release.sh <版本号> [选项]

示例：
  ./scripts/package-release.sh 0.2.0
  ./scripts/package-release.sh 0.2.0 --target mac
  ./scripts/package-release.sh 0.2.0 --target mac --mac-arch universal
  ./scripts/package-release.sh 0.2.0 --target windows --installer

选项：
  --target all|mac|windows        打包目标，默认 all
  --mac-arch separate|universal|arm64|amd64
                                  macOS 架构，默认 separate：arm64、amd64 分开打包
  --windows-arch amd64|arm64      Windows 架构，默认 amd64
  --installer                     必须生成 Windows NSIS 安装器
  --no-installer                  不生成 Windows 安装器，仅生成独立 EXE
  --skip-tests                    跳过 Go 测试和静态检查，仍构建前端
  -h, --help                      显示帮助

产物目录：release/v<版本号>/（macOS DMG、Windows EXE，不生成 ZIP）
EOF
}

fail() {
  echo "错误：$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令 $1"
}

if [[ $# -eq 1 && ( "$1" == "-h" || "$1" == "--help" ) ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

VERSION="$1"
shift
TARGET="all"
MAC_ARCH="separate"
WINDOWS_ARCH="amd64"
INSTALLER_MODE="auto"
RUN_TESTS="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || fail "--target 缺少参数"
      TARGET="$2"
      shift 2
      ;;
    --mac-arch)
      [[ $# -ge 2 ]] || fail "--mac-arch 缺少参数"
      MAC_ARCH="$2"
      shift 2
      ;;
    --windows-arch)
      [[ $# -ge 2 ]] || fail "--windows-arch 缺少参数"
      WINDOWS_ARCH="$2"
      shift 2
      ;;
    --installer)
      INSTALLER_MODE="required"
      shift
      ;;
    --no-installer)
      INSTALLER_MODE="disabled"
      shift
      ;;
    --skip-tests)
      RUN_TESTS="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "未知参数 $1"
      ;;
  esac
done

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "版本号必须符合 x.y.z，例如 0.2.0"
[[ "$TARGET" == "all" || "$TARGET" == "mac" || "$TARGET" == "windows" ]] || fail "--target 仅支持 all、mac、windows"
[[ "$MAC_ARCH" == "separate" || "$MAC_ARCH" == "universal" || "$MAC_ARCH" == "arm64" || "$MAC_ARCH" == "amd64" ]] || fail "--mac-arch 参数无效"
[[ "$WINDOWS_ARCH" == "amd64" || "$WINDOWS_ARCH" == "arm64" ]] || fail "--windows-arch 参数无效"

require_command go
require_command pnpm
require_command python3
require_command shasum
require_command wails3

if [[ "$TARGET" == "all" || "$TARGET" == "mac" ]]; then
  [[ "$(uname -s)" == "Darwin" ]] || fail "macOS 安装包必须在 macOS 主机上生成"
  require_command codesign
  require_command ditto
  require_command hdiutil
fi

if [[ "$INSTALLER_MODE" == "required" ]] && ! command -v makensis >/dev/null 2>&1; then
  fail "生成 Windows 安装器需要 NSIS；macOS 可执行 brew install nsis 安装"
fi

cd "$ROOT_DIR"

RELEASE_DIR="$ROOT_DIR/release/v$VERSION"
mkdir -p "$RELEASE_DIR"
if [[ "$TARGET" == "all" || "$TARGET" == "mac" ]]; then
  if [[ "$MAC_ARCH" == "separate" ]]; then
    MAC_CLEAN_ARCHES=(universal arm64 amd64)
  else
    MAC_CLEAN_ARCHES=("$MAC_ARCH")
  fi
  for arch in "${MAC_CLEAN_ARCHES[@]}"; do
    rm -f \
      "$RELEASE_DIR/$APP_NAME-$VERSION-macos-$arch.zip" \
      "$RELEASE_DIR/$APP_NAME-$VERSION-macos-$arch.dmg"
  done
fi
if [[ "$TARGET" == "all" || "$TARGET" == "windows" ]]; then
  for arch in amd64 arm64; do
    rm -f \
      "$RELEASE_DIR/$APP_NAME-$VERSION-windows-$arch.exe" \
      "$RELEASE_DIR/$APP_NAME-$VERSION-windows-$arch-portable.zip" \
      "$RELEASE_DIR/$APP_NAME-$VERSION-windows-$arch-setup.exe"
  done
fi
rm -f "$RELEASE_DIR/SHA256SUMS.txt"

METADATA_FILES=(
  "build/config.yml"
  "build/darwin/Info.plist"
  "build/windows/info.json"
  "build/windows/wails.exe.manifest"
  "build/windows/nsis/wails_tools.nsh"
)
BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/scriptlauncher-release.XXXXXX")"

restore_metadata() {
  local index=0
  for file in "${METADATA_FILES[@]}"; do
    if [[ -f "$BACKUP_DIR/$index" ]]; then
      cp "$BACKUP_DIR/$index" "$ROOT_DIR/$file"
    fi
    index=$((index + 1))
  done
  rm -rf "$BACKUP_DIR"
}
trap restore_metadata EXIT INT TERM

index=0
for file in "${METADATA_FILES[@]}"; do
  cp "$file" "$BACKUP_DIR/$index"
  index=$((index + 1))
done

python3 - "$ROOT_DIR" "$VERSION" <<'PY'
import json
import pathlib
import plistlib
import re
import sys

root = pathlib.Path(sys.argv[1])
version = sys.argv[2]

config_path = root / "build/config.yml"
config = config_path.read_text(encoding="utf-8")
config = re.sub(r'(?m)^(  version:\s*)"[^"]+"$', rf'\1"{version}"', config, count=1)
config_path.write_text(config, encoding="utf-8")

plist_path = root / "build/darwin/Info.plist"
with plist_path.open("rb") as source:
    plist = plistlib.load(source)
plist["CFBundleShortVersionString"] = version
plist["CFBundleVersion"] = version
with plist_path.open("wb") as target:
    plistlib.dump(plist, target, sort_keys=False)

info_path = root / "build/windows/info.json"
info = json.loads(info_path.read_text(encoding="utf-8"))
info["fixed"]["file_version"] = version
info["info"]["0000"]["ProductVersion"] = version
info["info"]["0000"]["FileVersion"] = version
info_path.write_text(json.dumps(info, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")

manifest_path = root / "build/windows/wails.exe.manifest"
manifest = manifest_path.read_text(encoding="utf-8")
manifest = re.sub(
    r'(<assemblyIdentity\s+type="win32"\s+name="com\.scriptlauncher\.app"\s+version=")[^"]+("[^>]*>)',
    rf'\g<1>{version}.0\2',
    manifest,
    count=1,
)
manifest_path.write_text(manifest, encoding="utf-8")

nsis_path = root / "build/windows/nsis/wails_tools.nsh"
nsis = nsis_path.read_text(encoding="utf-8")
nsis = re.sub(
    r'(!define INFO_PRODUCTVERSION\s+")[^"]+("\s*)',
    rf'\g<1>{version}\2',
    nsis,
    count=1,
)
nsis_path.write_text(nsis, encoding="utf-8")
PY

echo "==> 安装锁定版本的前端依赖"
pnpm --dir frontend install --frozen-lockfile
echo "==> 构建前端资源（Go embed 与首次克隆所需）"
pnpm --dir frontend build
if [[ "$RUN_TESTS" == "true" ]]; then
  echo "==> 运行 Go 测试与静态检查"
  go test ./...
  go vet ./...
fi

package_macos_arch() {
  local mac_arch="$1"
  local mac_app_source="$ROOT_DIR/bin/Script Launcher.app"
  local mac_stage="$BACKUP_DIR/macos-$mac_arch"
  local mac_dmg="$RELEASE_DIR/$APP_NAME-$VERSION-macos-$mac_arch.dmg"

  echo "==> 打包 macOS ($mac_arch)"
  if [[ "$mac_arch" == "universal" ]]; then
    wails3 task darwin:package:universal
  else
    wails3 task darwin:package ARCH="$mac_arch"
  fi

  [[ -d "$mac_app_source" ]] || fail "未找到 macOS 应用 $mac_app_source"
  codesign --verify --deep --strict "$mac_app_source"

  mkdir -p "$mac_stage"
  ditto "$mac_app_source" "$mac_stage/Script Launcher.app"
  cp LICENSE THIRD_PARTY_NOTICES.md "frontend/Inter Font License.txt" "$mac_stage/"
  ln -s /Applications "$mac_stage/Applications"

  rm -f "$mac_dmg"
  hdiutil create -quiet -volname "Script Launcher $VERSION $mac_arch" -srcfolder "$mac_stage" -ov -format UDZO "$mac_dmg"
}

if [[ "$TARGET" == "all" || "$TARGET" == "mac" ]]; then
  if [[ "$MAC_ARCH" == "separate" ]]; then
    MAC_ARCHES=(arm64 amd64)
  else
    MAC_ARCHES=("$MAC_ARCH")
  fi

  for arch in "${MAC_ARCHES[@]}"; do
    package_macos_arch "$arch"
  done
fi

if [[ "$TARGET" == "all" || "$TARGET" == "windows" ]]; then
  echo "==> 交叉编译 Windows ($WINDOWS_ARCH)"
  wails3 task windows:build ARCH="$WINDOWS_ARCH" CGO_ENABLED=0

  WINDOWS_SOURCE="$ROOT_DIR/bin/$BINARY_NAME.exe"
  [[ -f "$WINDOWS_SOURCE" ]] || fail "未找到 Windows 应用 $WINDOWS_SOURCE"
  WINDOWS_EXE="$RELEASE_DIR/$APP_NAME-$VERSION-windows-$WINDOWS_ARCH.exe"
  cp "$WINDOWS_SOURCE" "$WINDOWS_EXE"

  if [[ "$INSTALLER_MODE" != "disabled" ]] && command -v makensis >/dev/null 2>&1; then
    echo "==> 生成 Windows NSIS 安装器"
    wails3 task windows:package ARCH="$WINDOWS_ARCH" CGO_ENABLED=0 INSTALL_SCOPE=user
    INSTALLER_SOURCE="$ROOT_DIR/bin/$BINARY_NAME-$WINDOWS_ARCH-installer.exe"
    [[ -f "$INSTALLER_SOURCE" ]] || fail "未找到 Windows NSIS 安装器"
    cp "$INSTALLER_SOURCE" "$RELEASE_DIR/$APP_NAME-$VERSION-windows-$WINDOWS_ARCH-setup.exe"
  elif [[ "$INSTALLER_MODE" == "auto" ]]; then
    echo "提示：未安装 NSIS，本次仅生成 Windows 便携版。安装后会自动额外生成安装器：brew install nsis"
  fi
fi

# Keep license notices alongside standalone Windows executables as well as in DMGs.
cp LICENSE THIRD_PARTY_NOTICES.md "frontend/Inter Font License.txt" "$RELEASE_DIR/"
CHECKSUM_FILE="$RELEASE_DIR/SHA256SUMS.txt"
rm -f "$CHECKSUM_FILE"
(
  cd "$RELEASE_DIR"
  for artifact in "$APP_NAME-$VERSION-"*.dmg "$APP_NAME-$VERSION-"*.exe; do
    [[ -f "$artifact" ]] || continue
    shasum -a 256 "$artifact"
  done
) > "$CHECKSUM_FILE"

echo
echo "发版产物已生成：$RELEASE_DIR"
ls -lh "$RELEASE_DIR"
