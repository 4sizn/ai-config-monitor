import { existsSync } from 'fs';
import type { Plugin } from '../types/index.ts';

export async function collectPlugins(pluginsPath: string): Promise<Plugin[]> {
  if (!existsSync(pluginsPath)) return [];

  try {
    const raw = await Bun.file(pluginsPath).text();
    const data = JSON.parse(raw);
    const plugins: Plugin[] = [];

    if (Array.isArray(data)) {
      for (const entry of data) {
        if (typeof entry === 'object' && entry !== null) {
          plugins.push({
            name: entry.name || entry.id || 'unknown',
            version: entry.version,
            enabled: entry.enabled !== false,
            scope: 'global',
            source: entry.source || entry.path,
          });
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const [name, entry] of Object.entries(data)) {
        const e = entry as Record<string, unknown> | null;
        plugins.push({
          name,
          version: e?.version as string | undefined,
          enabled: e?.enabled !== false,
          scope: 'global',
          source: e?.source as string | undefined,
        });
      }
    }

    return plugins;
  } catch {
    return [];
  }
}
