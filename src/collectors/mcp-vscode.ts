import { existsSync } from 'fs';
import type { McpServer, TransportType } from '../types/index.ts';

export async function collectVSCode(configPath: string): Promise<McpServer[]> {
  if (!existsSync(configPath)) return [];

  try {
    const raw = await Bun.file(configPath).text();
    const config = JSON.parse(raw);
    // VS Code mcp.json 구조: { servers: { name: { ... } } } 또는 { mcpServers: {...} }
    const mcpServers = config.servers || config.mcpServers || {};
    const servers: McpServer[] = [];

    for (const [name, entry] of Object.entries(mcpServers)) {
      const e = entry as Record<string, unknown>;
      const transport = detectTransport(e);

      servers.push({
        vendor: 'VS Code',
        name,
        transport,
        status: 'UNKNOWN',
        detail: buildDetail(e, transport),
        scope: 'global',
        command: e.command as string | undefined,
        args: e.args as string[] | undefined,
        url: e.url as string | undefined,
      });
    }

    return servers;
  } catch {
    return [];
  }
}

function detectTransport(entry: Record<string, unknown>): TransportType {
  if (entry.url) return 'http';
  if (entry.type === 'sse') return 'sse';
  const cmd = (entry.command as string) || '';
  if (cmd === 'npx' || cmd.includes('npx')) return 'npx';
  return 'stdio';
}

function buildDetail(entry: Record<string, unknown>, transport: TransportType): string {
  if (transport === 'http' || transport === 'sse') return entry.url as string || '';
  const cmd = entry.command as string || '';
  const args = (entry.args as string[]) || [];
  return `${cmd} ${args.join(' ')}`.trim();
}
