import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const files = [];
let baseRef = process.env.QUALITY_GATE_BASE || 'HEAD';
let scanAll = false;
let includeUntracked = true;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--base') {
    baseRef = args[i + 1] || baseRef;
    i += 1;
    continue;
  }
  if (arg === '--all') {
    scanAll = true;
    continue;
  }
  if (arg === '--include-untracked') {
    includeUntracked = true;
    continue;
  }
  files.push(arg);
}

function runGit(gitArgs, options = {}) {
  try {
    return execFileSync('git', gitArgs, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.silent ? 'ignore' : 'pipe'],
    }).trim();
  } catch (error) {
    if (options.allowFail) return '';
    throw error;
  }
}

function normalizeFile(file) {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectDefaultFiles() {
  if (scanAll) {
    return runGit(['ls-files'], { allowFail: true, silent: true }).split(/\r?\n/);
  }

  return [
    ...runGit(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`], { allowFail: true, silent: true }).split(/\r?\n/),
    ...runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { allowFail: true, silent: true }).split(/\r?\n/),
    ...runGit(['diff', '--name-only', '--diff-filter=ACMR'], { allowFail: true, silent: true }).split(/\r?\n/),
    ...(includeUntracked
      ? runGit(['ls-files', '--others', '--exclude-standard'], { allowFail: true, silent: true }).split(/\r?\n/)
      : []),
  ];
}

function existsAtRef(ref, file) {
  const normalized = normalizeFile(file);
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${normalized}`], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function getNumstat(file) {
  const output = runGit(['diff', '--numstat', baseRef, '--', file], { allowFail: true, silent: true });
  const line = output.split(/\r?\n/).find(Boolean);
  if (!line) return { added: 0, deleted: 0 };
  const [addedRaw, deletedRaw] = line.split(/\s+/);
  return {
    added: Number.parseInt(addedRaw, 10) || 0,
    deleted: Number.parseInt(deletedRaw, 10) || 0,
  };
}

function isTestFile(file) {
  return /\.(test|spec)\.[tj]sx?$/.test(file);
}

function isGameVitestTest(file) {
  return /^src\/games\/[^/]+\/__tests__\/.+\.(test|spec)\.[tj]sx?$/.test(file);
}

function isE2eGameMirrorTest(file) {
  return /^e2e\/src\/games\/[^/]+\/__tests__\/.+\.(test|spec)\.[tj]sx?$/.test(file);
}

function getE2eMirrorSourcePath(file) {
  if (!file.startsWith('e2e/src/')) return null;
  return file.replace(/^e2e\/src\//, 'src/');
}

function isSamePhysicalFile(fileA, fileB) {
  try {
    return fs.realpathSync.native(path.join(repoRoot, fileA)) === fs.realpathSync.native(path.join(repoRoot, fileB));
  } catch {
    return false;
  }
}

function isGenericSinkName(file) {
  const baseName = path.basename(file).toLowerCase();
  if (/^new.+\.(test|spec)\.[tj]sx?$/.test(baseName)) return true;
  return /(^|[-_.])(misc|regression|regressions|feedback|fix|fixes)([-_.]|$)/.test(baseName);
}

function isInteractionContractTest(file) {
  const normalized = normalizeFile(file).toLowerCase();
  const baseName = path.basename(normalized);
  return (
    normalized.includes('/interaction') ||
    baseName.includes('interaction') ||
    baseName.includes('response-window') ||
    baseName.includes('afterscoring-window') ||
    baseName.includes('system-contract')
  );
}

const forbiddenPromptCouplingPatterns = [
  {
    pattern: /\bgetInteractionsFromMS\s*\(/,
    message: '业务测试不要直接枚举 sys.interaction；请通过 getSimpleChoicePrompt/getReactionPrompt/expectNoPrompt 等 facade 表达行为。',
  },
  {
    pattern: /\.data\.options\b/,
    message: '业务测试不要直读 prompt.data.options；请通过 getPromptOption/getPromptOptions 选择候选。',
  },
  {
    pattern: /\.data\??\.sourceId\b/,
    message: '业务测试不要直读 prompt.data.sourceId；请通过 getSimpleChoicePrompt(expectedSourceId) 或 getPromptSourceId。',
  },
  {
    pattern: /\bSYS_INTERACTION_RESPOND\b/,
    message: '业务测试不要手写 SYS_INTERACTION_RESPOND；请通过 respondToPrompt/respondToPromptOptions。',
  },
  {
    pattern: /\bSYS_INTERACTION_CANCEL\b/,
    message: '业务测试不要手写 SYS_INTERACTION_CANCEL；请通过 cancelPrompt。',
  },
  {
    pattern: /\bsys\.interaction\.current\b/,
    message: '业务测试不要直读 sys.interaction.current；请通过 prompt facade。',
  },
];

const forbiddenSkippedTestPattern = /\b(?:it|test|describe)\.skip\s*\(/;

function addedLinesSinceBase(file, existedAtBase) {
  if (!existedAtBase && fs.existsSync(path.join(repoRoot, file))) {
    return fs.readFileSync(path.join(repoRoot, file), 'utf8').split(/\r?\n/);
  }

  const output = runGit(['diff', '--unified=0', baseRef, '--', file], { allowFail: true, silent: true });
  return output
    .split(/\r?\n/)
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1));
}

function checkSkippedTestUsage(file, existedAtBase) {
  if (!isGameVitestTest(file)) {
    return;
  }

  const lines = addedLinesSinceBase(file, existedAtBase);
  for (const [index, line] of lines.entries()) {
    if (forbiddenSkippedTestPattern.test(line)) {
      violations.push(`${file}: 新增或迁出的游戏行为测试不得使用 it.skip/test.skip/describe.skip（added line ${index + 1}）。请修成可运行行为测试；若只是历史债务，不要迁成新聚焦用例。`);
    }
  }
}

function checkPromptFacadeCoupling(file, existedAtBase) {
  if (!isGameVitestTest(file) || isInteractionContractTest(file)) {
    return;
  }

  if (existedAtBase && isGenericSinkName(file)) {
    const { added, deleted } = getNumstat(file);
    if (added <= deleted) {
      warnings.push(`${file}: 旧泛名测试文件仍含 prompt 内部耦合债务；本次净删减，暂不阻断，后续迁出时必须改走 facade。`);
      return;
    }
  }

  const lines = addedLinesSinceBase(file, existedAtBase);
  for (const [index, line] of lines.entries()) {
    for (const rule of forbiddenPromptCouplingPatterns) {
      if (rule.pattern.test(line)) {
        violations.push(`${file}: 新增测试行继续耦合 InteractionSystem 内部结构（added line ${index + 1}）。${rule.message}`);
      }
    }
  }
}

const targetFiles = unique((files.length > 0 ? files : collectDefaultFiles()).map(normalizeFile))
  .filter(file => isTestFile(file) || file.startsWith('e2e/src/games/'));

const violations = [];
const warnings = [];

for (const file of targetFiles) {
  const existedAtBase = existsAtRef(baseRef, file);
  const isNew = !existedAtBase;

  checkSkippedTestUsage(file, existedAtBase);
  checkPromptFacadeCoupling(file, existedAtBase);

  if (isE2eGameMirrorTest(file)) {
    const sourcePath = getE2eMirrorSourcePath(file);
    if (sourcePath && isSamePhysicalFile(file, sourcePath)) {
      warnings.push(`${file}: e2e/src 是 src 的 Junction 镜像；按 ${sourcePath} 的同一物理文件处理，不作为独立新增测试来源。`);
      continue;
    }
    if (isNew) {
      violations.push(`${file}: 禁止新增 e2e/src/games 镜像 Vitest 测试；新增游戏行为测试应落到 src/games/**/__tests__。`);
    } else {
      warnings.push(`${file}: 触碰了历史镜像测试目录，只能按兼容债务处理，不得作为新增测试来源。`);
    }
    continue;
  }

  if (!isGameVitestTest(file) || !isGenericSinkName(file)) {
    continue;
  }

  if (isNew) {
    violations.push(`${file}: 禁止新增 new*/misc/regression/feedback/fixes 等泛名测试文件；请按行为簇命名。`);
    continue;
  }

  const { added, deleted } = getNumstat(file);
  if (added > deleted) {
    violations.push(`${file}: 旧泛名测试文件出现净新增内容（+${added}/-${deleted}）；应迁到聚焦测试文件。`);
  } else {
    warnings.push(`${file}: 旧泛名测试文件仍是债务；本次没有净新增内容，可继续收敛。`);
  }
}

if (warnings.length > 0) {
  console.warn('[test-structure-guard] 警告:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (violations.length > 0) {
  console.error('[test-structure-guard] 测试结构门禁失败:');
  for (const violation of violations) console.error(`- ${violation}`);
  if (process.env.ALLOW_TEST_STRUCTURE_DEBT === '1') {
    console.warn('[test-structure-guard] ALLOW_TEST_STRUCTURE_DEBT=1 已设置，本次仅警告不失败。');
  } else {
    process.exit(1);
  }
}

console.log(`[test-structure-guard] checked files: ${targetFiles.length}`);
console.log('[test-structure-guard] OK');
