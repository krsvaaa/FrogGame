#!/usr/bin/env bash
set -Eeuo pipefail

HOST="127.0.0.1"
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Ошибка: для запуска нужен Python 3." >&2
  exit 1
fi

port_is_free() {
  python3 - "$1" <<'PY'
import socket
import sys

port = int(sys.argv[1])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    try:
        sock.bind(("127.0.0.1", port))
    except OSError:
        raise SystemExit(1)
PY
}

if [[ -n "${PORT:-}" ]]; then
  SELECTED_PORT="$PORT"
  if ! [[ "$SELECTED_PORT" =~ ^[0-9]+$ ]] || (( SELECTED_PORT < 1 || SELECTED_PORT > 65535 )); then
    echo "Ошибка: PORT должен быть числом от 1 до 65535." >&2
    exit 1
  fi
  if ! port_is_free "$SELECTED_PORT"; then
    echo "Ошибка: порт ${SELECTED_PORT} уже занят. Укажи другой: PORT=3000 ./start.sh" >&2
    exit 1
  fi
else
  SELECTED_PORT=8080
  while ! port_is_free "$SELECTED_PORT"; do
    ((SELECTED_PORT += 1))
    if (( SELECTED_PORT > 8099 )); then
      echo "Ошибка: не найден свободный порт в диапазоне 8080–8099." >&2
      exit 1
    fi
  done
fi

cd "$PROJECT_DIR"
URL="http://${HOST}:${SELECTED_PORT}"

echo "Лягушачье болото запущено: ${URL}"
echo "Для остановки нажми Ctrl+C."

if command -v xdg-open >/dev/null 2>&1 && [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  (sleep 1; xdg-open "$URL" >/dev/null 2>&1 || true) &
fi

exec python3 -m http.server "$SELECTED_PORT" --bind "$HOST"
