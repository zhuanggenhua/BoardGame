#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const scanEntries = [
  '.env.example',
  '.github/workflows',
  'apps/api/src/modules/admin',
  'apps/api/test/admin-mobile-release.service.test.ts',
  'package.json',
  'scripts',
];

const ignoredDirs = new Set([
  '.git',
  '.worktrees',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'temp',
  'test-results',
]);

const ignoredFiles = new Set([
  'scripts/audit/assert-no-r2-runtime.mjs',
]);

const textExtensions = new Set([
  '',
  '.cjs',
  '.js',
  '.json',
  '.mjs',
  '.md',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const forbiddenPatterns = [
  ['R2 account env', /R2_ACCOUNT(?:_ID)?/],
  ['R2 access key env', /R2_ACCESS(?:_KEY_ID)?/],
  ['R2 secret env', /R2_SECRET(?:_ACCESS_KEY)?/],
  ['R2 bucket env', /R2_BUCKET(?:_NAME)?/],
  ['R2 object storage endpoint', /r2\.cloudflarestorage\.com/i],
  ['legacy R2 upload script', /upload-to-r2/i],
  ['legacy R2 download script', /download-from-r2/i],
  ['legacy R2 cleanup script', /cleanup-r2/i],
  ['R2 backup queue flag', /backupToR2/],
  ['Worker R2 binding variable', /ASSETS_BUCKET/],
  ['Wrangler R2 binding config', /r2_buckets/],
];

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function toRelative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, '/');
}

function shouldScanFile(filePath) {
  const relativePath = toRelative(filePath);
  if (ignoredFiles.has(relativePath)) {
    return false;
  }
  return textExtensions.has(path.extname(filePath));
}

async function collectFiles(entryPath, files) {
  const relativePath = toRelative(entryPath);
  const name = path.basename(entryPath);
  if (ignoredDirs.has(name) || ignoredFiles.has(relativePath)) {
    return;
  }

  const entryStat = await stat(entryPath);
  if (entryStat.isDirectory()) {
    const children = await readdir(entryPath);
    for (const child of children) {
      await collectFiles(path.join(entryPath, child), files);
    }
    return;
  }

  if (entryStat.isFile() && shouldScanFile(entryPath)) {
    files.push(entryPath);
  }
}

const files = [];
for (const entry of scanEntries) {
  const absolutePath = path.join(rootDir, entry);
  if (await pathExists(absolutePath)) {
    await collectFiles(absolutePath, files);
  }
}

const findings = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    for (const [label, pattern] of forbiddenPatterns) {
      if (pattern.test(line)) {
        findings.push({
          file: toRelative(file),
          line: lineIndex + 1,
          label,
          text: line.trim(),
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('发现仍可能触发 R2 的运行入口或配置：');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.label}: ${finding.text}`);
  }
  process.exit(1);
}

console.log(`R2 运行入口审计通过：扫描 ${files.length} 个活跃配置/脚本/发布文件，未发现 R2 运行依赖。`);
