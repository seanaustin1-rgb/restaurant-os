#!/bin/bash
# SessionStart hook — install project + skill dependencies for Claude Code on the web.
# Synchronous: the remote session waits until this finishes, so tests/linters/skills
# never start before their dependencies are ready.
#
# Design notes:
#  - Python deps (the skills' requirement) are CRITICAL: a failure aborts the hook.
#  - Node deps are BEST-EFFORT: npm is retried, but a network failure (e.g. Prisma
#    engine-binary download through the agent proxy) only warns — it never blocks
#    the Python install or the session.
set -uo pipefail

# Only run in remote (Claude Code on the web) sessions; no-op locally.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

log() { echo "[session-start] $*"; }

# 1) Node dependencies (Next.js project) — best-effort, with retries.
if [ -f package.json ]; then
  npm_ok=""
  for attempt in 1 2 3; do
    log "Installing Node dependencies (npm install, attempt ${attempt}/3)..."
    if npm install --no-audit --no-fund 1>&2; then
      npm_ok="yes"; break
    fi
    log "npm install failed (attempt ${attempt}); retrying after ${attempt}s..."
    sleep "${attempt}"
  done
  if [ -z "${npm_ok}" ]; then
    log "WARNING: npm install did not complete (likely a proxy/network issue on a"
    log "         postinstall download, e.g. Prisma engine binaries). Continuing —"
    log "         re-run 'npm install' manually if you need the Node toolchain."
  fi
fi

# 2) Python dependencies for skills — CRITICAL. Only run pip when requirements.txt
#    has at least one real (non-comment, non-blank) line; pip errors on empty input.
if [ -f requirements.txt ] && grep -qE '^[[:space:]]*[^#[:space:]]' requirements.txt; then
  log "Installing Python dependencies (pip install -r requirements.txt)..."
  python3 -m pip install --disable-pip-version-check -r requirements.txt 1>&2
else
  log "No Python packages to install (requirements.txt empty or comments-only)."
fi

log "Setup complete."
