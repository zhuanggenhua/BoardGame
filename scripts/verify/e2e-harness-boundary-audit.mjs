import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2).filter(Boolean);
const allFiles = args.includes('--all');
const requestedFiles = args.filter((arg) => arg !== '--all');

function collectE2eFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...collectE2eFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith('.e2e.ts')) result.push(absolute);
  }
  return result;
}

const files = allFiles
  ? collectE2eFiles(path.join(repoRoot, 'e2e'))
  : requestedFiles.map((file) => path.resolve(repoRoot, file));

if (files.length === 0) {
  console.error('[e2e-harness-boundary] 未指定 E2E 文件；请传入文件路径或 --all。');
  process.exit(2);
}

const violations = [];
for (const file of files) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    violations.push(`${file}: 文件不存在`);
    continue;
  }
  const source = readFileSync(file, 'utf8');
  const header = source.match(/e2e-harness-boundary:\s*([a-z-]+)/i)?.[1]?.toLowerCase() ?? '';
  const relative = path.relative(repoRoot, file).replaceAll('\\', '/');
  const lines = source.split(/\r?\n/);

  const reportPattern = (pattern, message) => {
    lines.forEach((line, index) => {
      if (pattern.test(line)) violations.push(`${relative}:${index + 1}: ${message}`);
    });
  };

  if (header === 'natural-flow' && /dispatchHarnessCommand|command\.dispatch\s*\(/.test(source)) {
    reportPattern(/dispatchHarnessCommand|command\.dispatch\s*\(/, '黄金链禁止 dispatcher / 内部命令直发；改为真实页面动作');
  }

  const hasInjection = /\binject(?:Core|MatchState|State)\s*\(/.test(source) || /state\s*\.set\s*\(/.test(source);
  if (hasInjection && !header) {
    violations.push(`${relative}: 含状态注入但缺少 e2e-harness-boundary 分类注释`);
  }

  if (header === 'natural-flow' && hasInjection) {
    reportPattern(/\binject(?:Core|MatchState|State)\s*\(|state\s*\.set\s*\(/, 'natural-flow golden 禁止状态注入');
  }

  if (header === 'state-injected-composite' && hasInjection
      && !/assertReadyForStateInjection|settleDiscoveryForStateInjection|injectAfterSettlement|assert.*InjectionBoundary/i.test(source)) {
    violations.push(`${relative}: state-injected-composite 必须包含注入前结算边界断言`);
  }
}

if (violations.length > 0) {
  console.error('[e2e-harness-boundary] FAIL');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`[e2e-harness-boundary] OK (${files.length} file${files.length === 1 ? '' : 's'})`);
