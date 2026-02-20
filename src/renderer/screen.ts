import {
  enterAltScreen,
  leaveAltScreen,
  cursorHome,
  cursorHide,
  cursorShow,
  clearToEnd,
} from './ansi.ts';

export class Screen {
  private entered = false;
  private lastLines: string[] = [];

  get width(): number {
    return process.stdout.columns || 80;
  }

  get height(): number {
    return process.stdout.rows || 24;
  }

  enter(): void {
    if (this.entered) return;
    process.stdout.write(enterAltScreen + cursorHide);
    this.entered = true;
  }

  leave(): void {
    if (!this.entered) return;
    process.stdout.write(cursorShow + leaveAltScreen);
    this.entered = false;
  }

  render(lines: string[]): void {
    if (!this.entered) return;

    // Trim to screen height
    const maxLines = this.height;
    const trimmed = lines.slice(0, maxLines);

    // Build output buffer
    let output = cursorHome;
    for (let i = 0; i < maxLines; i++) {
      if (i < trimmed.length) {
        output += trimmed[i];
      }
      output += clearToEnd;
      if (i < maxLines - 1) {
        output += '\n';
      }
    }

    process.stdout.write(output);
    this.lastLines = trimmed;
  }

  onResize(callback: () => void): void {
    process.stdout.on('resize', callback);
  }

  isEntered(): boolean {
    return this.entered;
  }
}
