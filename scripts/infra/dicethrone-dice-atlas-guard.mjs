import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET_FILE = 'src/games/dicethrone/ui/assets.ts';
const DICE_SPRITE_RE = /public\/assets\/i18n\/[^/]+\/dicethrone\/images\/[^/]+\/compressed\/dice\.(png|webp|avif)$/i;
const EXPECTED_ATLAS = {
  cols: 3,
  rows: 3,
  faceMap: {
    1: { col: 0, row: 2 },
    2: { col: 0, row: 1 },
    3: { col: 1, row: 2 },
    4: { col: 1, row: 1 },
    5: { col: 2, row: 1 },
    6: { col: 2, row: 2 },
  },
};

function normalizeFile(file) {
  return file.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function extractDiceAtlasBlock(content) {
  const start = content.indexOf('const DICE_ATLAS');
  if (start < 0) return null;
  const slice = content.slice(start);
  const end = slice.indexOf('};');
  if (end < 0) return null;
  return slice.slice(0, end + 2);
}

function parseDiceAtlas(block) {
  const colsMatch = block.match(/\bcols\s*:\s*(\d+)/);
  const rowsMatch = block.match(/\brows\s*:\s*(\d+)/);
  const cols = colsMatch ? Number(colsMatch[1]) : NaN;
  const rows = rowsMatch ? Number(rowsMatch[1]) : NaN;
  const faceMap = {};
  const entryRe = /(\d+)\s*:\s*{\s*col\s*:\s*(\d+)\s*,\s*row\s*:\s*(\d+)\s*}/g;
  let match;
  while ((match = entryRe.exec(block)) !== null) {
    const key = Number(match[1]);
    faceMap[key] = { col: Number(match[2]), row: Number(match[3]) };
  }
  return { cols, rows, faceMap };
}

function compareFaceMap(actual, expected) {
  const errors = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (!actualValue) {
      errors.push(`缺少 faceMap[${key}]`);
      continue;
    }
    if (actualValue.col !== expectedValue.col || actualValue.row !== expectedValue.row) {
      errors.push(`faceMap[${key}] 期望 { col: ${expectedValue.col}, row: ${expectedValue.row} }，实际 { col: ${actualValue.col}, row: ${actualValue.row} }`);
    }
  }
  return errors;
}

export function runDicethroneDiceAtlasGuard(files, { repoRoot = process.cwd(), mode = 'pre-commit' } = {}) {
  if (mode !== 'pre-commit') return;
  const normalized = files.map(normalizeFile);
  const shouldRun = normalized.includes(TARGET_FILE) || normalized.some((file) => DICE_SPRITE_RE.test(file));
  if (!shouldRun) return;

  const absolutePath = path.resolve(repoRoot, TARGET_FILE);
  if (!existsSync(absolutePath)) return;
  const content = readFileSync(absolutePath, 'utf8');
  const block = extractDiceAtlasBlock(content);
  if (!block) {
    console.error('[dicethrone-dice-atlas-guard] 未找到 DICE_ATLAS 定义，请确认 assets.ts 未被意外重构。');
    process.exit(1);
  }

  const parsed = parseDiceAtlas(block);
  const errors = [];
  if (Number.isNaN(parsed.cols) || Number.isNaN(parsed.rows)) {
    errors.push('无法解析 DICE_ATLAS 的 rows/cols');
  } else {
    if (parsed.cols !== EXPECTED_ATLAS.cols) {
      errors.push(`DICE_ATLAS.cols 期望 ${EXPECTED_ATLAS.cols}，实际 ${parsed.cols}`);
    }
    if (parsed.rows !== EXPECTED_ATLAS.rows) {
      errors.push(`DICE_ATLAS.rows 期望 ${EXPECTED_ATLAS.rows}，实际 ${parsed.rows}`);
    }
  }

  errors.push(...compareFaceMap(parsed.faceMap, EXPECTED_ATLAS.faceMap));

  if (errors.length > 0) {
    console.error('[dicethrone-dice-atlas-guard] Dice sprite 采样合同校验失败：');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error('提示：DiceThrone 骰图为 3x3 网格，实际使用下两行 6 格。');
    process.exit(1);
  }

  console.log('[dicethrone-dice-atlas-guard] Dice sprite 采样合同校验通过。');
}

const isExecutedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (isExecutedDirectly) {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.length === 0) {
    console.error('[dicethrone-dice-atlas-guard] 用法: node scripts/infra/dicethrone-dice-atlas-guard.mjs <file...>');
    process.exit(1);
  }
  runDicethroneDiceAtlasGuard(args, { mode: 'pre-commit' });
}
