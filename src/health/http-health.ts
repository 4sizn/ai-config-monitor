import type { HealthResult, Vendor } from '../types/index.ts';

const TIMEOUT_MS = 2_000;

export async function checkHttpHealth(
  serverName: string,
  vendor: Vendor,
  url: string,
): Promise<HealthResult> {
  const base: HealthResult = {
    server: serverName,
    vendor,
    status: 'UNKNOWN',
    detail: '',
    checkedAt: new Date(),
  };

  if (!url) return base;

  try {
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    if (response.ok || response.status < 500) {
      return {
        ...base,
        status: 'ACTIVE',
        detail: `${elapsed}ms`,
        responseTime: elapsed,
      };
    }

    return {
      ...base,
      status: 'ERROR',
      detail: `HTTP ${response.status}`,
      responseTime: elapsed,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ...base, status: 'ERROR', detail: 'timeout (2s)' };
    }
    return { ...base, status: 'STOPPED', detail: 'connection refused' };
  }
}
