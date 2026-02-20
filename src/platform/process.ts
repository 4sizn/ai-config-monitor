const isWindows = process.platform === 'win32';

export interface ProcessInfo {
  pid: number;
  command: string;
}

// 프로세스 목록 캐시 (체크 사이클 내 공유)
let processCache: { entries: ProcessInfo[]; time: number } | null = null;
const PROCESS_CACHE_TTL = 3_000; // 3초 (한 체크 사이클 내에서 공유)

export async function findProcesses(nameFilter: string): Promise<ProcessInfo[]> {
  try {
    const entries = await getAllProcesses();
    const filter = nameFilter.toLowerCase();
    return entries.filter(p => p.command.toLowerCase().includes(filter));
  } catch {
    return [];
  }
}

// 프로세스 목록을 캐시하여 한 사이클 내 여러 서버가 공유
async function getAllProcesses(): Promise<ProcessInfo[]> {
  const now = Date.now();
  if (processCache && now - processCache.time < PROCESS_CACHE_TTL) {
    return processCache.entries;
  }

  const entries = isWindows
    ? await listProcessesWindows()
    : await listProcessesUnix();

  processCache = { entries, time: now };
  return entries;
}

async function listProcessesUnix(): Promise<ProcessInfo[]> {
  const proc = Bun.spawn(['ps', '-ax', '-o', 'pid,command']);
  const text = await new Response(proc.stdout).text();
  const lines = text.trim().split('\n').slice(1); // skip header
  const results: ProcessInfo[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) continue;
    const pid = parseInt(trimmed.slice(0, spaceIdx), 10);
    const command = trimmed.slice(spaceIdx + 1).trim();
    results.push({ pid, command });
  }
  return results;
}

async function listProcessesWindows(): Promise<ProcessInfo[]> {
  const proc = Bun.spawn(['tasklist', '/v', '/fo', 'csv']);
  const text = await new Response(proc.stdout).text();
  const lines = text.trim().split('\n').slice(1);
  const results: ProcessInfo[] = [];

  for (const line of lines) {
    // CSV: "Image Name","PID","Session Name",...
    const parts = line.split('","');
    if (parts.length < 2) continue;
    const name = parts[0].replace(/^"/, '');
    const pid = parseInt(parts[1], 10);
    results.push({ pid, command: name });
  }
  return results;
}

// 프로세스 캐시 무효화 (외부 호출용)
export function invalidateProcessCache(): void {
  processCache = null;
}

// docker info 결과 캐시 (5초 TTL)
let dockerRunningCache: { value: boolean; time: number } | null = null;
const DOCKER_CACHE_TTL = 5_000;

export async function isDockerRunning(): Promise<boolean> {
  const now = Date.now();
  if (dockerRunningCache && now - dockerRunningCache.time < DOCKER_CACHE_TTL) {
    return dockerRunningCache.value;
  }

  try {
    const proc = Bun.spawn(['docker', 'info'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    const value = proc.exitCode === 0;
    dockerRunningCache = { value, time: now };
    return value;
  } catch {
    dockerRunningCache = { value: false, time: now };
    return false;
  }
}
