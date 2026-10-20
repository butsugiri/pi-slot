#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -n "${PI_BIN:-}" ]; then
  pi_bin=$PI_BIN
elif command -v pi >/dev/null 2>&1; then
  pi_bin=$(command -v pi)
elif [ -x "$HOME/.local/bin/pi" ]; then
  pi_bin="$HOME/.local/bin/pi"
else
  echo 'pi was not found. Set PI_BIN to the executable path.' >&2
  exit 1
fi
exec "$pi_bin" --extension "$project_dir/slot.ts" "$@"
