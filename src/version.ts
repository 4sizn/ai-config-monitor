import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface PackageJson {
  version?: string;
}

function readVersion(): string {
  try {
    const pkg = require('../package.json') as PackageJson;
    if (typeof pkg.version === 'string' && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // no-op
  }
  return '0.0.0';
}

export const APP_NAME = 'ai-config-monitor';
export const APP_BIN = 'ai-monitor';
export const APP_VERSION = readVersion();
