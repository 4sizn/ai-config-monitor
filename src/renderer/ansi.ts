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
  // Use Bun built-in if available
  if (typeof Bun !== 'undefined' && Bun.stringWidth) {
    return Bun.stringWidth(s);
  }
  // Fallback: strip ANSI and count
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

// Truncate to visible width
export function truncate(s: string, maxWidth: number): string {
  if (visibleWidth(s) <= maxWidth) return s;
  const stripped = stripAnsi(s);
  return stripped.slice(0, maxWidth - 1) + '…';
}
