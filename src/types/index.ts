// ─── Transport Types ───
export type TransportType = 'stdio' | 'sse' | 'http' | 'docker' | 'gateway' | 'npx' | 'unknown';

// ─── Health Status ───
export type HealthStatus = 'ACTIVE' | 'RUNNING' | 'STOPPED' | 'ERROR' | 'UNKNOWN' | 'EMPTY';

// ─── Vendor ───
export type Vendor = 'Claude' | 'Cursor' | 'VS Code' | 'Gemini' | 'Docker' | 'Project';

// ─── Scope ───
export type ConfigScope = 'global' | 'project' | 'project.local';

// ─── MCP Server ───
export interface McpServer {
  vendor: Vendor;
  name: string;
  transport: TransportType;
  status: HealthStatus;
  detail: string;
  scope: ConfigScope;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  children?: McpServer[];       // Docker gateway 하위 서버
  pid?: number;
  responseTime?: number;        // ms
  lastChecked?: Date;
}

// ─── Skill ───
export interface Skill {
  name: string;
  source: string;               // 파일 경로 또는 lock 정보
  scope: ConfigScope;
  description?: string;
  locked: boolean;
  lastModified?: Date;
}

// ─── Hook ───
export interface HookEvent {
  type: string;                 // PreToolUse, PostToolUse, etc.
  matcher?: string;             // 도구 이름 매처
  command: string;
  scope: ConfigScope;
}

// ─── Plugin ───
export interface Plugin {
  name: string;
  version?: string;
  enabled: boolean;
  scope: ConfigScope;
  source?: string;
}

// ─── Health Check Result ───
export interface HealthResult {
  server: string;
  vendor: Vendor;
  status: HealthStatus;
  detail: string;
  responseTime?: number;
  pid?: number;
  checkedAt: Date;
}

// ─── Alert Event ───
export interface AlertEvent {
  server: string;
  vendor: Vendor;
  from: HealthStatus;
  to: HealthStatus;
  time: Date;
  message: string;
}

// ─── App State ───
export interface AppState {
  servers: McpServer[];
  skills: Skill[];
  hooks: HookEvent[];
  plugins: Plugin[];
  alerts: AlertEvent[];
  activeTab: number;
  lastRefresh: Date;
  watchedFiles: number;
  projectPath?: string;
}

// ─── Config File Paths ───
export interface ConfigPaths {
  claudeDesktop: string;
  dockerMcp: string;
  cursor: string;
  vscode: string;
  gemini: string;
  claudeCli: string;
  skills: string;
  skillLock: string;
  plugins: string;
  projectMcp?: string;
}

// ─── Tab Definition ───
export interface Tab {
  label: string;
  key: string;
}

export const TABS: Tab[] = [
  { label: 'MCP Servers', key: '1' },
  { label: 'Skills', key: '2' },
  { label: 'Hooks', key: '3' },
  { label: 'Overview', key: '4' },
];
