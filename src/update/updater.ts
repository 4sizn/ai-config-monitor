import { APP_NAME } from '../version.ts';

const REGISTRY_URL = `https://registry.npmjs.org/${APP_NAME}`;
const INSTALL_COMMAND = ['bun', 'add', '-g', `${APP_NAME}@latest`] as const;

export interface UpdateOptions {
  check: boolean;
  force: boolean;
}

export interface UpdateOutcome {
  ok: boolean;
  exitCode: number;
  currentVersion: string;
  latestVersion?: string;
  mode: 'bun' | 'bunx';
  action: 'check' | 'updated' | 'up-to-date' | 'update-available' | 'error';
  command?: string;
  message: string;
  detail?: string;
}

interface RegistryResponse {
  'dist-tags'?: {
    latest?: string;
  };
}

export async function runUpdate(currentVersion: string, options: UpdateOptions): Promise<UpdateOutcome> {
  const mode = detectRunMode();

  if (!(await isBunAvailable())) {
    return {
      ok: false,
      exitCode: 21,
      currentVersion,
      mode,
      action: 'error',
      message: 'bun executable not found in PATH',
      detail: 'Install Bun first: https://bun.sh',
    };
  }

  let latestVersion: string;
  try {
    latestVersion = await fetchLatestVersion();
  } catch (err) {
    return {
      ok: false,
      exitCode: 20,
      currentVersion,
      mode,
      action: 'error',
      message: 'failed to fetch latest version from npm registry',
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const cmp = compareSemver(currentVersion, latestVersion);

  if (options.check) {
    return {
      ok: cmp >= 0,
      exitCode: cmp >= 0 ? 0 : 10,
      currentVersion,
      latestVersion,
      mode,
      action: 'check',
      message: cmp >= 0 ? 'already up to date' : 'update available',
      command: INSTALL_COMMAND.join(' '),
    };
  }

  if (!options.force && cmp >= 0) {
    return {
      ok: true,
      exitCode: 0,
      currentVersion,
      latestVersion,
      mode,
      action: 'up-to-date',
      message: 'already up to date',
      command: INSTALL_COMMAND.join(' '),
    };
  }

  const command = INSTALL_COMMAND.join(' ');
  const execution = await runInstallCommand();

  if (!execution.ok) {
    return {
      ok: false,
      exitCode: 22,
      currentVersion,
      latestVersion,
      mode,
      action: 'error',
      message: 'update command failed',
      command,
      detail: execution.detail,
    };
  }

  return {
    ok: true,
    exitCode: 0,
    currentVersion,
    latestVersion,
    mode,
    action: 'updated',
    message: mode === 'bunx'
      ? 'updated and installed globally (bunx -> global)'
      : 'updated globally',
    command,
  };
}

async function fetchLatestVersion(): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(REGISTRY_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`registry responded with ${res.status}`);
      }

      const data = await res.json() as RegistryResponse;
      const latest = data['dist-tags']?.latest;
      if (!latest || typeof latest !== 'string') {
        throw new Error('dist-tags.latest is missing');
      }

      return latest;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function detectRunMode(): 'bun' | 'bunx' {
  const scriptPath = process.argv[1] || '';
  if (scriptPath.includes('/.bun/install/cache/') || scriptPath.includes(`${APP_NAME}@`)) {
    return 'bunx';
  }
  return 'bun';
}

async function isBunAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['bun', '--version'], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}

async function runInstallCommand(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const proc = Bun.spawn([...INSTALL_COMMAND], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (code !== 0) {
      const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n').slice(0, 1200);
      return { ok: false, detail: detail || `exit code ${code}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);

  if (!pa || !pb) {
    return a === b ? 0 : -1;
  }

  for (let i = 0; i < 3; i++) {
    if (pa.core[i] > pb.core[i]) return 1;
    if (pa.core[i] < pb.core[i]) return -1;
  }

  if (pa.pre === pb.pre) return 0;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && !pb.pre) return -1;
  return pa.pre!.localeCompare(pb.pre!);
}

function parseSemver(raw: string): { core: [number, number, number]; pre?: string } | null {
  const normalized = raw.trim().replace(/^v/, '');
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;

  return {
    core: [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)],
    pre: match[4],
  };
}
