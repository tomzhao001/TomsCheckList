# shellcheck shell=bash
set -euo pipefail

CHECKLIST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$CHECKLIST_ROOT/node/bin/node"
APP_ENTRY="$CHECKLIST_ROOT/app/dist/index.js"
DATA_DIR="$HOME/Library/Application Support/TomsCheckList"
ENV_FILE="${CHECKLIST_ENV_FILE:-$DATA_DIR/checklist.env}"
LOG_DIR="$DATA_DIR/logs"
LOG_FILE="$LOG_DIR/checklist.log"
ERR_FILE="$LOG_DIR/checklist.err.log"
LABEL="com.toms.checklist"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SERVICE_PATH="$CHECKLIST_ROOT/node/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

checklist_setting() {
  local name="$1" fallback="$2" value=""
  value="${!name:-}"
  if [[ -z "$value" && -f "$ENV_FILE" ]]; then
    value="$(grep -E "^[[:space:]]*${name}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")"
  fi
  echo "${value:-$fallback}"
}

checklist_port() { checklist_setting PORT 3711; }

port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

assert_ports_free() {
  local port
  port="$(checklist_port)"
  if port_in_use "$port"; then
    echo "端口 $port 已被占用。先运行 status.sh 查看，或运行 stop.sh 停掉旧进程。" >&2
    exit 1
  fi
}

checklist_healthy() { curl -fsS --max-time 3 "http://127.0.0.1:$(checklist_port)/healthz" >/dev/null 2>&1; }

refuse_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    echo "请不要用 sudo 运行。服务要注册在当前登录用户下，直接执行 ./macos/install-service.sh。" >&2
    exit 1
  fi
}

# gui 域只在桌面登录会话里存在。SSH 和 sudo 下会得到 125：Domain does not support specified action。
gui_session_available() { launchctl print "gui/$(id -u)" >/dev/null 2>&1; }

service_target() { printf 'gui/%s' "$(id -u)"; }

service_loaded() { launchctl print "$(service_target)/$LABEL" >/dev/null 2>&1; }

bootout_service() {
  launchctl bootout "$(service_target)/$LABEL" >/dev/null 2>&1 || true
  if [[ -f "$PLIST" ]]; then
    launchctl bootout "$(service_target)" "$PLIST" >/dev/null 2>&1 || true
  fi
}

load_service() {
  local target bootstrap_err="" load_err="" owner
  target="$(service_target)"

  if [[ ! -x "$NODE_BIN" ]]; then
    if [[ "$(basename "$CHECKLIST_ROOT")" == "packaging" && -f "$CHECKLIST_ROOT/../scripts/package-macos.sh" ]]; then
      echo "这是源码里的启动脚本，旁边没有打包好的 Node。" >&2
      echo "请先在仓库根目录执行 ./scripts/package-macos.sh，把生成的目录当作安装目录后再运行其中的 ./macos/install-service.sh。" >&2
      echo "不要直接运行 packaging/macos/install-service.sh。" >&2
      return 1
    fi
    echo "找不到可执行文件：$NODE_BIN" >&2
    return 1
  fi
  if [[ ! -f "$APP_ENTRY" ]]; then
    echo "找不到程序入口：$APP_ENTRY" >&2
    return 1
  fi
  owner="$(stat -f %u "$PLIST")"
  if [[ "$owner" -ne "$(id -u)" ]]; then
    echo "服务文件不属于当前用户：$PLIST" >&2
    echo "请执行：sudo chown \"$(id -un)\" \"$PLIST\"" >&2
    return 1
  fi
  chmod 644 "$PLIST"
  if ! plutil -lint "$PLIST" >/dev/null; then
    echo "服务描述文件格式不对：$PLIST" >&2
    plutil -lint "$PLIST" >&2 || true
    return 1
  fi

  launchctl enable "$target/$LABEL" >/dev/null 2>&1 || true
  bootout_service
  local i
  for i in $(seq 1 10); do
    if service_loaded; then
      sleep 0.3
    else
      break
    fi
  done

  if ! service_loaded; then
    bootstrap_err="$(launchctl bootstrap "$target" "$PLIST" 2>&1)" || true
  fi
  if ! service_loaded; then
    echo "launchctl bootstrap 没有注册成功，改用 launchctl load。" >&2
    load_err="$(launchctl load -w "$PLIST" 2>&1)" || true
  fi
  if ! service_loaded; then
    if [[ -n "$bootstrap_err" ]]; then
      echo "$bootstrap_err" >&2
    fi
    if [[ -n "$load_err" ]]; then
      echo "$load_err" >&2
    fi
    echo "注册后台服务失败。若上面是 Input/output error，多半是同名服务还占着，或这个 plist 之前被禁用了。" >&2
    echo "可查看：launchctl print \"$target/$LABEL\"" >&2
    return 1
  fi
  launchctl kickstart -k "$target/$LABEL" >/dev/null 2>&1 || true
}

require_gui_session() {
  refuse_root
  if gui_session_available; then
    return 0
  fi
  local session
  session="$(launchctl managername 2>/dev/null || true)"
  echo "当前没有图形登录会话，launchctl 无法注册服务（125：Domain does not support specified action）。" >&2
  if [[ -n "$session" ]]; then
    echo "当前会话类型：${session}。" >&2
  fi
  echo "请用要运行旅行清单的用户登录这台 Mac 的桌面，打开「终端」后再执行，不要加 sudo，也不要从 SSH 里执行。" >&2
  exit 1
}

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}
