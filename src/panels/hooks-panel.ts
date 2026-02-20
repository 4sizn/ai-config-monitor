import type { HookEvent } from '../types/index.ts';
import { boxLine, emptyBoxLine, renderTableHeader, renderTableRow } from '../renderer/box.ts';
import type { Column } from '../renderer/box.ts';
import { theme } from '../renderer/theme.ts';

export function renderHooksPanel(
  hooks: HookEvent[],
  width: number,
  maxRows: number,
): string[] {
  const lines: string[] = [];

  if (hooks.length === 0) {
    lines.push(emptyBoxLine(width));
    lines.push(boxLine(theme.muted('  No hooks configured'), width));
    lines.push(emptyBoxLine(width));
    return lines;
  }

  const innerWidth = width - 4;
  const columns: Column[] = [
    { header: 'EVENT', width: Math.min(20, Math.floor(innerWidth * 0.2)) },
    { header: 'MATCHER', width: Math.min(16, Math.floor(innerWidth * 0.16)) },
    { header: 'COMMAND', width: Math.max(Math.floor(innerWidth * 0.44), 20) },
    { header: 'SCOPE', width: 10 },
  ];

  lines.push(...renderTableHeader(columns, width));

  let rowCount = 0;
  for (const hook of hooks) {
    if (rowCount >= maxRows) break;

    const scopeColor = hook.scope === 'global' ? theme.accent : hook.scope === 'project' ? theme.vendorProject : theme.muted;

    lines.push(renderTableRow(
      [
        theme.label(hook.type),
        theme.muted(hook.matcher || '*'),
        theme.value(hook.command),
        scopeColor(hook.scope),
      ],
      columns,
      width,
    ));
    rowCount++;
  }

  while (rowCount < maxRows) {
    lines.push(emptyBoxLine(width));
    rowCount++;
  }

  return lines;
}
