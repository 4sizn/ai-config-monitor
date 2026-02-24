#!/usr/bin/env bun

import { App } from './app.ts';
import { runUpdate } from './update/updater.ts';
import { APP_BIN, APP_NAME, APP_VERSION } from './version.ts';

interface MonitorOptions {
  projectPath?: string;
  intervalMs?: number;
  showHelp?: boolean;
  showVersion?: boolean;
}

interface UpdateCliOptions {
  check: boolean;
  force: boolean;
  json: boolean;
  help: boolean;
}

function parseMonitorArgs(args: string[]): MonitorOptions {
  let projectPath: string | undefined = process.cwd();
  let intervalMs: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      projectPath = args[i + 1];
      i++;
    } else if (args[i]?.startsWith('--project=')) {
      projectPath = args[i].slice('--project='.length);
    } else if (args[i] === '--interval' && args[i + 1]) {
      intervalMs = Math.max(parseInt(args[i + 1], 10) * 1000, 3000);
      i++;
    } else if (args[i]?.startsWith('--interval=')) {
      intervalMs = Math.max(parseInt(args[i].slice('--interval='.length), 10) * 1000, 3000);
    } else if (args[i] === '--help' || args[i] === '-h') {
      return { showHelp: true };
    } else if (args[i] === '--version' || args[i] === '-v') {
      return { showVersion: true };
    }
  }

  return { projectPath, intervalMs };
}

function parseUpdateArgs(args: string[]): UpdateCliOptions {
  const options: UpdateCliOptions = {
    check: false,
    force: false,
    json: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--check') options.check = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  return options;
}

function printMainHelp(): void {
  console.log(`
${APP_NAME} v${APP_VERSION}

Real-time CLI dashboard for monitoring AI vendor configurations.

Usage:
  ${APP_BIN} [options]
  ${APP_BIN} update [--check] [--force] [--json]

Options:
  --project <path>   Watch project-level MCP config
  --interval <sec>   Health check interval in seconds (default: 10, min: 3)
  -h, --help         Show this help message
  -v, --version      Show version

Update:
  update             Update to latest npm dist-tag
  --check            Check latest version only (no install)
  --force            Reinstall latest even if already up to date
  --json             Print machine-readable output

Keyboard:
  1-4                Jump to tab
  Tab                Next tab
  r                  Manual refresh
  q / Ctrl+C         Quit

Monitors:
  Claude Desktop, Cursor, VS Code, Gemini, Docker MCP
  Skills, Hooks, Plugins
`);
}

function printUpdateHelp(): void {
  console.log(`
${APP_NAME} v${APP_VERSION}

Usage:
  ${APP_BIN} update [options]

Options:
  --check            Check only. Exit 10 when update is available
  --force            Reinstall latest even if current is already latest
  --json             Print result as JSON
  -h, --help         Show this help message

Examples:
  ${APP_BIN} update
  ${APP_BIN} update --check
  ${APP_BIN} update --json
`);
}

async function runUpdateCommand(args: string[]): Promise<number> {
  const options = parseUpdateArgs(args);

  if (options.help) {
    printUpdateHelp();
    return 0;
  }

  const outcome = await runUpdate(APP_VERSION, {
    check: options.check,
    force: options.force,
  });

  if (options.json) {
    console.log(JSON.stringify(outcome, null, 2));
    return outcome.exitCode;
  }

  if (outcome.action === 'error') {
    console.error(`Update failed: ${outcome.message}`);
    if (outcome.detail) console.error(outcome.detail);
    if (outcome.command) console.error(`Retry: ${outcome.command}`);
    return outcome.exitCode;
  }

  if (outcome.action === 'check') {
    const status = outcome.exitCode === 0 ? 'up-to-date' : 'update-available';
    console.log(`Status: ${status}`);
    console.log(`Current: ${outcome.currentVersion}`);
    console.log(`Latest: ${outcome.latestVersion ?? 'unknown'}`);
    if (outcome.command) console.log(`Update command: ${outcome.command}`);
    return outcome.exitCode;
  }

  if (outcome.action === 'updated') {
    console.log(`Updated successfully (${outcome.message})`);
    console.log(`Previous: ${outcome.currentVersion}`);
    console.log(`Latest: ${outcome.latestVersion ?? 'unknown'}`);
    return outcome.exitCode;
  }

  console.log(`Current: ${outcome.currentVersion}`);
  console.log(`Latest: ${outcome.latestVersion ?? 'unknown'}`);
  console.log(outcome.message);
  return outcome.exitCode;
}

async function runMonitor(args: string[]): Promise<void> {
  const parsed = parseMonitorArgs(args);

  if (parsed.showHelp) {
    printMainHelp();
    process.exit(0);
  }
  if (parsed.showVersion) {
    console.log(`${APP_NAME} v${APP_VERSION}`);
    process.exit(0);
  }

  const app = new App(parsed.projectPath, parsed.intervalMs);

  const shutdown = async () => {
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.start();
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'update') {
    const exitCode = await runUpdateCommand(args.slice(1));
    process.exit(exitCode);
  }

  await runMonitor(args);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
