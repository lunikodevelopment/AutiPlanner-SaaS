#!/bin/sh
#
# Home Assistant mounts an app's data directory as a volume (a bind mount on
# Linux, owned by root). The server runs as the unprivileged `app` user, which
# cannot write into a root-owned directory, so this takes ownership of the data
# directory first and then drops privileges.
#
# A Docker-managed volume is seeded from the image and is already owned by
# `app`; the chown is a no-op there. When the process is not started as root the
# script simply execs, so the image also works under an explicit --user.
set -e

data_dir="${DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$data_dir"
  chown -R app:app "$data_dir"
  exec su-exec app "$@"
fi

exec "$@"
