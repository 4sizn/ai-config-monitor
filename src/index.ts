#!/usr/bin/env bun

import { App } from './app.ts';

function parseArgs(): { projectPath?: string; intervalMs?: number } {
  const args = process.argv.slice(2);
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
      printHelp();
      process.exit(0);
    } else if (args[i] === '--version' || args[i] === '-v') {
      console.log('ai-config-monitor v1.2.2');
      process.exit(0);
    }
  }

  return { projectPath, intervalMs };
}

function printHelp(): void {
  console.log(`
ai-config-monitor v1.2.2

Real-time CLI dashboard for monitoring AI vendor configurations.

Usage:
  ai-monitor [options]

Options:
  --project <path>   Watch project-level MCP config
  --interval <sec>   Health check interval in seconds (default: 10, min: 3)
  -h, --help         Show this help message
  -v, --version      Show version

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

async function main() {
  const { projectPath, intervalMs } = parseArgs();

  const app = new App(projectPath, intervalMs);

  // Graceful shutdown
  const shutdown = async () => {
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.start();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
