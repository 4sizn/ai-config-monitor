import { padRight, fitWidth, visibleWidth } from './ansi.ts';
import { theme } from './theme.ts';

// ─── Box Drawing Characters ───

interface BoxChars {
  tl: string; tr: string; bl: string; br: string;
  h: string; v: string;
  ltee: string; rtee: string;
  ttee: string; btee: string;
  cross: string;
}

const unicodeBox: BoxChars = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│',
  ltee: '├', rtee: '┤',
  ttee: '┬', btee: '┴',
  cross: '┼',
};

const asciiBox: BoxChars = {
  tl: '+', tr: '+', bl: '+', br: '+',
  h: '-', v: '|',
  ltee: '+', rtee: '+',
  ttee: '+', btee: '+',
  cross: '+',
};

function getBoxChars(): BoxChars {
  // Windows Terminal supports Unicode
  if (process.platform === 'win32' && !process.env.WT_SESSION) {
    return asciiBox;
  }
  return unicodeBox;
}

export const box = getBoxChars();

// ─── Box Drawing Functions ───

export function horizontalLine(width: number, color: (s: string) => string = theme.border): string {
  return color(box.h.repeat(width));
}

export function topBorder(width: number): string {
  return theme.border(box.tl + box.h.repeat(width - 2) + box.tr);
}

export function bottomBorder(width: number): string {
  return theme.border(box.bl + box.h.repeat(width - 2) + box.br);
}

export function middleBorder(width: number): string {
  return theme.border(box.ltee + box.h.repeat(width - 2) + box.rtee);
}

export function boxLine(content: string, width: number): string {
  const innerWidth = width - 4;
  const vw = visibleWidth(content);
  let padded: string;
  if (vw >= innerWidth) {
    padded = fitWidth(content, innerWidth);
  } else {
    padded = content + ' '.repeat(innerWidth - vw);
  }
  return theme.border(box.v) + ' ' + padded + ' ' + theme.border(box.v);
}

export function emptyBoxLine(width: number): string {
  return theme.border(box.v) + ' '.repeat(width - 2) + theme.border(box.v);
}

// ─── Table Rendering ───

export interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

// Normalize column widths to fit within innerWidth
function normalizeColumns(columns: Column[], innerWidth: number): Column[] {
  const total = columns.reduce((sum, c) => sum + c.width, 0);
  if (total <= innerWidth) return columns;

  // Scale down proportionally
  const ratio = innerWidth / total;
  const normalized = columns.map(c => ({
    ...c,
    width: Math.max(Math.floor(c.width * ratio), 4),
  }));

  // Distribute remaining space to last column
  const newTotal = normalized.reduce((sum, c) => sum + c.width, 0);
  const diff = innerWidth - newTotal;
  if (diff > 0) {
    normalized[normalized.length - 1].width += diff;
  }

  return normalized;
}

export function renderTableHeader(columns: Column[], totalWidth: number): string[] {
  const innerWidth = totalWidth - 4;
  const cols = normalizeColumns(columns, innerWidth);
  const lines: string[] = [];
  let headerLine = '';

  for (const col of cols) {
    headerLine += theme.label(padRight(col.header, col.width));
  }

  lines.push(boxLine(headerLine, totalWidth));
  lines.push(boxLine(theme.muted(box.h.repeat(innerWidth)), totalWidth));
  return lines;
}

export function renderTableRow(values: string[], columns: Column[], totalWidth: number): string {
  const innerWidth = totalWidth - 4;
  const cols = normalizeColumns(columns, innerWidth);
  let line = '';

  for (let i = 0; i < cols.length; i++) {
    const val = values[i] || '';
    line += fitWidth(val, cols[i].width);
  }

  return boxLine(line, totalWidth);
}
