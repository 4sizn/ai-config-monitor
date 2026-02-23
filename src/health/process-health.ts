import type { HealthResult, Vendor } from '../types/index.ts';
import { findProcesses } from '../platform/process.ts';

export async function checkProcessHealth(
  serverName: string,
  vendor: Vendor,
  command?: string,
  args?: string[],
): Promise<HealthResult> {
  const base: HealthResult = {
    server: serverName,
    vendor,
    status: 'UNKNOWN',
    detail: '',
    checkedAt: new Date(),
  };

  if (!command) return base;

  try {
    // 여러 검색어로 시도 (구체적 → 일반적 순서)
    const searchTerms = buildSearchTerms(serverName, command, args);

    for (const term of searchTerms) {
      const processes = await findProcesses(term);
      if (processes.length > 0) {
        const proc = processes[0];
        return {
          ...base,
          status: 'RUNNING',
          detail: `PID ${proc.pid}`,
          pid: proc.pid,
        };
      }
    }

    return { ...base, status: 'STOPPED', detail: 'process not found' };
  } catch {
    return { ...base, status: 'ERROR', detail: 'process check failed' };
  }
}

function buildSearchTerms(serverName: string, command: string, args?: string[]): string[] {
  const terms: string[] = [];

  if ((command === 'npx' || command === 'uvx') && args && args.length > 0) {
    // npx/uvx -y @org/package-name → 패키지 이름으로 검색
    const pkg = args.find(a => !a.startsWith('-'));
    if (pkg) {
      terms.push(pkg);
      // scoped 패키지의 경우 마지막 부분도 시도 (@org/mcp-server-xxx → mcp-server-xxx)
      if (pkg.includes('/')) {
        terms.push(pkg.split('/').pop()!);
      }
    }
  } else if (command === 'node' && args && args.length > 0) {
    terms.push(args[0]);
  } else {
    terms.push(command);
  }

  // 서버 이름 자체로도 검색 (fallback)
  if (!terms.includes(serverName)) {
    terms.push(serverName);
  }

  return terms;
}
