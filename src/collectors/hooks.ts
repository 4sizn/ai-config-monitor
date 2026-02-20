import { existsSync } from 'fs';
import type { HookEvent, ConfigScope } from '../types/index.ts';

export async function collectHooks(cliSettingsPath: string, projectPath?: string): Promise<HookEvent[]> {
  const hooks: HookEvent[] = [];

  const globalHooks = await loadHooksFromSettings(cliSettingsPath, 'global');
  hooks.push(...globalHooks);

  if (projectPath) {
    const projectSettings = `${projectPath}/.claude/settings.json`;
    const projectHooks = await loadHooksFromSettings(projectSettings, 'project');
    hooks.push(...projectHooks);
  }

  return hooks;
}

async function loadHooksFromSettings(settingsPath: string, scope: ConfigScope): Promise<HookEvent[]> {
  if (!existsSync(settingsPath)) return [];

  try {
    const raw = await Bun.file(settingsPath).text();
    const settings = JSON.parse(raw);
    const hooksSection = settings.hooks;
    if (!hooksSection || typeof hooksSection !== 'object') return [];

    const events: HookEvent[] = [];

    for (const [eventType, hookGroups] of Object.entries(hooksSection)) {
      if (!Array.isArray(hookGroups)) continue;

      for (const group of hookGroups) {
        if (typeof group !== 'object' || group === null) continue;
        const g = group as Record<string, unknown>;
        const matcher = g.matcher as string | undefined;

        // 구조: { matcher?, hooks: [ { type, command } ] }
        const innerHooks = g.hooks;
        if (Array.isArray(innerHooks)) {
          for (const hook of innerHooks) {
            if (typeof hook !== 'object' || hook === null) continue;
            const h = hook as Record<string, unknown>;
            events.push({
              type: eventType,
              matcher,
              command: (h.command as string) || '',
              scope,
            });
          }
        } else if (g.command) {
          // 단순 구조: { matcher?, command }
          events.push({
            type: eventType,
            matcher,
            command: g.command as string,
            scope,
          });
        }
      }
    }

    return events;
  } catch {
    return [];
  }
}
