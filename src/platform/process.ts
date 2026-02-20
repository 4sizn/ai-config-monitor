const isWindows = process.platform === 'win32';

export interface ProcessInfo {
  pid: number;
  command: string;
}

export async function findProcesses(nameFilter: string): Promise<ProcessInfo[]> {
  try {
    if (isWindows) {
      return await findProcessesWindows(nameFilter);
    }
    return await findProcessesUnix(nameFilter);
  } catch {
    return [];
  }
}

async function findProcessesUnix(nameFilter: string): Promise<ProcessInfo[]> {
  const proc = Bun.spawn(['ps', '-ax', '-o', 'pid,command']);
  const text = await new Response(proc.stdout).text();
  const lines = text.trim().split('\n').slice(1); // skip header
  const results: ProcessInfo[] = [];
  const filter = nameFilter.toLowerCase();

  for (const line of lines) {
    const trimmed = line.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx === -1) continue;
    const pid = parseInt(trimmed.slice(0, spaceIdx), 10);
    const command = trimmed.slice(spaceIdx + 1).trim();
    if (command.toLowerCase().includes(filter)) {
      results.push({ pid, command });
    }
  }
  return results;
}

async function findProcessesWindows(nameFilter: string): Promise<ProcessInfo[]> {
  const proc = Bun.spawn(['tasklist', '/v', '/fo', 'csv']);
  const text = await new Response(proc.stdout).text();
  const lines = text.trim().split('\n').slice(1);
  const results: ProcessInfo[] = [];
  const filter = nameFilter.toLowerCase();

  for (const line of lines) {
    // CSV: "Image Name","PID","Session Name",...
    const parts = line.split('","');
    if (parts.length < 2) continue;
    const name = parts[0].replace(/^"/, '');
    const pid = parseInt(parts[1], 10);
    if (name.toLowerCase().includes(filter)) {
      results.push({ pid, command: name });
    }
  }
  return results;
}

// docker info 결과 캐시 (10초 TTL)
let dockerRunningCache: { value: boolean; time: number } | null = null;
const DOCKER_CACHE_TTL = 10_000;

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
