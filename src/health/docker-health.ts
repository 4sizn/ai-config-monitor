import type { HealthResult, Vendor } from '../types/index.ts';
import { isDockerRunning } from '../platform/process.ts';

// `docker mcp server list` 결과를 캐시 (여러 서버가 동일 명령을 반복 호출 방지)
let cachedMcpList: { names: Set<string>; time: number } | null = null;
const CACHE_TTL = 5_000; // 5초

async function getEnabledMcpServers(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedMcpList && now - cachedMcpList.time < CACHE_TTL) {
    return cachedMcpList.names;
  }

  const names = new Set<string>();
  try {
    const proc = Bun.spawn(['docker', 'mcp', 'server', 'list'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    if (proc.exitCode !== 0) return names;

    // 헤더: "MCP Servers (N enabled)"
    // 행:   "context7                    -              -              -              Context7..."
    const lines = output.trim().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // NAME 열로 시작하는 헤더행, 구분선, 빈줄, "MCP Servers", "Tip:" 건너뛰기
      if (!trimmed ||
          trimmed.startsWith('MCP Servers') ||
          trimmed.startsWith('NAME') ||
          trimmed.startsWith('---') ||
          trimmed.startsWith('Tip:')) {
        continue;
      }
      // 첫 번째 공백 이전이 서버 이름
      const serverName = trimmed.split(/\s+/)[0];
      if (serverName) {
        names.add(serverName);
      }
    }
  } catch {
    // docker mcp 미지원 환경
  }

  cachedMcpList = { names, time: now };
  return names;
}

export async function checkDockerHealth(serverName: string, vendor: Vendor): Promise<HealthResult> {
  const base: HealthResult = {
    server: serverName,
    vendor,
    status: 'UNKNOWN',
    detail: '',
    checkedAt: new Date(),
  };

  try {
    const dockerRunning = await isDockerRunning();
    if (!dockerRunning) {
      return { ...base, status: 'STOPPED', detail: 'Docker not running' };
    }

    // docker mcp server list에 등록되어 있으면 enabled → ACTIVE
    const enabledServers = await getEnabledMcpServers();
    if (enabledServers.has(serverName)) {
      return { ...base, status: 'ACTIVE', detail: `enabled (${enabledServers.size} total)` };
    }

    // 등록되지 않았으면 docker ps에서 컨테이너 이름으로 직접 검색
    const containerResult = await checkContainerByName(serverName, base);
    if (containerResult) return containerResult;

    return { ...base, status: 'STOPPED', detail: 'not registered' };
  } catch {
    return { ...base, status: 'ERROR', detail: 'docker check failed' };
  }
}

async function checkContainerByName(serverName: string, base: HealthResult): Promise<HealthResult | null> {
  try {
    const proc = Bun.spawn(['docker', 'ps', '--format', '{{.Names}}\t{{.Status}}\t{{.Image}}'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const filter = serverName.toLowerCase();
    for (const line of output.trim().split('\n')) {
      if (!line) continue;
      const [name, status, image] = line.split('\t');
      // 컨테이너명 또는 이미지명에서 매칭
      if ((name && name.toLowerCase().includes(filter)) ||
          (image && image.toLowerCase().includes(filter))) {
        return {
          ...base,
          status: status?.includes('Up') ? 'ACTIVE' : 'STOPPED',
          detail: status || 'container found',
        };
      }
    }
  } catch {
    // 무시
  }
  return null;
}

export async function checkDockerGateway(vendor: Vendor): Promise<HealthResult> {
  const base: HealthResult = {
    server: 'MCP_DOCKER',
    vendor,
    status: 'UNKNOWN',
    detail: '',
    checkedAt: new Date(),
  };

  try {
    const dockerRunning = await isDockerRunning();
    if (!dockerRunning) {
      return { ...base, status: 'STOPPED', detail: 'Docker not running' };
    }

    // Docker MCP Toolkit 자체의 상태: docker mcp server list가 성공하면 gateway 동작 중
    const enabledServers = await getEnabledMcpServers();
    if (enabledServers.size > 0) {
      return { ...base, status: 'ACTIVE', detail: `${enabledServers.size} servers` };
    }

    // server list가 비어있어도 docker mcp 명령 자체가 동작하면 gateway는 존재
    try {
      const proc = Bun.spawn(['docker', 'mcp', 'server', 'list'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await proc.exited;
      if (proc.exitCode === 0) {
        return { ...base, status: 'ACTIVE', detail: '0 servers' };
      }
    } catch { /* fall through */ }

    return { ...base, status: 'STOPPED', detail: 'docker mcp not available' };
  } catch {
    return { ...base, status: 'ERROR', detail: 'check failed' };
  }
}

export function invalidateCache(): void {
  cachedMcpList = null;
}
