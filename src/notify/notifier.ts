import type { AlertEvent } from '../types/index.ts';
import { bell } from '../renderer/ansi.ts';

let nodeNotifier: any;

export class Notifier {
  private lastNotifyTime = 0;
  private minInterval = 5_000; // minimum 5s between notifications

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

    // 1. Terminal bell
    process.stdout.write(bell);

    // 2. Desktop notification
    this.sendDesktopNotification(alert);
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
