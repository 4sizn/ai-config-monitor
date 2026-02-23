import { existsSync } from 'fs';
import type { McpServer, TransportType } from '../types/index.ts';

export async function collectProjectMcp(projectMcpPath?: string, projectCodexMcpPath?: string): Promise<McpServer[]> {
  const servers: McpServer[] = [];
  const seen = new Set<string>();

  if (projectMcpPath && existsSync(projectMcpPath)) {
    const parsed = await parseProjectFile(projectMcpPath);
    for (const server of parsed) {
      const key = `${server.name}:${server.command || ''}:${server.url || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        servers.push(server);
      }
    }
  }

  if (projectCodexMcpPath && existsSync(projectCodexMcpPath)) {
    const parsed = await parseProjectFile(projectCodexMcpPath);
    for (const server of parsed) {
      const key = `${server.name}:${server.command || ''}:${server.url || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        servers.push(server);
      }
    }
  }

  return servers;
}

async function parseProjectFile(configPath: string): Promise<McpServer[]> {
  try {
    const raw = await Bun.file(configPath).text();
    const config = JSON.parse(raw);
    const mcpServers = config.mcpServers || config.servers || {};
    const servers: McpServer[] = [];

    for (const [name, entry] of Object.entries(mcpServers)) {
      const e = entry as Record<string, unknown>;
      const transport = detectTransport(e);
      servers.push({
        vendor: 'Project',
        name,
        transport,
        status: 'UNKNOWN',
        detail: buildDetail(e, transport),
        scope: 'project',
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
  const cmd = (entry.command as string) || '';
  if (cmd === 'npx' || cmd.includes('npx')) return 'npx';
  if (cmd === 'docker' || cmd.includes('docker')) return 'docker';
  return 'stdio';
}

function buildDetail(entry: Record<string, unknown>, transport: TransportType): string {
  if (transport === 'http') return entry.url as string || '';
  const cmd = entry.command as string || '';
  const args = (entry.args as string[]) || [];
  return `${cmd} ${args.join(' ')}`.trim();
}
