import { existsSync, watch, statSync } from 'fs';
import type { FSWatcher } from 'fs';

type ChangeCallback = (filePath: string) => void;

export class FileWatcher {
  private watchers: FSWatcher[] = [];
  private pollIntervals: ReturnType<typeof setInterval>[] = [];
  private callbacks: ChangeCallback[] = [];
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private lastModified = new Map<string, number>();

  constructor(
    private filePaths: string[],
    private debounceMs: number = 500,
  ) {}

  on(event: 'change', callback: ChangeCallback): void {
    this.callbacks.push(callback);
  }

  private emit(filePath: string): void {
    // Debounce
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      for (const cb of this.callbacks) {
        cb(filePath);
      }
    }, this.debounceMs);
  }

  start(): void {
    for (const filePath of this.filePaths) {
      if (!existsSync(filePath)) {
        // Start polling for file creation
        this.pollForCreation(filePath);
        continue;
      }

      this.watchFile(filePath);
    }
  }

  private watchFile(filePath: string): void {
    try {
      // Record initial mtime
      const stat = statSync(filePath);
      this.lastModified.set(filePath, stat.mtimeMs);

      const watcher = watch(filePath, { persistent: false }, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          // Verify actual change via mtime
          try {
            const newStat = statSync(filePath);
            const lastMtime = this.lastModified.get(filePath) || 0;
            if (newStat.mtimeMs > lastMtime) {
              this.lastModified.set(filePath, newStat.mtimeMs);
              this.emit(filePath);
            }
          } catch {
            // File may have been deleted
            this.emit(filePath);
          }
        }
      });
      this.watchers.push(watcher);
    } catch {
      // Fallback to polling
      this.pollFile(filePath);
    }
  }

  private pollFile(filePath: string): void {
    const interval = setInterval(() => {
      try {
        const stat = statSync(filePath);
        const lastMtime = this.lastModified.get(filePath) || 0;
        if (stat.mtimeMs > lastMtime) {
          this.lastModified.set(filePath, stat.mtimeMs);
          this.emit(filePath);
        }
      } catch {
        // File gone, ignore
      }
    }, 1_000);
    this.pollIntervals.push(interval);
  }

  private pollForCreation(filePath: string): void {
    const interval = setInterval(() => {
      if (existsSync(filePath)) {
        clearInterval(interval);
        const idx = this.pollIntervals.indexOf(interval);
        if (idx !== -1) this.pollIntervals.splice(idx, 1);
        this.watchFile(filePath);
        this.emit(filePath);
      }
    }, 2_000);
    this.pollIntervals.push(interval);
  }

  stop(): void {
    for (const w of this.watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    for (const i of this.pollIntervals) {
      clearInterval(i);
    }
    this.watchers = [];
    this.pollIntervals = [];
  }
}
