import { existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { McpServer } from '../types/index.ts';

export async function collectDockerMcp(registryPath: string): Promise<McpServer[]> {
  if (!existsSync(registryPath)) return [];

  try {
    const raw = await Bun.file(registryPath).text();
    const doc = parseYaml(raw);
    if (!doc || typeof doc !== 'object') return [];

    const servers: McpServer[] = [];

    // registry.yaml 구조: { registry: { name: { ref: ... } } }
    // 또는 { servers: { name: {...} } } 또는 직접 최상위
    const serversObj = doc.registry || doc.servers || doc;

    for (const [name, entry] of Object.entries(serversObj)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;

      servers.push({
        vendor: 'Docker',
        name,
        transport: 'docker',
        scope: 'global',
        status: 'UNKNOWN',
        detail: extractDockerDetail(e),
        command: 'docker',
      });
    }

    return servers;
  } catch {
    return [];
  }
}

function extractDockerDetail(entry: Record<string, unknown>): string {
  const metadata = entry.metadata as Record<string, unknown> | undefined;
  if (metadata?.title) return metadata.title as string;
  if (entry.image) return `image: ${entry.image}`;
  return 'container';
}
