import { existsSync, readdirSync, statSync, lstatSync } from 'fs';
import { join, basename } from 'path';
import type { Skill } from '../types/index.ts';

export async function collectSkills(skillsDir: string, lockFilePath: string): Promise<Skill[]> {
  const skills: Skill[] = [];

  // skill-lock.json에서 잠긴 스킬 로드
  const lockedSkills = await loadLockedSkills(lockFilePath);

  // skills 디렉토리 스캔
  if (existsSync(skillsDir)) {
    try {
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        // 심볼릭 링크 또는 디렉토리 모두 스킬로 인식
        const fullPath = join(skillsDir, entry.name);
        const isDir = entry.isDirectory() || (entry.isSymbolicLink() && isDirectoryTarget(fullPath));
        if (isDir) {
          const skill = await parseSkillDir(fullPath, entry.name, lockedSkills, entry.isSymbolicLink());
          if (skill) skills.push(skill);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
          skills.push({
            name: basename(entry.name, entry.name.endsWith('.md') ? '.md' : '.json'),
            source: fullPath,
            scope: 'global',
            locked: lockedSkills.has(basename(entry.name, entry.name.endsWith('.md') ? '.md' : '.json')),
            lastModified: getModifiedDate(fullPath),
          });
        }
      }
    } catch {
      // 디렉토리 접근 실패
    }
  }

  // lock에만 있는 스킬 추가
  for (const [name, info] of lockedSkills) {
    if (!skills.find(s => s.name === name)) {
      skills.push({
        name,
        source: 'skill-lock',
        scope: 'global',
        description: info,
        locked: true,
      });
    }
  }

  return skills;
}

function isDirectoryTarget(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

async function parseSkillDir(dirPath: string, name: string, lockedSkills: Map<string, string>, isSymlink = false): Promise<Skill | null> {
  try {
    // README.md나 index 파일에서 설명 추출
    let description: string | undefined;
    const readmePath = join(dirPath, 'README.md');
    if (existsSync(readmePath)) {
      const content = await Bun.file(readmePath).text();
      const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'));
      description = firstLine?.trim().slice(0, 80);
    }

    return {
      name,
      source: dirPath,
      scope: 'global',
      description,
      locked: lockedSkills.has(name),
      lastModified: getModifiedDate(dirPath),
    };
  } catch {
    return null;
  }
}

async function loadLockedSkills(lockFilePath: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!existsSync(lockFilePath)) return map;

  try {
    const raw = await Bun.file(lockFilePath).text();
    const data = JSON.parse(raw);
    // skill-lock.json 구조: { version, skills: { name: { source, ... } }, ... }
    const skillsObj = data?.skills;
    if (typeof skillsObj === 'object' && skillsObj !== null) {
      for (const [name, info] of Object.entries(skillsObj)) {
        const i = info as Record<string, unknown>;
        const desc = i?.source ? `${i.source}` : '';
        map.set(name, desc);
      }
    }
  } catch {
    // 파싱 실패
  }
  return map;
}

function getModifiedDate(filePath: string): Date | undefined {
  try {
    return statSync(filePath).mtime;
  } catch {
    return undefined;
  }
}
