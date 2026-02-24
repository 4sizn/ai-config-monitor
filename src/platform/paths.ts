import { homedir } from 'os';
import { join } from 'path';
import type { ConfigPaths } from '../types/index.ts';

const home = homedir();
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

function appData(): string {
  if (isWindows) {
    return process.env.APPDATA || join(home, 'AppData', 'Roaming');
  }
  if (isMac) {
    return join(home, 'Library', 'Application Support');
  }
  // Linux
  return process.env.XDG_CONFIG_HOME || join(home, '.config');
}

export function getConfigPaths(projectPath?: string): ConfigPaths {
  const ad = appData();

  const paths: ConfigPaths = {
    claudeDesktop: isMac
      ? join(ad, 'Claude', 'claude_desktop_config.json')
      : isWindows
        ? join(ad, 'Claude', 'claude_desktop_config.json')
        : join(ad, 'Claude', 'claude_desktop_config.json'),

    dockerMcp: join(home, '.docker', 'mcp', 'registry.yaml'),

    cursor: join(home, '.cursor', 'mcp.json'),

    vscode: isMac
      ? join(ad, 'Code', 'User', 'mcp.json')
      : isWindows
        ? join(ad, 'Code', 'User', 'mcp.json')
        : join(ad, 'Code', 'User', 'mcp.json'),

    gemini: join(home, '.gemini', 'antigravity', 'mcp_config.json'),

    claudeCli: join(home, '.claude', 'settings.json'),

    skills: join(home, '.claude', 'skills'),

    skillLock: join(home, '.agents', '.skill-lock.json'),

    plugins: join(home, '.claude', 'plugins', 'installed_plugins.json'),
  };

  if (projectPath) {
    paths.projectMcp = join(projectPath, '.mcp.json');
    paths.projectCodexMcp = join(projectPath, '.codex', 'mcp.json');
    paths.projectCodexConfig = join(projectPath, '.codex', 'config.toml');
  }

  return paths;
}

export function getAllWatchPaths(paths: ConfigPaths): string[] {
  const watchable = [
    paths.claudeDesktop,
    paths.dockerMcp,
    paths.cursor,
    paths.vscode,
    paths.gemini,
    paths.claudeCli,
    paths.plugins,
  ];
  if (paths.projectMcp) {
    watchable.push(paths.projectMcp);
  }
  if (paths.projectCodexMcp) {
    watchable.push(paths.projectCodexMcp);
  }
  if (paths.projectCodexConfig) {
    watchable.push(paths.projectCodexConfig);
  }
  return watchable;
}
