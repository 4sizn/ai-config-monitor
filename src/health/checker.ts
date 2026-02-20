import type { McpServer, HealthResult, Vendor } from '../types/index.ts';
import { checkDockerHealth, checkDockerGateway } from './docker-health.ts';
import { checkProcessHealth } from './process-health.ts';
import { checkHttpHealth } from './http-health.ts';

type ResultCallback = (results: HealthResult[]) => void;

export class HealthChecker {
  private intervalId?: ReturnType<typeof setInterval>;
  private callbacks: ResultCallback[] = [];
  private isFirstRun = true;

  constructor(
    private servers: McpServer[],
    private intervalMs: number = 30_000,
  ) {}

  on(event: 'result', callback: ResultCallback): void {
    this.callbacks.push(callback);
  }

  private emit(results: HealthResult[]): void {
    for (const cb of this.callbacks) {
      cb(results);
    }
  }

  async start(): Promise<void> {
    // Initial check
    await this.check();
    this.isFirstRun = false;

    // Periodic check
    this.intervalId = setInterval(async () => {
      await this.check();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  updateServers(servers: McpServer[]): void {
    this.servers = servers;
  }

  private async check(): Promise<void> {
    const results: HealthResult[] = [];
    const checks: Promise<HealthResult>[] = [];

    for (const server of this.servers) {
      if (server.status === 'EMPTY') continue;

      checks.push(this.checkServer(server));

      // Check children too
      if (server.children) {
        for (const child of server.children) {
          checks.push(this.checkServer(child));
        }
      }
    }

    const settled = await Promise.allSettled(checks);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    this.emit(results);
  }

  private async checkServer(server: McpServer): Promise<HealthResult> {
    // Route to appropriate health check
    switch (server.transport) {
      case 'docker':
        return checkDockerHealth(server.name, server.vendor);
      case 'gateway':
        return checkDockerGateway(server.vendor);
      case 'http':
      case 'sse':
        if (server.url) {
          return checkHttpHealth(server.name, server.vendor, server.url);
        }
        return checkProcessHealth(server.name, server.vendor, server.command, server.args);
      case 'npx':
      case 'stdio':
        return checkProcessHealth(server.name, server.vendor, server.command, server.args);
      default:
        return {
          server: server.name,
          vendor: server.vendor,
          status: 'UNKNOWN',
          detail: 'no check available',
          checkedAt: new Date(),
        };
    }
  }
}
