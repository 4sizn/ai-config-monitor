import { padRight, visibleWidth } from './ansi.ts';
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
  const padded = padRight(content, width - 4);
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

export function renderTableHeader(columns: Column[], totalWidth: number): string[] {
  const lines: string[] = [];
  let headerLine = '';

  for (const col of columns) {
    headerLine += theme.label(padRight(col.header, col.width));
  }

  lines.push(boxLine(headerLine, totalWidth));
  lines.push(boxLine(theme.muted(box.h.repeat(totalWidth - 4)), totalWidth));
  return lines;
}

export function renderTableRow(values: string[], columns: Column[], totalWidth: number): string {
  let line = '';
  for (let i = 0; i < columns.length; i++) {
    const val = values[i] || '';
    const vw = visibleWidth(val);
    if (vw > columns[i].width) {
      line += val.slice(0, columns[i].width);
    } else {
      line += padRight(val, columns[i].width);
    }
  }
  return boxLine(line, totalWidth);
}
