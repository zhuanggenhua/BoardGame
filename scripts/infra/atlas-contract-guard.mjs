import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_SCOPE_RE = /^src\/games\/[^/]+\/(ui\/|Board[^/]*\.tsx$|ui\/assets\.ts$)/;
const ATLAS_DEF_RE = /const\s+\w*ATLAS[\s\S]*?cols\s*:\s*\d+[\s\S]*?rows\s*:\s*\d+/;
const CONTRACT_RE = /@atlas-contract/;

function normalizeFile(file) {
  return file.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function shouldCheckFile(file, content) {
  if (!UI_SCOPE_RE.test(file)) return false;
  return ATLAS_DEF_RE.test(content);
}

export function runAtlasContractGuard(files, { repoRoot = process.cwd() } = {}) {
  const targets = files
    .map(normalizeFile)
    .filter((file) => UI_SCOPE_RE.test(file));
  if (targets.length === 0) return;

  const violations = [];
  for (const file of targets) {
    const absolutePath = path.resolve(repoRoot, file);
    if (!existsSync(absolutePath)) continue;
    const content = readFileSync(absolutePath, 'utf8');
    if (!shouldCheckFile(file, content)) continue;
    if (CONTRACT_RE.test(content)) continue;
    violations.push(file);
  }

  console.log('\n[atlas-contract-guard] 图集裁剪合同检查');
  console.log(`[atlas-contract-guard] 扫描文件数: ${targets.length}`);

  if (violations.length === 0) {
    console.log('[atlas-contract-guard] 未发现缺失裁剪合同的图集定义。');
    return;
  }

  for (const file of violations) {
    console.error(`[atlas-contract-guard] ${file}`);
    console.error('  - 图集定义缺少 @atlas-contract 注释（需先看图并写明采样依据）。');
  }
  process.exit(1);
}

const isExecutedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (isExecutedDirectly) {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.length === 0) {
    console.error('[atlas-contract-guard] 用法: node scripts/infra/atlas-contract-guard.mjs <file...>');
    process.exit(1);
  }
  runAtlasContractGuard(args);
}
