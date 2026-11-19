import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 9 * 1024 * 1024; // Hard guardrail safely under 10 MB competition cap
const BYTES_PER_MB = 1024 * 1024;
const BLOCKED_MEDIA_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-server',
  'coverage',
  '.stryker-tmp',
  'reports',
  'playwright-report',
  'test-results',
  '.vercel',
  'graphify-out',
  '.hallmark',
]);

function walkTrackedOrWorkspaceFiles(rootDir) {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: rootDir,
      encoding: 'utf8',
    });
    const gitFiles = out.split('\0').filter(Boolean);
    if (gitFiles.length > 0) {
      return gitFiles.map((rel) => path.join(rootDir, rel));
    }
  } catch {
    // Fallback to directory scan before initial git init
  }

  const collected = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        collected.push(fullPath);
      }
    }
  }
  return collected;
}

const rootDir = process.cwd();
const files = walkTrackedOrWorkspaceFiles(rootDir);
let totalBytes = 0;

for (const filePath of files) {
  if (!fs.existsSync(filePath)) continue;
  const ext = path.extname(filePath).toLowerCase();
  if (BLOCKED_MEDIA_EXTENSIONS.has(ext)) {
    console.error(`Blocked binary video/media asset detected in repository: ${filePath}`);
    process.exit(1);
  }
  totalBytes += fs.statSync(filePath).size;
}

const totalMb = (totalBytes / BYTES_PER_MB).toFixed(2);
if (totalBytes > MAX_BYTES) {
  console.error(`Repository size ${totalMb} MB exceeds safety ceiling of 9.00 MB.`);
  process.exit(1);
}

console.warn(`Repo size verified: ${files.length} files, ${totalMb} MB (limit < 10 MB).`);

