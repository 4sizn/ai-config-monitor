import { existsSync } from 'fs';
import type { McpServer, TransportType } from '../types/index.ts';

export async function collectClaudeDesktop(configPath: string): Promise<McpServer[]> {
  if (!existsSync(configPath)) return [];

  try {
    const raw = await Bun.file(configPath).text();
    const config = JSON.parse(raw);
    const mcpServers = config.mcpServers || {};
    const servers: McpServer[] = [];

    for (const [name, entry] of Object.entries(mcpServers)) {
      const e = entry as Record<string, unknown>;
      const transport = detectTransport(e);
      servers.push({
        vendor: 'Claude',
        name,
        transport,
        scope: 'global',
        status: 'UNKNOWN',
        detail: buildDetail(e, transport),
        command: e.command as string | undefined,
        args: e.args as string[] | undefined,
        url: e.url as string | undefined,
        env: e.env as Record<string, string> | undefined,
      });
    }

    return servers;
  } catch {
    return [];
  }
}

function detectTransport(entry: Record<string, unknown>): TransportType {
  if (entry.url) {
    const url = entry.url as string;
    if (url.includes('/sse')) return 'sse';
    return 'http';
  }
  const cmd = (entry.command as string) || '';
  if (cmd === 'docker' || cmd.includes('docker')) return 'gateway';
  if (cmd === 'npx' || cmd.includes('npx')) return 'npx';
  return 'stdio';
}

function buildDetail(entry: Record<string, unknown>, transport: TransportType): string {
  if (transport === 'http' || transport === 'sse') return entry.url as string || '';
  const cmd = entry.command as string || '';
  const args = (entry.args as string[]) || [];
  return `${cmd} ${args.join(' ')}`.trim();
}
