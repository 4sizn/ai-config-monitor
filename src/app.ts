import { homedir } from 'os';
import { Screen } from './renderer/screen.ts';
import { topBorder, bottomBorder, middleBorder, boxLine, emptyBoxLine } from './renderer/box.ts';
import { theme, rainbowText } from './renderer/theme.ts';
import { padRight, visibleWidth, fitWidth } from './renderer/ansi.ts';
import { TABS } from './types/index.ts';
import type { AppState, McpServer } from './types/index.ts';

import { getConfigPaths, getAllWatchPaths } from './platform/paths.ts';
import { collectClaudeDesktop } from './collectors/mcp-claude.ts';
import { collectDockerMcp } from './collectors/mcp-docker.ts';
import { collectCursor } from './collectors/mcp-cursor.ts';
import { collectVSCode } from './collectors/mcp-vscode.ts';
import { collectGemini } from './collectors/mcp-gemini.ts';
import { collectProjectMcp } from './collectors/mcp-project.ts';
import { collectSkills } from './collectors/skills.ts';
import { collectHooks } from './collectors/hooks.ts';
import { collectPlugins } from './collectors/plugins.ts';

import { renderMcpPanel } from './panels/mcp-panel.ts';
import { renderSkillsPanel } from './panels/skills-panel.ts';
import { renderHooksPanel } from './panels/hooks-panel.ts';
import { renderOverviewPanel } from './panels/overview-panel.ts';

import { HealthChecker } from './health/checker.ts';
import { FileWatcher } from './watcher/file-watcher.ts';
import { Notifier } from './notify/notifier.ts';

const ALERT_BANNER_DURATION = 30_000; // 알림 배너 표시 시간 (30초)
const FLASH_TOGGLE_TICKS = 5;         // 깜빡임 토글 간격 (5틱 = 500ms)

export class App {
  private screen: Screen;
  private state: AppState;
  private dirty = true;
  private running = false;
  private renderInterval?: ReturnType<typeof setInterval>;
  private healthChecker?: HealthChecker;
  private fileWatcher?: FileWatcher;
  private notifier?: Notifier;
  private flashTick = 0;
  private healthIntervalMs: number;

  constructor(private projectPath?: string, healthIntervalMs?: number) {
    this.screen = new Screen();
    this.healthIntervalMs = healthIntervalMs ?? 10_000;
    this.state = {
      servers: [],
      skills: [],
      hooks: [],
      plugins: [],
      alerts: [],
      activeTab: 0,
      lastRefresh: new Date(),
      watchedFiles: 0,
      projectPath,
    };
  }

  async start(): Promise<void> {
    this.running = true;

    // Initial data collection + health check (before any rendering)
    await this.refresh();
    await this.startHealthChecker();

    // Enter alternate screen
    this.screen.enter();

    // Setup keyboard input
    this.setupKeyboard();

    // Setup resize handler
    this.screen.onResize(() => {
      this.dirty = true;
    });

    // Start file watcher
    this.startFileWatcher();

    // First render with fully populated data
    this.render();

    // Start render loop for subsequent updates
    this.renderInterval = setInterval(() => {
      this.flashTick++;

      // 활성 알림이 있으면 레인보우 + 배너 애니메이션을 위해 주기적 redraw
      if (this.hasActiveAlert() && this.flashTick % 2 === 0) {
        this.dirty = true;
      }

      if (this.dirty) {
        this.render();
        this.dirty = false;
      }
    }, 100);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.renderInterval) clearInterval(this.renderInterval);
    this.healthChecker?.stop();
    this.fileWatcher?.stop();
    this.notifier?.stop();
    this.screen.leave();

    // Restore terminal
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }

  private setupKeyboard(): void {
    if (!process.stdin.isTTY) return;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', async (data: string) => {
      const key = data;

      // Quit
      if (key === 'q' || key === '\x03') {
        await this.stop();
        process.exit(0);
      }

      // Refresh
      if (key === 'r') {
        await this.refresh();
        this.dirty = true;
      }

      // Tab navigation
      if (key === '\t') {
        this.state.activeTab = (this.state.activeTab + 1) % TABS.length;
        this.dirty = true;
      }

      // Number keys 1-4
      if (key >= '1' && key <= '4') {
        this.state.activeTab = parseInt(key) - 1;
        this.dirty = true;
      }
    });
  }

  async refresh(): Promise<void> {
    const paths = getConfigPaths(this.projectPath);

    try {
      const [claude, docker, cursor, vscode, gemini, project, skills, hooks, plugins] = await Promise.all([
        collectClaudeDesktop(paths.claudeDesktop),
        collectDockerMcp(paths.dockerMcp),
        collectCursor(paths.cursor),
        collectVSCode(paths.vscode),
        collectGemini(paths.gemini),
        collectProjectMcp(paths.projectMcp, paths.projectCodexMcp, paths.projectCodexConfig),
        collectSkills(paths.skills, paths.skillLock),
        collectHooks(paths.claudeCli, this.projectPath),
        collectPlugins(paths.plugins),
      ]);

      const servers = this.buildServerTree(claude, docker, cursor, vscode, gemini, project);

      this.state.servers = servers;
      this.state.skills = skills;
      this.state.hooks = hooks;
      this.state.plugins = plugins;
      this.state.lastRefresh = new Date();
      this.state.watchedFiles = getAllWatchPaths(paths).length;

      // Update health checker with new server list
      this.healthChecker?.updateServers(servers);
    } catch {
      // Graceful degradation
    }
  }

  private buildServerTree(
    claude: McpServer[],
    docker: McpServer[],
    cursor: McpServer[],
    vscode: McpServer[],
    gemini: McpServer[],
    project: McpServer[],
  ): McpServer[] {
    const servers: McpServer[] = [];

    for (const srv of claude) {
      if (srv.transport === 'gateway' && docker.length > 0) {
        srv.children = docker.map(d => ({
          ...d,
          vendor: 'Claude' as const,
          transport: 'docker' as const,
        }));
        srv.detail = `${docker.length} servers`;
      }
      servers.push(srv);
    }

    const hasGateway = claude.some(s => s.transport === 'gateway');
    if (!hasGateway && docker.length > 0) {
      servers.push(...docker);
    }

    servers.push(...cursor);

    if (vscode.length === 0) {
      servers.push({ vendor: 'VS Code', name: '(none)', transport: 'unknown', scope: 'global', status: 'EMPTY', detail: '-' });
    } else {
      servers.push(...vscode);
    }

    if (gemini.length === 0) {
      servers.push({ vendor: 'Gemini', name: '(none)', transport: 'unknown', scope: 'global', status: 'EMPTY', detail: '-' });
    } else {
      servers.push(...gemini);
    }

    servers.push(...project);
    return servers;
  }

  // ─── 활성 알림 여부 (30초 이내) ───
  private hasActiveAlert(): boolean {
    if (this.state.alerts.length === 0) return false;
    const latest = this.state.alerts[this.state.alerts.length - 1];
    return Date.now() - latest.time.getTime() < ALERT_BANNER_DURATION;
  }

  // ─── 삐용삐용 깜빡이는 알림 배너 ───
  private renderAlertBanner(w: number): string[] {
    if (!this.hasActiveAlert()) return [];

    const latest = this.state.alerts[this.state.alerts.length - 1];
    const isFlashA = Math.floor(this.flashTick / FLASH_TOGGLE_TICKS) % 2 === 0;
    const flashStyle = isFlashA ? theme.flashA : theme.flashB;

    const elapsed = Math.floor((Date.now() - latest.time.getTime()) / 1000);
    const elapsedStr = elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ago`;

    const icon = isFlashA ? ' !! ALERT ' : ' ** ALERT ';
    const msg = `${latest.server}: ${latest.from} -> ${latest.to}`;
    const bannerInner = w - 4;
    const content = `${icon} ${msg}`;
    const rightPad = elapsedStr + ' ';
    const midPad = Math.max(bannerInner - visibleWidth(content) - visibleWidth(rightPad), 0);
    const fullLine = content + ' '.repeat(midPad) + rightPad;

    // 배너 전체를 flash 스타일로 칠함
    const styledLine = flashStyle(fitWidth(fullLine, bannerInner));

    return [
      boxLine(styledLine, w),
    ];
  }

  private render(): void {
    const w = this.screen.width;
    const h = this.screen.height;

    const lines: string[] = [];

    // ─── Header ───
    lines.push(topBorder(w));
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const titleLeft = `  AI CONFIG MONITOR v1.2.4`;
    const titleRight = time + '  ';
    const titlePad = Math.max(w - 4 - visibleWidth(titleLeft) - visibleWidth(titleRight), 0);
    lines.push(boxLine(
      theme.title(titleLeft) + ' '.repeat(titlePad) + theme.muted(titleRight),
      w,
    ));

    const totalChildren = this.state.servers.reduce((a, s) => a + (s.children?.length || 0), 0);
    const totalServers = this.state.servers.length + totalChildren;
    const statsText = `  ${totalServers} MCP servers · ${this.state.skills.length} skills · ${this.state.hooks.length} hooks · ${this.state.plugins.length} plugins`;
    lines.push(boxLine(theme.muted(statsText), w));

    // Project path (알림 활성 시 레인보우 깜빡임)
    const projDisplay = this.projectPath || process.cwd();
    const home = homedir();
    const shortPath = projDisplay.startsWith(home) ? '~' + projDisplay.slice(home.length) : projDisplay;
    if (this.hasActiveAlert()) {
      const projLine = `  PROJECT ${shortPath}`;
      lines.push(boxLine(rainbowText(projLine, this.flashTick), w));
    } else {
      lines.push(boxLine(`  ${theme.label('PROJECT')} ${theme.value(shortPath)}`, w));
    }

    // ─── Tabs ───
    lines.push(middleBorder(w));
    let tabLine = '  ';
    for (let i = 0; i < TABS.length; i++) {
      const label = `[${TABS[i].key}] ${TABS[i].label}`;
      if (i === this.state.activeTab) {
        tabLine += theme.tabActive(` ${label} `);
      } else {
        tabLine += theme.tabInactive(` ${label} `);
      }
      tabLine += '  ';
    }
    lines.push(boxLine(tabLine, w));
    lines.push(middleBorder(w));

    // ─── Alert Banner (삐용삐용) ───
    const alertBanner = this.renderAlertBanner(w);
    const bannerHeight = alertBanner.length;
    lines.push(...alertBanner);

    // ─── Panel Content ───
    const panelMaxRows = Math.max(h - 11 - bannerHeight, 5);

    let panelLines: string[];
    switch (this.state.activeTab) {
      case 0:
        panelLines = renderMcpPanel(this.state.servers, this.state.alerts, w, panelMaxRows);
        break;
      case 1:
        panelLines = renderSkillsPanel(this.state.skills, w, panelMaxRows);
        break;
      case 2:
        panelLines = renderHooksPanel(this.state.hooks, w, panelMaxRows);
        break;
      case 3:
        panelLines = renderOverviewPanel(this.state, w, panelMaxRows);
        break;
      default:
        panelLines = [];
    }

    lines.push(...panelLines.slice(0, panelMaxRows));

    // Pad to fill
    while (lines.length < h - 3) {
      lines.push(emptyBoxLine(w));
    }

    // ─── Footer ───
    lines.push(middleBorder(w));
    const intervalSec = Math.round(this.healthIntervalMs / 1000);
    const footerLeft = '  q quit · r refresh · tab next · 1-4 jump';
    const footerRight = `${intervalSec}s poll · Watching ${this.state.watchedFiles} files  `;
    const footerPad = Math.max(w - 4 - visibleWidth(footerLeft) - visibleWidth(footerRight), 0);
    lines.push(boxLine(
      theme.muted(footerLeft) + ' '.repeat(footerPad) + theme.muted(footerRight),
      w,
    ));
    lines.push(bottomBorder(w));

    this.screen.render(lines);
  }

  private async startHealthChecker(): Promise<void> {
    this.healthChecker = new HealthChecker(this.state.servers, this.healthIntervalMs);
    this.notifier = new Notifier();

    this.healthChecker.on('result', (results) => {
      for (const result of results) {
        const server = this.findServer(result.server, result.vendor);
        if (server) {
          const oldStatus = server.status;
          server.status = result.status;
          server.detail = result.detail;
          server.pid = result.pid;
          server.responseTime = result.responseTime;
          server.lastChecked = result.checkedAt;

          // Alert 조건:
          // 1. 상태 전환: ACTIVE/RUNNING → STOPPED/ERROR
          // 2. 초기 감지: 첫 체크에서 바로 STOPPED/ERROR (이미 장애 상태)
          const isDown = result.status === 'STOPPED' || result.status === 'ERROR';
          const wasUp = oldStatus === 'ACTIVE' || oldStatus === 'RUNNING';
          const isFirstCheck = oldStatus === 'UNKNOWN';
          const statusChanged = oldStatus !== result.status;

          if (isDown && statusChanged && (wasUp || isFirstCheck)) {
            const fromLabel = isFirstCheck ? 'UNKNOWN' : oldStatus;
            const alert = {
              server: result.server,
              vendor: result.vendor,
              from: fromLabel,
              to: result.status,
              time: new Date(),
              message: `${result.server}: ${fromLabel} → ${result.status}`,
            };
            this.state.alerts.push(alert);
            // 첫 체크에서 감지된 장애는 벨 없이 배너만 표시
            if (!isFirstCheck) {
              this.notifier?.notify(alert);
            }
          }
        }
      }
      this.dirty = true;
    });

    // Await initial check so first render shows real statuses
    await this.healthChecker.start();
  }

  private findServer(name: string, vendor: string): McpServer | undefined {
    for (const s of this.state.servers) {
      if (s.name === name && s.vendor === vendor) return s;
      if (s.children) {
        const child = s.children.find(c => c.name === name && c.vendor === vendor);
        if (child) return child;
      }
    }
    return undefined;
  }

  private startFileWatcher(): void {
    const paths = getConfigPaths(this.projectPath);
    const watchPaths = getAllWatchPaths(paths);

    this.fileWatcher = new FileWatcher(watchPaths, 500);
    this.fileWatcher.on('change', async () => {
      await this.refresh();
      this.dirty = true;
    });
    this.fileWatcher.start();
  }
}
