import type { AppState } from '../types/index.ts';
import { boxLine, emptyBoxLine } from '../renderer/box.ts';
import { theme, statusIcon } from '../renderer/theme.ts';
import { padRight, visibleWidth } from '../renderer/ansi.ts';

export function renderOverviewPanel(state: AppState, width: number, maxRows: number): string[] {
  const innerWidth = width - 4;

  // Wide (>=120): side-by-side 2-column layout
  if (innerWidth >= 120) {
    return renderWideOverview(state, width, innerWidth, maxRows);
  }
  return renderNarrowOverview(state, width, maxRows);
}

function renderWideOverview(state: AppState, width: number, innerWidth: number, maxRows: number): string[] {
  const lines: string[] = [];
  const colW = Math.floor(innerWidth / 2) - 2; // each column width with gap

  const activeCount = state.servers.filter(s => s.status === 'ACTIVE' || s.status === 'RUNNING').length;
  const stoppedCount = state.servers.filter(s => s.status === 'STOPPED' || s.status === 'ERROR').length;
  const unknownCount = state.servers.filter(s => s.status === 'UNKNOWN').length;
  const totalChildren = state.servers.reduce((acc, s) => acc + (s.children?.length || 0), 0);

  // Build left column lines (SUMMARY + HEALTH)
  const left: string[] = [];
  left.push(theme.header('SUMMARY'));
  left.push('');
  left.push(`${padRight(theme.label('MCP Servers'), 20)} ${theme.title(String(state.servers.length))}  ${theme.muted(totalChildren > 0 ? `(+${totalChildren} sub)` : '')}`);
  left.push(`${padRight(theme.label('Skills'), 20)} ${theme.title(String(state.skills.length))}  ${theme.muted(`${state.skills.filter(s => s.locked).length} locked`)}`);
  left.push(`${padRight(theme.label('Hooks'), 20)} ${theme.title(String(state.hooks.length))}  ${theme.muted(`${state.hooks.filter(h => h.scope === 'global').length} global, ${state.hooks.filter(h => h.scope === 'project').length} project`)}`);
  left.push(`${padRight(theme.label('Plugins'), 20)} ${theme.title(String(state.plugins.length))}  ${theme.muted(`${state.plugins.filter(p => p.enabled).length} enabled`)}`);
  left.push('');
  left.push(theme.header('HEALTH STATUS'));
  left.push('');
  left.push(`${theme.active('●')} Active/Running  ${theme.active(String(activeCount))}`);
  left.push(`${theme.stopped('●')} Stopped/Error   ${theme.stopped(String(stoppedCount))}`);
  left.push(`${theme.unknown('●')} Unknown         ${theme.unknown(String(unknownCount))}`);

  // Build right column lines (VENDORS + ALERTS)
  const right: string[] = [];
  right.push(theme.header('VENDORS'));
  right.push('');
  const vendors = new Map<string, number>();
  for (const s of state.servers) {
    vendors.set(s.vendor, (vendors.get(s.vendor) || 0) + 1);
  }
  for (const [vendor, count] of vendors) {
    right.push(`${padRight(theme.label(vendor), 20)} ${theme.value(String(count))} server(s)`);
  }

  if (state.alerts.length > 0) {
    right.push('');
    right.push(theme.header('RECENT ALERTS'));
    right.push('');
    const recent = state.alerts.slice(-5);
    for (const alert of recent) {
      const time = alert.time.toLocaleTimeString('en-US', { hour12: false });
      const icon = alert.to === 'STOPPED' || alert.to === 'ERROR' ? theme.stopped('●') : theme.active('●');
      right.push(`${icon} ${theme.value(alert.server)} ${theme.muted(`${alert.from} → ${alert.to}`)} ${theme.muted(time)}`);
    }
  }

  // Merge left + right side by side
  const maxSide = Math.max(left.length, right.length);
  lines.push(emptyBoxLine(width));
  for (let i = 0; i < maxSide; i++) {
    const l = padRight(left[i] || '', colW);
    const sep = theme.border('│');
    const r = padRight(right[i] || '', colW);
    lines.push(boxLine(`  ${l}  ${sep}  ${r}`, width));
  }

  // Fill
  while (lines.length < maxRows) {
    lines.push(emptyBoxLine(width));
  }

  return lines;
}

function renderNarrowOverview(state: AppState, width: number, maxRows: number): string[] {
  const lines: string[] = [];

  const activeCount = state.servers.filter(s => s.status === 'ACTIVE' || s.status === 'RUNNING').length;
  const stoppedCount = state.servers.filter(s => s.status === 'STOPPED' || s.status === 'ERROR').length;
  const unknownCount = state.servers.filter(s => s.status === 'UNKNOWN').length;
  const totalChildren = state.servers.reduce((acc, s) => acc + (s.children?.length || 0), 0);

  // Summary stats
  lines.push(emptyBoxLine(width));
  lines.push(boxLine(theme.header('  SUMMARY'), width));
  lines.push(emptyBoxLine(width));

  const stats = [
    ['MCP Servers', `${state.servers.length}`, totalChildren > 0 ? `(+${totalChildren} sub-servers)` : ''],
    ['Skills', `${state.skills.length}`, `${state.skills.filter(s => s.locked).length} locked`],
    ['Hooks', `${state.hooks.length}`, `${state.hooks.filter(h => h.scope === 'global').length} global, ${state.hooks.filter(h => h.scope === 'project').length} project`],
    ['Plugins', `${state.plugins.length}`, `${state.plugins.filter(p => p.enabled).length} enabled`],
  ];

  for (const [label, count, detail] of stats) {
    const line = `  ${padRight(theme.label(label), 20)} ${theme.title(count)}  ${theme.muted(detail)}`;
    lines.push(boxLine(line, width));
  }

  lines.push(emptyBoxLine(width));
  lines.push(boxLine(theme.header('  HEALTH STATUS'), width));
  lines.push(emptyBoxLine(width));

  lines.push(boxLine(`  ${theme.active('●')} Active/Running  ${theme.active(String(activeCount))}`, width));
  lines.push(boxLine(`  ${theme.stopped('●')} Stopped/Error   ${theme.stopped(String(stoppedCount))}`, width));
  lines.push(boxLine(`  ${theme.unknown('●')} Unknown         ${theme.unknown(String(unknownCount))}`, width));

  // Vendor breakdown
  lines.push(emptyBoxLine(width));
  lines.push(boxLine(theme.header('  VENDORS'), width));
  lines.push(emptyBoxLine(width));

  const vendors = new Map<string, number>();
  for (const s of state.servers) {
    vendors.set(s.vendor, (vendors.get(s.vendor) || 0) + 1);
  }
  for (const [vendor, count] of vendors) {
    lines.push(boxLine(`  ${padRight(theme.label(vendor), 20)} ${theme.value(String(count))} server(s)`, width));
  }

  // Recent alerts
  if (state.alerts.length > 0) {
    lines.push(emptyBoxLine(width));
    lines.push(boxLine(theme.header('  RECENT ALERTS'), width));
    lines.push(emptyBoxLine(width));

    const recent = state.alerts.slice(-5);
    for (const alert of recent) {
      const time = alert.time.toLocaleTimeString('en-US', { hour12: false });
      const icon = alert.to === 'STOPPED' || alert.to === 'ERROR' ? theme.stopped('●') : theme.active('●');
      lines.push(boxLine(`  ${icon} ${theme.value(alert.server)} ${theme.muted(`${alert.from} → ${alert.to}`)} ${theme.muted(time)}`, width));
    }
  }

  // Fill
  while (lines.length < maxRows) {
    lines.push(emptyBoxLine(width));
  }

  return lines;
}
