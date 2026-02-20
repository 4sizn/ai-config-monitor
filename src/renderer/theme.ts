import ansis from 'ansis';

// ─── Color Theme ───
export const theme = {
  // Status colors
  active: ansis.green,
  running: ansis.green,
  stopped: ansis.red,
  error: ansis.red,
  unknown: ansis.yellow,
  empty: ansis.gray,

  // UI colors
  header: ansis.cyan.bold,
  title: ansis.white.bold,
  label: ansis.cyan,
  value: ansis.white,
  muted: ansis.gray,
  accent: ansis.magenta,

  // Alert
  alertBg: ansis.bgRed.white.bold,
  alertText: ansis.red.bold,
  alertWarn: ansis.yellow.bold,

  // Flash banner (alternating)
  flashA: ansis.bgRed.white.bold,
  flashB: ansis.bgYellow.black.bold,

  // Tab
  tabActive: ansis.bgCyan.black.bold,
  tabInactive: ansis.gray,

  // Borders
  border: ansis.gray,
  borderBright: ansis.white,

  // Vendor colors
  vendorClaude: ansis.hex('#cc785c'),
  vendorCursor: ansis.hex('#00d4aa'),
  vendorVscode: ansis.hex('#007acc'),
  vendorGemini: ansis.hex('#4285f4'),
  vendorDocker: ansis.hex('#2496ed'),
  vendorProject: ansis.yellow,
} as const;

export function statusColor(status: string): (s: string) => string {
  switch (status) {
    case 'ACTIVE': return theme.active;
    case 'RUNNING': return theme.running;
    case 'STOPPED': return theme.stopped;
    case 'ERROR': return theme.error;
    case 'UNKNOWN': return theme.unknown;
    case 'EMPTY': return theme.empty;
    default: return theme.muted;
  }
}

export function statusIcon(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'RUNNING':
      return theme.active('●');
    case 'STOPPED':
    case 'ERROR':
      return theme.stopped('●');
    case 'UNKNOWN':
      return theme.unknown('●');
    case 'EMPTY':
      return theme.empty('─');
    default:
      return theme.muted('○');
  }
}

// ─── Rainbow Text ───
// 문자마다 다른 색을 입혀 레인보우 효과. tick으로 색 오프셋이 이동하며 흐르는 애니메이션.
const RAINBOW = [
  ansis.red.bold,
  ansis.hex('#FF7F00').bold,   // orange
  ansis.yellow.bold,
  ansis.green.bold,
  ansis.cyan.bold,
  ansis.blue.bold,
  ansis.magenta.bold,
];

export function rainbowText(text: string, tick: number): string {
  let result = '';
  let colorIdx = tick % RAINBOW.length;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === ' ') {
      result += ch;
    } else {
      result += RAINBOW[colorIdx % RAINBOW.length](ch);
      colorIdx++;
    }
  }

  return result;
}

export function vendorColor(vendor: string): (s: string) => string {
  switch (vendor) {
    case 'Claude': return theme.vendorClaude;
    case 'Cursor': return theme.vendorCursor;
    case 'VS Code': return theme.vendorVscode;
    case 'Gemini': return theme.vendorGemini;
    case 'Docker': return theme.vendorDocker;
    case 'Project': return theme.vendorProject;
    default: return theme.value;
  }
}
