import type { AppState } from '../types/index.ts';
import { boxLine, emptyBoxLine } from '../renderer/box.ts';
import { theme, statusIcon } from '../renderer/theme.ts';
import { padRight } from '../renderer/ansi.ts';

export function renderOverviewPanel(state: AppState, width: number, maxRows: number): string[] {
  const lines: string[] = [];

  // Summary stats
  lines.push(emptyBoxLine(width));
  lines.push(boxLine(theme.header('  SUMMARY'), width));
  lines.push(emptyBoxLine(width));

  const activeCount = state.servers.filter(s => s.status === 'ACTIVE' || s.status === 'RUNNING').length;
  const stoppedCount = state.servers.filter(s => s.status === 'STOPPED' || s.status === 'ERROR').length;
  const unknownCount = state.servers.filter(s => s.status === 'UNKNOWN').length;
  const totalChildren = state.servers.reduce((acc, s) => acc + (s.children?.length || 0), 0);

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
