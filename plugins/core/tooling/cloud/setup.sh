#!/bin/bash
# Setup script for the project's cloud environment (Claude Code on the web). Upload this file as
# the environment's Setup script at claude.ai/code (environment settings → Setup script → Choose
# file). It runs as root on Ubuntu 24.04 before Claude Code starts, and its result is cached: the
# downloads happen once per environment, not per session.
#
# It installs what the image lacks and every session needs: Chrome (Chrome for Testing, from
# storage.googleapis.com) with its system libraries (archive.ubuntu.com), so browser specs,
# e2e and the visual gate's Playwright browser run; and that browser's MCP server (npm).
# All three hosts are on the Trusted network list. The project's Node
# version and its dependencies are per-session work: tools/autopilot/cloud/session-start.mjs,
# run by the SessionStart hook in .claude/settings.json.
#
# Never fails the session: a step that cannot finish is reported and skipped.

# Chrome for Testing build used when the version lookup is out of reach (it is not on the Trusted list).
CHROME_PINNED=156.0.8078.47
PLAYWRIGHT=__PLAYWRIGHT__
PLAYWRIGHT_MCP=__PLAYWRIGHT_MCP__

log() { echo "[autopilot cloud setup] $*"; }

if command -v google-chrome >/dev/null 2>&1; then
  log "Chrome already installed: $(google-chrome --version 2>/dev/null)"
else
  version=$(curl -fsS --max-time 10 https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_STABLE 2>/dev/null)
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || version=$CHROME_PINNED
  command -v unzip >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq unzip; } || log "unzip install failed"
  if curl -fsSL --max-time 300 -o /tmp/chrome-linux64.zip "https://storage.googleapis.com/chrome-for-testing-public/$version/linux64/chrome-linux64.zip" \
    && unzip -q -o /tmp/chrome-linux64.zip -d /opt; then
    ln -sf /opt/chrome-linux64/chrome /usr/local/bin/google-chrome
    rm -f /tmp/chrome-linux64.zip
    log "Chrome for Testing $version installed at /opt/chrome-linux64/chrome (google-chrome on PATH)"
  else
    log "Chrome $version download failed — browser specs and visual checks will not run in this environment"
  fi
fi

# Chrome's system libraries, per Ubuntu release, as Playwright maintains the list.
if command -v google-chrome >/dev/null 2>&1 && ! google-chrome --headless=new --no-sandbox --disable-gpu --dump-dom about:blank >/dev/null 2>&1; then
  npx -y "playwright@$PLAYWRIGHT" install-deps chromium >/tmp/autopilot-chrome-deps.log 2>&1 \
    && log "Chrome system libraries installed" \
    || log "Chrome system libraries failed — see /tmp/autopilot-chrome-deps.log"
fi

# The agents' browser server (tools/autopilot/browser/mcp.mjs), fetched into the cached npx store
# so a session's first browser call doesn't wait for the download.
npx -y "@playwright/mcp@$PLAYWRIGHT_MCP" --version >/dev/null 2>&1 \
  && log "Playwright MCP $PLAYWRIGHT_MCP cached" \
  || log "Playwright MCP $PLAYWRIGHT_MCP fetch failed — the first browser call downloads it"

exit 0
