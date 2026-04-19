import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_SCOPE_RE = /^src\/games\/[^/]+\/(ui\/|Board[^/]*\.tsx$)/;
const ALLOW_MARKER_RE = /@asset-pipeline-allow/;
const BACKGROUND_SHORTHAND_RE = /(^|[^-])\bbackground\s*:/;
const BACKGROUND_SIZE_RE = /\bbackgroundSize\s*:/;
const BACKGROUND_POSITION_RE = /\bbackgroundPosition\s*:/;

const RULES = [
  {
    id: 'new-image',
    pattern: /new\s+Image\s*\(/,
    message: '使用 new Image() 自建图片加载链路（应改用 AssetLoader/OptimizedImage/buildLocalizedImageSet）。',
  },
  {
    id: 'create-img',
    pattern: /document\.createElement\(['"]img['"]\)/,
    message: '使用 document.createElement("img") 自建图片加载链路（应改用 AssetLoader/OptimizedImage/buildLocalizedImageSet）。',
  },
  {
    id: 'blob',
    pattern: /\.blob\s*\(\s*\)/,
    message: '使用 response.blob() 加载图片（应改用 AssetLoader/OptimizedImage/buildLocalizedImageSet）。',
  },
  {
    id: 'object-url',
    pattern: /URL\.createObjectURL\s*\(/,
    message: '使用 URL.createObjectURL() 加载图片（应改用 AssetLoader/OptimizedImage/buildLocalizedImageSet）。',
  },
];

function analyzeFile(filePath, content) {
  if (!UI_SCOPE_RE.test(filePath)) return null;
  if (ALLOW_MARKER_RE.test(content)) return null;

  const hits = RULES.filter((rule) => rule.pattern.test(content));
  if (
    BACKGROUND_SHORTHAND_RE.test(content)
    && (BACKGROUND_SIZE_RE.test(content) || BACKGROUND_POSITION_RE.test(content))
  ) {
    hits.push({
      id: 'background-shorthand',
      message: '同一文件内同时使用 background 简写与 backgroundSize/backgroundPosition，可能重置裁剪参数导致精灵图空白。',
    });
  }
  if (hits.length === 0) return null;

  return {
    filePath,
    hits,
  };
}

export function runAssetPipelineGuard(files, { repoRoot = process.cwd() } = {}) {
  const targets = files.filter((file) => UI_SCOPE_RE.test(file));
  if (targets.length === 0) return;

  const violations = [];
  for (const file of targets) {
    const absolutePath = path.resolve(repoRoot, file);
    if (!existsSync(absolutePath)) continue;
    const content = readFileSync(absolutePath, 'utf8');
    const result = analyzeFile(file, content);
    if (result) violations.push(result);
  }

  console.log('\n[asset-pipeline-guard] UI 图片链路检查');
  console.log(`[asset-pipeline-guard] 扫描文件数: ${targets.length}`);

  if (violations.length === 0) {
    console.log('[asset-pipeline-guard] 未发现违禁图片加载链路。');
    return;
  }

  for (const violation of violations) {
    console.error(`[asset-pipeline-guard] ${violation.filePath}`);
    for (const hit of violation.hits) {
      console.error(`  - ${hit.message}`);
    }
    console.error('  - 如确需例外，请在文件顶部添加注释：// @asset-pipeline-allow');
  }
  process.exit(1);
}

const isExecutedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (isExecutedDirectly) {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.length === 0) {
    console.error('[asset-pipeline-guard] 用法: node scripts/infra/asset-pipeline-guard.mjs <file...>');
    process.exit(1);
  }
  runAssetPipelineGuard(args);
}
