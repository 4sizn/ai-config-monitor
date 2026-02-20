import type { AlertEvent, HealthStatus } from '../types/index.ts';
import { bell } from '../renderer/ansi.ts';

let nodeNotifier: any;

// 알림 패턴: [delay_ms, ...] — 각 delay 후 벨 울림
const ALERT_PATTERNS = {
  // ERROR: 빠른 삐용삐용삐용 (긴급)
  urgent: [0, 200, 200, 400, 200, 200],
  // STOPPED: 삐용삐용 (경고)
  warning: [0, 300, 300],
  // 단순 벨
  info: [0],
} as const;

type AlertLevel = keyof typeof ALERT_PATTERNS;

export class Notifier {
  private lastNotifyTime = 0;
  private minInterval = 5_000; // minimum 5s between notifications
  private activeTimers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    // Lazy-load node-notifier
    this.loadNotifier();
  }

  private async loadNotifier(): Promise<void> {
    try {
      nodeNotifier = await import('node-notifier');
    } catch {
      // node-notifier not available
    }
  }

  notify(alert: AlertEvent): void {
    const now = Date.now();
    if (now - this.lastNotifyTime < this.minInterval) return;
    this.lastNotifyTime = now;

    // 1. Terminal bell pattern (삐용삐용)
    const level = this.getAlertLevel(alert.to);
    this.playBellPattern(level);

    // 2. Desktop notification
    this.sendDesktopNotification(alert);
  }

  stop(): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers = [];
  }

  private getAlertLevel(status: HealthStatus): AlertLevel {
    if (status === 'ERROR') return 'urgent';
    if (status === 'STOPPED') return 'warning';
    return 'info';
  }

  private playBellPattern(level: AlertLevel): void {
    // 이전 패턴이 재생 중이면 중단
    this.stop();

    const pattern = ALERT_PATTERNS[level];
    let elapsed = 0;

    for (const delay of pattern) {
      elapsed += delay;
      const timer = setTimeout(() => {
        process.stdout.write(bell);
      }, elapsed);
      this.activeTimers.push(timer);
    }
  }

  private sendDesktopNotification(alert: AlertEvent): void {
    if (!nodeNotifier) return;

    try {
      const notifier = nodeNotifier.default || nodeNotifier;
      const notifyFn = (notifier as { notify?: Function }).notify;
      if (typeof notifyFn === 'function') {
        notifyFn.call(notifier, {
          title: 'AI Config Monitor',
          message: alert.message,
          sound: false,
          timeout: 5,
        });
      }
    } catch {
      // Notification failed, not critical
    }
  }
}
