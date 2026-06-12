#!/usr/bin/env bash
# Legacy entrypoint — delegates to scripts/vps-pm2-deploy.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/scripts/vps-pm2-deploy.sh"
