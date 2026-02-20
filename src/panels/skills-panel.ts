import type { Skill, ConfigScope } from '../types/index.ts';
import { boxLine, emptyBoxLine, renderTableHeader, renderTableRow } from '../renderer/box.ts';
import type { Column } from '../renderer/box.ts';
import { theme } from '../renderer/theme.ts';

export function renderSkillsPanel(
  skills: Skill[],
  width: number,
  maxRows: number,
): string[] {
  const lines: string[] = [];

  if (skills.length === 0) {
    lines.push(emptyBoxLine(width));
    lines.push(boxLine(theme.muted('  No skills found'), width));
    lines.push(emptyBoxLine(width));
    return lines;
  }

  const innerWidth = width - 4;
  const columns: Column[] = [
    { header: 'NAME', width: Math.min(24, Math.floor(innerWidth * 0.22)) },
    { header: 'SCOPE', width: 10 },
    { header: 'LOCKED', width: 8 },
    { header: 'DESCRIPTION', width: Math.max(innerWidth - 42, 10) },
  ];

  lines.push(...renderTableHeader(columns, width));

  let rowCount = 0;
  for (const skill of skills) {
    if (rowCount >= maxRows) break;

    const lockIcon = skill.locked ? theme.alertWarn('🔒') : theme.active('  ');
    const desc = skill.description || theme.muted('-');

    lines.push(renderTableRow(
      [theme.value(skill.name), scopeLabel(skill.scope), lockIcon, theme.muted(desc)],
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

function scopeLabel(scope: ConfigScope): string {
  switch (scope) {
    case 'global':        return theme.accent('global');
    case 'project':       return theme.vendorProject('project');
    case 'project.local': return theme.muted('proj.local');
  }
}
