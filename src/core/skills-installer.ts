import fs from 'fs';
import os from 'os';
import path from 'path';

export const BUNDLED_SKILLS = [
  'kindle-for-agents',
  'kindle-setup',
  'send-to-kindle',
  'kindle-bridge'
] as const;

export type BundledSkillName = (typeof BUNDLED_SKILLS)[number];

export interface InstallBundledSkillsOptions {
  homeDir?: string;
  sourceRoot?: string;
  extraTargets?: string[];
}

export interface InstallBundledSkillsResult {
  installedRoots: string[];
  skills: string[];
  backups: string[];
}

function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function pathExists(targetPath: string): boolean {
  try {
    fs.lstatSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function formatBackupTimestamp(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function deriveHostLabel(targetRoot: string, resolvedHome: string): string {
  const agentsRoot = path.join(resolvedHome, '.agents', 'skills');
  const claudeRoot = path.join(resolvedHome, '.claude', 'skills');
  const geminiRoot = path.join(resolvedHome, '.gemini', 'config', 'skills');

  if (targetRoot === agentsRoot) {
    return 'agents';
  }
  if (targetRoot === claudeRoot) {
    return 'claude';
  }
  if (targetRoot === geminiRoot) {
    return 'gemini';
  }

  const baseName = path.basename(targetRoot);
  const rawLabel =
    baseName === 'skills' ? path.basename(path.dirname(targetRoot)) : baseName;
  const sanitized = rawLabel
    .replace(/^\.+/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-');
  return sanitized.length > 0 ? sanitized : 'custom';
}

function moveToBackup(sourcePath: string, backupPath: string): void {
  try {
    fs.renameSync(sourcePath, backupPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EXDEV') {
      throw error;
    }
    fs.cpSync(sourcePath, backupPath, { recursive: true });
    fs.rmSync(sourcePath, { recursive: true, force: true });
  }
}

function createUniqueBackupPath(
  backupBaseDir: string,
  hostLabel: string,
  skillName: string,
  timestamp: string
): string {
  const basePath = path.join(
    backupBaseDir,
    `${hostLabel}-${skillName}-${timestamp}`
  );
  if (!pathExists(basePath)) {
    return basePath;
  }
  let suffix = 2;
  while (pathExists(`${basePath}-${suffix}`)) {
    suffix += 1;
  }
  return `${basePath}-${suffix}`;
}

export function resolveSkillsSourceDir(): string {
  const candidate = path.resolve(__dirname, '../../skills');
  if (!isDirectory(candidate)) {
    throw new Error(`Bundled skills directory not found: ${candidate}`);
  }
  return candidate;
}

export function detectTargetSkillRoots(
  homeDir: string = os.homedir(),
  extraTargets: string[] = []
): string[] {
  const resolvedHome = path.resolve(homeDir);
  const candidates: string[] = [path.join(resolvedHome, '.agents', 'skills')];

  if (isDirectory(path.join(resolvedHome, '.claude'))) {
    candidates.push(path.join(resolvedHome, '.claude', 'skills'));
  }

  if (
    isDirectory(path.join(resolvedHome, '.gemini', 'config')) ||
    isDirectory(path.join(resolvedHome, '.gemini', 'antigravity'))
  ) {
    candidates.push(path.join(resolvedHome, '.gemini', 'config', 'skills'));
  }

  for (const extraTarget of extraTargets) {
    const trimmed = extraTarget.trim();
    if (trimmed.length > 0) {
      candidates.push(path.resolve(trimmed));
    }
  }

  return Array.from(new Set(candidates));
}

export function installBundledSkills(
  options: InstallBundledSkillsOptions = {}
): InstallBundledSkillsResult {
  const resolvedHome = path.resolve(options.homeDir ?? os.homedir());
  const resolvedSourceRoot = path.resolve(
    options.sourceRoot ?? resolveSkillsSourceDir()
  );
  if (!isDirectory(resolvedSourceRoot)) {
    throw new Error(`Skills source directory not found: ${resolvedSourceRoot}`);
  }

  const targetRoots = detectTargetSkillRoots(
    resolvedHome,
    options.extraTargets ?? []
  );
  const backupBaseDir = path.join(
    resolvedHome,
    '.agents',
    'skill-backups',
    'kindle-for-agents'
  );
  const timestamp = formatBackupTimestamp();
  const backups: string[] = [];

  for (const skillName of BUNDLED_SKILLS) {
    const skillSource = path.join(resolvedSourceRoot, skillName);
    if (!isDirectory(skillSource)) {
      throw new Error(`Bundled skill directory not found: ${skillSource}`);
    }
  }

  for (const targetRoot of targetRoots) {
    fs.mkdirSync(targetRoot, { recursive: true });
    const hostLabel = deriveHostLabel(targetRoot, resolvedHome);

    for (const skillName of BUNDLED_SKILLS) {
      const source = path.join(resolvedSourceRoot, skillName);
      const destination = path.join(targetRoot, skillName);

      if (pathExists(destination)) {
        fs.mkdirSync(backupBaseDir, { recursive: true });
        const backupPath = createUniqueBackupPath(
          backupBaseDir,
          hostLabel,
          skillName,
          timestamp
        );
        moveToBackup(destination, backupPath);
        backups.push(backupPath);
      }

      fs.cpSync(source, destination, { recursive: true });
    }
  }

  return {
    installedRoots: targetRoots,
    skills: [...BUNDLED_SKILLS],
    backups
  };
}
