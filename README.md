<p align="center">
  <br>
  <code>&nbsp;AI CONFIG MONITOR&nbsp;</code>
  <br><br>
  <strong>Real-time CLI dashboard for monitoring AI vendor configurations</strong>
  <br>
  <sub>Claude &bull; Cursor &bull; VS Code &bull; Gemini &bull; Docker MCP &mdash; all in one terminal</sub>
  <br><br>
  <a href="#installation">Installation</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#usage">Usage</a> &bull;
  <a href="#architecture">Architecture</a>
</p>

---

```
┌──────────────────────────────────────────────────────────────────────────┐
│  AI CONFIG MONITOR v1.0.0                                    14:47:23   │
│  9 MCP servers · 16 skills · 2 hooks · 1 plugin                        │
│  PROJECT ~/Documents/lotus/my-project                                   │
├──────────────────────────────────────────────────────────────────────────┤
│  [1] MCP Servers   [2] Skills   [3] Hooks   [4] Overview               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  VENDOR        SERVER            SCOPE    TRANSPORT  STATUS    DETAIL    │
│  ──────────────────────────────────────────────────────────────────────  │
│  Claude        MCP_DOCKER        global   gateway    ● ACTIVE  7 srvs   │
│    └─ docker   context7          global   container  ● ACTIVE  6 tools  │
│    └─ docker   fetch             global   container  ● ACTIVE  1 tool   │
│    └─ docker   filesystem        global   container  ● ACTIVE  11 tools │
│    └─ docker   memory            global   container  ● ACTIVE  9 tools  │
│    └─ docker   obsidian          global   container  ● ACTIVE  12 tools │
│    └─ docker   playwright        global   container  ● ACTIVE  27 tools │
│    └─ docker   puppeteer         global   container  ● ACTIVE  5 tools  │
│  Claude        chrome-devtools   global   npx        ● RUNNING PID 3590 │
│  Cursor        context7          global   http       ● 142ms   remote   │
│  VS Code       (none)            global   -          ─ EMPTY   -        │
│  Gemini        (none)            global   -          ─ EMPTY   -        │
│                                                                          │
│  [!] context7: ACTIVE → STOPPED (14:45:12)                              │
├──────────────────────────────────────────────────────────────────────────┤
│  q quit · r refresh · tab next · 1-4 jump          Watching 10 files    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Why

AI 개발 환경이 복잡해졌습니다. Claude Desktop, Cursor, VS Code, Gemini CLI 각각의 MCP 설정이 흩어져 있고, Docker MCP 서버는 별도로 관리되며, Skills/Hooks/Plugins까지 추적해야 합니다.

**ai-config-monitor**는 이 모든 설정을 하나의 터미널 대시보드에서 실시간으로 모니터링합니다.

- 설정 파일이 변경되면 **자동 감지**하여 즉시 반영
- MCP 서버 상태를 **30초 간격 헬스체크**
- 서버 다운 시 **데스크톱 알림 + 터미널 벨**
- 별도 웹 서버 없이 **순수 터미널 UI** (ANSI escape codes)

## Features

### Multi-Vendor MCP Monitoring

| Vendor | Config Location | Detection |
|--------|----------------|-----------|
| **Claude Desktop** | `claude_desktop_config.json` | stdio, npx, gateway, http, sse |
| **Docker MCP** | `~/.docker/mcp/registry.yaml` | container status, gateway sub-servers |
| **Cursor** | `~/.cursor/mcp.json` | stdio, http |
| **VS Code** | `~/Library/Application Support/Code/User/mcp.json` | stdio, http, sse |
| **Gemini CLI** | `~/.gemini/antigravity/mcp_config.json` | stdio, http |
| **Project** | `.mcp.json` (project root) | project-level MCP servers |

### 4-Tab Dashboard

| Tab | Content |
|-----|---------|
| **MCP Servers** | Full server tree with vendor, scope, transport, live status, response time |
| **Skills** | Installed skills inventory with lock status and scope |
| **Hooks** | PreToolUse/PostToolUse hooks with matcher patterns |
| **Overview** | Aggregate stats, health breakdown, vendor distribution, recent alerts |

### Scope Tracking

모든 설정 항목에 출처(scope)를 표시합니다:

| Scope | Meaning | Example |
|-------|---------|---------|
| `global` | Home directory (user-wide) | `~/.claude/settings.json`, `~/.cursor/mcp.json` |
| `project` | Project-level config | `.mcp.json`, `.claude/settings.json` |
| `project.local` | Local overrides (gitignored) | `.claude/settings.local.json` |

### Health Checking

- **Docker**: `docker mcp server list` 파싱 + 컨테이너 상태 확인
- **Process**: OS 프로세스 테이블 검색 (npx/stdio 서버)
- **HTTP**: 엔드포인트 ping with 3s timeout
- **Alert**: ACTIVE → STOPPED 전환 시 즉시 알림

### Real-time File Watching

설정 파일 변경을 `fs.watch`로 실시간 감지합니다. 파일 저장 즉시 대시보드에 반영됩니다.

## Installation

> **Requires [Bun](https://bun.sh) v1.0+**

```bash
# Clone & install
git clone https://github.com/4sizn/ai-config-monitor.git
cd ai-config-monitor
bun install

# Global link
bun run link

# Now available globally
ai-monitor
```

### Standalone Binary

```bash
# Compile to single executable (no runtime needed)
bun run build:bin

# Output: dist/ai-monitor
./dist/ai-monitor
```

## Usage

```bash
# Monitor current directory as project
ai-monitor

# Specify project path
ai-monitor --project /path/to/your/project

# Direct run without install
bun run src/index.ts
bun run src/index.ts --project .
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` `2` `3` `4` | Jump to tab |
| `Tab` | Next tab |
| `r` | Manual refresh |
| `q` / `Ctrl+C` | Quit |

## Architecture

```
src/
├── index.ts                  # CLI entry point
├── app.ts                    # Main loop (state + render cycle)
│
├── renderer/                 # Pure ANSI terminal renderer
│   ├── screen.ts             # Alternate screen buffer management
│   ├── ansi.ts               # Cursor, color, clear helpers
│   ├── box.ts                # Unicode box drawing + ASCII fallback
│   └── theme.ts              # Color palette (vendor-branded)
│
├── panels/                   # Tab views (each returns string[])
│   ├── mcp-panel.ts          # MCP server table with tree view
│   ├── skills-panel.ts       # Skills inventory
│   ├── hooks-panel.ts        # Hooks configuration
│   └── overview-panel.ts     # Summary statistics
│
├── collectors/               # Config file parsers (pure data)
│   ├── mcp-claude.ts         # Claude Desktop
│   ├── mcp-docker.ts         # Docker registry.yaml
│   ├── mcp-cursor.ts         # Cursor
│   ├── mcp-vscode.ts         # VS Code
│   ├── mcp-gemini.ts         # Gemini CLI
│   ├── mcp-project.ts        # Project .mcp.json
│   ├── skills.ts             # Skills directory + lock file
│   ├── hooks.ts              # Hooks (global + project)
│   └── plugins.ts            # Plugins
│
├── health/                   # Server health checking
│   ├── checker.ts            # 30s polling orchestrator
│   ├── docker-health.ts      # Docker container + MCP server list
│   ├── process-health.ts     # OS process table search
│   └── http-health.ts        # HTTP endpoint ping
│
├── platform/                 # Cross-platform abstraction
│   ├── paths.ts              # OS-specific config file paths
│   └── process.ts            # Process lookup + Docker cache
│
├── watcher/
│   └── file-watcher.ts       # fs.watch + debounce
│
├── notify/
│   └── notifier.ts           # Desktop notification + terminal bell
│
└── types/
    └── index.ts              # All type definitions
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Bun | `Bun.stringWidth()`, `Bun.stripANSI()`, `Bun.file()`, `Bun.$` |
| UI | Raw ANSI escape codes | No Ink, no React. DOS-style direct screen control |
| Colors | `ansis` | Chalk alternative with full Bun compatibility |
| Screen | Alternate buffer (`\x1b[?1049h`) | Preserves original terminal on exit |
| Rendering | Dirty flag + 100ms interval | Minimal redraws, no flicker |
| Health check | 30s polling | Balance between freshness and resource usage |
| Notifications | `node-notifier` + `\x07` | Native OS notifications + terminal bell |

### Cross-Platform Support

| | macOS | Windows | Linux |
|---|:---:|:---:|:---:|
| Config detection | ~/Library/... | %APPDATA%/... | ~/.config/... |
| Process search | `ps -ax` | `tasklist /v /fo csv` | `ps -ax` |
| Docker health | `docker mcp server list` | Same | Same |
| Desktop notifications | Notification Center | Toast | notify-send |
| Box drawing | Unicode | Unicode (WT) / ASCII (cmd) | Unicode |

## Tech Stack

| Component | Package | Note |
|-----------|---------|------|
| Runtime | [Bun](https://bun.sh) | Built-in string width, ANSI strip, file I/O |
| Colors | [ansis](https://github.com/nicolo-ribaudo/ansis) | 6KB, ESM/CJS, 256/truecolor |
| YAML | [yaml](https://github.com/eemeli/yaml) | Docker registry.yaml parsing |
| Notifications | [node-notifier](https://github.com/mikaelbr/node-notifier) | Cross-platform native alerts |

## License

MIT
