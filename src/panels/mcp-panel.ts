import type { McpServer, AlertEvent, ConfigScope } from '../types/index.ts';
import { boxLine, emptyBoxLine, renderTableHeader, renderTableRow } from '../renderer/box.ts';
import type { Column } from '../renderer/box.ts';
import { theme, statusIcon, statusColor, vendorColor } from '../renderer/theme.ts';

export function renderMcpPanel(
  servers: McpServer[],
  alerts: AlertEvent[],
  width: number,
  maxRows: number,
): string[] {
  const lines: string[] = [];

  if (servers.length === 0) {
    lines.push(emptyBoxLine(width));
    lines.push(boxLine(theme.muted('  No MCP servers configured'), width));
    lines.push(emptyBoxLine(width));
    return lines;
  }

  const innerWidth = width - 4;
  const columns = getColumns(innerWidth);

  lines.push(...renderTableHeader(columns, width));

  let rowCount = 0;
  for (const server of servers) {
    if (rowCount >= maxRows) break;
    lines.push(renderServerRow(server, columns, width, false));
    rowCount++;

    if (server.children) {
      for (const child of server.children) {
        if (rowCount >= maxRows) break;
        lines.push(renderServerRow(child, columns, width, true));
        rowCount++;
      }
    }
  }

  while (rowCount < maxRows) {
    lines.push(emptyBoxLine(width));
    rowCount++;
  }

  if (alerts.length > 0) {
    lines.push(emptyBoxLine(width));
    const recentAlerts = alerts.slice(-3);
    for (const alert of recentAlerts) {
      const time = formatTime(alert.time);
      const msg = theme.alertText(`  [!] ${alert.server}: ${alert.from} → ${alert.to} (${time})`);
      lines.push(boxLine(msg, width));
    }
  }

  return lines;
}

function getColumns(innerWidth: number): Column[] {
  if (innerWidth >= 90) {
    return [
      { header: 'VENDOR', width: 14 },
      { header: 'SERVER', width: 20 },
      { header: 'SCOPE', width: 10 },
      { header: 'TRANSPORT', width: 12 },
      { header: 'STATUS', width: 14 },
      { header: 'DETAIL', width: Math.max(innerWidth - 70, 10) },
    ];
  }
  if (innerWidth >= 70) {
    return [
      { header: 'VENDOR', width: 12 },
      { header: 'SERVER', width: 18 },
      { header: 'SCOPE', width: 10 },
      { header: 'STATUS', width: 14 },
      { header: 'DETAIL', width: Math.max(innerWidth - 54, 8) },
    ];
  }
  // Narrow
  return [
    { header: 'VENDOR', width: 10 },
    { header: 'SERVER', width: 16 },
    { header: 'STATUS', width: 12 },
    { header: 'DETAIL', width: Math.max(innerWidth - 38, 8) },
  ];
}

function scopeLabel(scope: ConfigScope): string {
  switch (scope) {
    case 'global':        return theme.accent('global');
    case 'project':       return theme.vendorProject('project');
    case 'project.local': return theme.muted('proj.local');
  }
}

function renderServerRow(server: McpServer, columns: Column[], totalWidth: number, isChild: boolean): string {
  const icon = statusIcon(server.status);
  const sColor = statusColor(server.status);
  const vColor = vendorColor(server.vendor);

  let vendorLabel: string;
  if (isChild) {
    vendorLabel = theme.muted(`  └─ ${server.transport}`);
  } else {
    vendorLabel = vColor(server.vendor);
  }

  let detail = server.detail || '';
  if (server.responseTime) {
    detail = `${server.responseTime}ms`;
  }
  if (server.pid) {
    detail = `PID ${server.pid}`;
  }

  const scope = isChild ? theme.muted('') : scopeLabel(server.scope);

  if (columns.length === 6) {
    // Wide: VENDOR | SERVER | SCOPE | TRANSPORT | STATUS | DETAIL
    return renderTableRow(
      [vendorLabel, theme.value(server.name), scope, theme.muted(server.transport), `${icon} ${sColor(server.status)}`, theme.muted(detail)],
      columns,
      totalWidth,
    );
  }
  if (columns.length === 5) {
    // Medium: VENDOR | SERVER | SCOPE | STATUS | DETAIL
    return renderTableRow(
      [vendorLabel, theme.value(server.name), scope, `${icon} ${sColor(server.status)}`, theme.muted(detail)],
      columns,
      totalWidth,
    );
  }
  // Narrow: VENDOR | SERVER | STATUS | DETAIL
  return renderTableRow(
    [vendorLabel, theme.value(server.name), `${icon} ${sColor(server.status)}`, theme.muted(detail)],
    columns,
    totalWidth,
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
