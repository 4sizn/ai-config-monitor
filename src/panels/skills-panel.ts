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
  const columns = getColumns(innerWidth);

  lines.push(...renderTableHeader(columns, width));

  let rowCount = 0;
  for (const skill of skills) {
    if (rowCount >= maxRows) break;

    const lockIcon = skill.locked ? theme.alertWarn('🔒') : theme.active('  ');
    const desc = skill.description || theme.muted('-');
    const modified = skill.lastModified
      ? theme.muted(skill.lastModified.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }))
      : theme.muted('-');

    const values: string[] = [theme.value(skill.name), scopeLabel(skill.scope), lockIcon];
    if (columns.length >= 6) {
      // Ultra-wide: NAME | SCOPE | LOCKED | SOURCE | MODIFIED | DESCRIPTION
      values.push(theme.muted(skill.source || '-'), modified, theme.muted(desc));
    } else if (columns.length >= 5) {
      // Wide: NAME | SCOPE | LOCKED | MODIFIED | DESCRIPTION
      values.push(modified, theme.muted(desc));
    } else {
      // Standard: NAME | SCOPE | LOCKED | DESCRIPTION
      values.push(theme.muted(desc));
    }

    lines.push(renderTableRow(values, columns, width));
    rowCount++;
  }

  while (rowCount < maxRows) {
    lines.push(emptyBoxLine(width));
    rowCount++;
  }

  return lines;
}

function getColumns(innerWidth: number): Column[] {
  // Ultra-wide (>=140): 6 columns with SOURCE and MODIFIED
  if (innerWidth >= 140) {
    const fixed = 28 + 14 + 10 + 40 + 12; // NAME + SCOPE + LOCKED + SOURCE + MODIFIED
    const descW = Math.max(innerWidth - fixed, 16);
    return [
      { header: 'NAME', width: 28 },
      { header: 'SCOPE', width: 14 },
      { header: 'LOCKED', width: 10 },
      { header: 'SOURCE', width: 40 },
      { header: 'MODIFIED', width: 12 },
      { header: 'DESCRIPTION', width: descW },
    ];
  }
  // Wide (>=90): 5 columns with MODIFIED
  if (innerWidth >= 90) {
    const fixed = 24 + 14 + 10 + 12;
    const descW = Math.max(innerWidth - fixed, 16);
    return [
      { header: 'NAME', width: 24 },
      { header: 'SCOPE', width: 14 },
      { header: 'LOCKED', width: 10 },
      { header: 'MODIFIED', width: 12 },
      { header: 'DESCRIPTION', width: descW },
    ];
  }
  // Standard: 4 columns
  return [
    { header: 'NAME', width: Math.min(24, Math.floor(innerWidth * 0.25)) },
    { header: 'SCOPE', width: 12 },
    { header: 'LOCKED', width: 10 },
    { header: 'DESCRIPTION', width: Math.max(innerWidth - 46, 10) },
  ];
}

function scopeLabel(scope: ConfigScope): string {
  switch (scope) {
    case 'global':        return theme.accent('global');
    case 'project':       return theme.vendorProject('project');
    case 'project.local': return theme.muted('proj.local');
  }
}
