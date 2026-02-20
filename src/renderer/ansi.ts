// ─── ANSI Escape Code Helpers ───

export const ESC = '\x1b';

// Cursor movement
export const cursorHome = `${ESC}[H`;
export const cursorTo = (row: number, col: number) => `${ESC}[${row};${col}H`;
export const cursorHide = `${ESC}[?25l`;
export const cursorShow = `${ESC}[?25h`;

// Screen
export const clearScreen = `${ESC}[2J`;
export const clearLine = `${ESC}[2K`;
export const clearToEnd = `${ESC}[J`;

// Alternate screen buffer
export const enterAltScreen = `${ESC}[?1049h`;
export const leaveAltScreen = `${ESC}[?1049l`;

// Bell
export const bell = '\x07';

// Reset
export const reset = `${ESC}[0m`;

// Text formatting
export const bold = (s: string) => `${ESC}[1m${s}${ESC}[22m`;
export const dim = (s: string) => `${ESC}[2m${s}${ESC}[22m`;
export const inverse = (s: string) => `${ESC}[7m${s}${ESC}[27m`;

// Measure visible string width (strip ANSI codes)
export function visibleWidth(s: string): number {
  if (typeof Bun !== 'undefined' && Bun.stringWidth) {
    return Bun.stringWidth(s);
  }
  const stripped = stripAnsi(s);
  return stripped.length;
}

export function stripAnsi(s: string): string {
  if (typeof Bun !== 'undefined' && Bun.stripANSI) {
    return Bun.stripANSI(s);
  }
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// Pad string to visible width
export function padRight(s: string, width: number): string {
  const vw = visibleWidth(s);
  if (vw >= width) return s;
  return s + ' '.repeat(width - vw);
}

// Truncate ANSI-colored string to maxWidth visible chars, preserving colors
export function truncateAnsi(s: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (visibleWidth(s) <= maxWidth) return s;

  let visible = 0;
  let result = '';
  let i = 0;

  while (i < s.length && visible < maxWidth) {
    // ANSI escape sequence: copy entirely (zero visible width)
    if (s[i] === '\x1b' && s[i + 1] === '[') {
      const start = i;
      i += 2;
      while (i < s.length && s[i] !== 'm') i++;
      i++; // skip 'm'
      result += s.slice(start, i);
      continue;
    }

    result += s[i];
    visible++;
    i++;
  }

  // Close any open ANSI sequences
  result += `${ESC}[0m`;
  return result;
}

// Truncate and pad: fit ANSI string to exact visible width
export function fitWidth(s: string, width: number): string {
  if (width <= 0) return '';
  const vw = visibleWidth(s);
  if (vw === width) return s;
  if (vw > width) return truncateAnsi(s, width);
  return s + ' '.repeat(width - vw);
}

// Truncate to visible width (strips colors)
export function truncate(s: string, maxWidth: number): string {
  if (visibleWidth(s) <= maxWidth) return s;
  const stripped = stripAnsi(s);
  return stripped.slice(0, maxWidth - 1) + '…';
}
