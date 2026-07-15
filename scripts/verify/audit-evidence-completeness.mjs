#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const REQUIRED_AUDIT_SECTIONS = [
  {
    name: '审计范围',
    patterns: [/##\s+.*审计范围/, /##\s+本轮范围/, /本轮覆盖/],
  },
  {
    name: '结论等级',
    patterns: [/结论等级[:：]/, /##\s+.*结论等级/],
  },
  {
    name: '权威来源',
    patterns: [/##\s+.*权威来源/, /主真相源[:：]/, /真相源[:：]/],
  },
  {
    name: '逐项结论',
    patterns: [/##\s+.*逐项结论/, /##\s+.*对象全集/, /##\s+.*规则子句表/, /完整技能流程矩阵/],
  },
  {
    name: '验证证据',
    patterns: [/##\s+.*验证证据/, /##\s+.*测试结果/, /L2\s+领域行为证据/, /真实入口\s+E2E/],
  },
  {
    name: '共享根因与残余范围',
    patterns: [/##\s+.*共享根因/, /##\s+.*残余范围/, /残余范围[:：]/, /L4\s+治理证据/],
  },
  {
    name: '修订或失效记录',
    patterns: [/##\s+.*修订/, /##\s+.*失效/, /旧结论/, /旧 evidence/, /旧文档/],
  },
];

const FULL_AUDIT_CLAIMS = [
  /当前发布口径已收口/,
  /当前代码验证口径已收口/,
  /全面审计完成/,
  /(?<!未)已审计/,
  /已审计完成/,
  /(?<!未)已收口/,
  /对象级审计已收口/,
  /对象级审计已按当前发布口径收口/,
  /full_audit_e2e_verified/,
  /full_audit/,
];

const AUDIT_WORDS = [
  /结论等级[:：]/,
  /仍有残余范围/,
  /已审计/,
  /收口审计/,
  /全面审计/,
  /深入审计/,
  /重审证据/,
  /audit/i,
];

const INVALIDATION_MARKERS = [
  /结论等级[:：]\s*旧结论失效/,
  /批次状态[:：].*superseded/,
  /旧结论失效/,
];

const HIGH_RISK_TERMS = [
  /阶段结束/,
  /魔力阶段/,
  /移动阶段/,
  /攻击阶段/,
  /死亡/,
  /消灭/,
  /替换/,
  /额外攻击/,
  /触发队列/,
  /triggerQueue/,
  /reaction session/i,
  /deferred/i,
  /finalize/i,
  /然后/,
  /之后/,
];

const IMAGE_CONTRACT_TERMS = [
  /卡图/,
  /图集/,
  /cards\.jpg/,
  /玩家板/,
  /棋盘/,
  /裁片/,
  /slot/i,
];

const IMAGE_CONTRACT_EVIDENCE = [
  /完整单卡/,
  /单卡主裁图/,
  /裁图清单/,
  /crop manifest/i,
  /data-entry-crop-manifest/i,
  /SHA256/i,
  /图片合同表/,
];

const UNRESOLVED_COMPLETION_MARKERS = [
  /待补/,
  /pending/i,
  /needs_l3_l4/i,
  /仍未收口/,
  /尚未跑/,
  /还未跑/,
  /未跑出/,
  /不能支撑.*收口/,
  /不支撑.*收口/,
  /不能宣称/,
];

const SELF_CHECK_HEADING_PATTERN = /^##\s+.*全面审计自检表.*$/m;

const SELF_CHECK_REQUIRED_ITEMS = [
  {
    name: '对象全集',
    patterns: [/对象全集/, /录入对象全集/, /批次矩阵/, /当前范围内每个对象/],
  },
  {
    name: '规则子句表',
    patterns: [/规则子句表/, /规则子句/, /原子子句/, /C\d+/],
  },
  {
    name: '完整技能流程矩阵',
    patterns: [/完整技能流程矩阵/, /完整流程/, /触发前条件/, /后续清理/, /执行入口/],
  },
  {
    name: 'L0-L4 证据层级',
    patterns: [/L0.*L1.*L2.*L3.*L4/s, /L0\/L1\/L2\/L3\/L4/, /L0-L4/],
  },
  {
    name: '命中 D 维度',
    patterns: [/命中\s*D\s*维度/, /D\s*维度/, /D\d+/],
  },
  {
    name: '真实入口 E2E 与截图核验',
    patterns: [/真实入口.*E2E/s, /E2E.*真实入口/s, /截图核验/, /真实玩法证据/],
  },
  {
    name: '残余范围声明',
    patterns: [/残余范围/, /未覆盖范围/, /当前边界/, /生产部署/],
  },
  {
    name: '旧 evidence / 旧结论对账回写',
    patterns: [/旧\s*evidence/i, /旧结论/, /旧文档/, /失效回写/, /旧结论失效/],
  },
];

function printUsage() {
  console.log(`用法:
  node scripts/verify/audit-evidence-completeness.mjs [evidence 文件...]
  node scripts/verify/audit-evidence-completeness.mjs --all
  node scripts/verify/audit-evidence-completeness.mjs --files-from <file>

说明:
  - 默认只检查已跟踪或已暂存变更中的 evidence/*.md 文档，避免无关未跟踪草稿阻塞。
  - 未跟踪新 evidence 请显式传文件路径，或加 --include-untracked。
  - 只要文档对外声称“已审计 / 已收口 / 全面审计完成”，就必须具备完整 evidence 结构。
  - 若文档已明确降级为“旧结论失效”，则检查失效记录是否完整，而不是继续要求旧收口证据成立。
`);
}

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const stderr = error.stderr?.toString?.().trim?.() ?? String(error);
    throw new Error(`git ${args.join(' ')} 失败: ${stderr}`);
  }
}

function normalizeFile(file) {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(normalizeFile(path.relative(repoRoot, fullPath)));
    }
  }
  return results;
}

function collectChangedEvidenceFiles({ includeUntracked }) {
  const files = [
    ...runGit(['diff', '--name-only', '--diff-filter=ACMR'], { allowFailure: true }).split(/\r?\n/),
    ...runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { allowFailure: true }).split(/\r?\n/),
  ];
  if (includeUntracked) {
    files.push(...runGit(['ls-files', '--others', '--exclude-standard'], { allowFailure: true }).split(/\r?\n/));
  }
  return unique(files.map(normalizeFile)).filter(isEvidenceMarkdown);
}

function parseArgs(argv) {
  const parsed = {
    files: [],
    all: false,
    includeUntracked: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--all') {
      parsed.all = true;
      continue;
    }
    if (arg === '--include-untracked') {
      parsed.includeUntracked = true;
      continue;
    }
    if (arg === '--files-from') {
      const listPath = argv[index + 1];
      if (!listPath) {
        throw new Error('--files-from 缺少文件路径');
      }
      parsed.files.push(
        ...readFileSync(path.resolve(listPath), 'utf8')
          .split(/\r?\n/)
          .map(value => value.trim())
          .filter(Boolean),
      );
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`未知参数: ${arg}`);
    }
    parsed.files.push(arg);
  }

  return parsed;
}

function isEvidenceMarkdown(file) {
  const normalized = normalizeFile(file);
  return normalized.startsWith('evidence/') && normalized.endsWith('.md');
}

function hasAny(content, patterns) {
  return patterns.some(pattern => pattern.test(content));
}

function extractMarkdownSection(content, headingPattern) {
  const match = headingPattern.exec(content);
  if (!match || typeof match.index !== 'number') return '';

  const sectionStart = match.index;
  const afterHeadingStart = sectionStart + match[0].length;
  const remainder = content.slice(afterHeadingStart);
  const nextHeadingIndex = remainder.search(/\n##\s+/);
  const sectionEnd = nextHeadingIndex === -1
    ? content.length
    : afterHeadingStart + nextHeadingIndex;

  return content.slice(sectionStart, sectionEnd);
}

function missingRequiredSections(content) {
  return REQUIRED_AUDIT_SECTIONS
    .filter(section => !hasAny(content, section.patterns))
    .map(section => section.name);
}

function isAuditDoc(content) {
  return hasAny(content, AUDIT_WORDS) || hasAny(content, FULL_AUDIT_CLAIMS) || hasAny(content, INVALIDATION_MARKERS);
}

function isInvalidationDoc(content) {
  const head = content.slice(0, 2500);
  return hasAny(head, INVALIDATION_MARKERS);
}

function hasFullAuditClaim(content) {
  return hasAny(content, FULL_AUDIT_CLAIMS);
}

function checkFullAuditSelfCheck(file, content) {
  const errors = [];
  const head = content.slice(0, 8000);
  if (!SELF_CHECK_HEADING_PATTERN.test(head)) {
    errors.push(`${file}: 声称全面审计或当前发布口径收口，但前部缺少“全面审计自检表”。`);
    return errors;
  }

  const section = extractMarkdownSection(content, SELF_CHECK_HEADING_PATTERN);
  for (const item of SELF_CHECK_REQUIRED_ITEMS) {
    if (!hasAny(section, item.patterns)) {
      errors.push(`${file}: “全面审计自检表”缺少“${item.name}”自检项。`);
    }
  }

  if (!/\bpassed\b/.test(section)) {
    errors.push(`${file}: “全面审计自检表”没有可搜索状态词 passed。`);
  }

  const incompleteStatus = section.match(/\b(representative_only|blocked|scoped_debt)\b/);
  if (incompleteStatus) {
    errors.push(`${file}: 声称已审计/已收口，但“全面审计自检表”仍包含 ${incompleteStatus[1]}，应先降级结论或补齐证据。`);
  }

  return errors;
}

function checkInvalidationDoc(file, content) {
  const errors = [];
  const required = [
    { name: '旧结论', patterns: [/旧结论/] },
    { name: '失效原因', patterns: [/失效原因/, /推翻/, /被.*反馈.*推翻/] },
    { name: '替代证据或替代入口', patterns: [/替代/, /当前替代入口/, /新增回归/, /当前代码修复入口/] },
    { name: '降级后当前状态', patterns: [/降级/, /当前状态/, /当前口径/, /旧结论失效/] },
  ];

  for (const item of required) {
    if (!hasAny(content, item.patterns)) {
      errors.push(`${file}: 旧结论失效文档缺少“${item.name}”。`);
    }
  }

  return errors;
}

function checkCompletionClaimDoc(file, content) {
  const errors = [];
  for (const section of missingRequiredSections(content)) {
    errors.push(`${file}: 声称已审计/已收口，但缺少 evidence 必填区块“${section}”。`);
  }
  errors.push(...checkFullAuditSelfCheck(file, content));

  const hasLevelMatrix = /L0/.test(content) && /L1/.test(content) && /L2/.test(content) && /L3/.test(content) && /L4/.test(content);
  if (!hasLevelMatrix) {
    errors.push(`${file}: 声称全面审计或当前发布口径收口，但未同时列出 L0/L1/L2/L3/L4 层级矩阵。`);
  }

  if (!/C\d+/.test(content)) {
    errors.push(`${file}: 声称全面审计或当前发布口径收口，但未看到 C1/C2/C3 这类规则子句编号。`);
  }

  const hasImplementationEntry = /实现入口|执行入口|validator|validate|command|handler|reducer|execute|UI\s*消费|真实入口/i.test(content);
  if (!hasImplementationEntry) {
    errors.push(`${file}: 声称全面审计或当前发布口径收口，但没有写清规则子句对应的实现/执行入口。`);
  }

  if (!/D\d+/.test(content)) {
    errors.push(`${file}: 声称全面审计或当前发布口径收口，但未登记命中的 D 维度。`);
  }

  const hasFinalStateEvidence = /最终权威状态|最终状态|finalState/i.test(content);
  if (!hasFinalStateEvidence) {
    errors.push(`${file}: 声称已收口，但没有明确“最终权威状态/最终状态/finalState”证据。`);
  }

  const hasNegativePath = /负向|不应|不得|不会|不能/.test(content);
  if (!hasNegativePath) {
    errors.push(`${file}: 声称已收口，但没有记录负向断言或“不应发生什么”。`);
  }

  if (hasAny(content, HIGH_RISK_TERMS)) {
    const hasQueueOrLifecycleEvidence = /触发队列|triggerQueue|reaction session|deferred|finalize|阶段可继续|流程收口|无残留/i.test(content);
    if (!hasQueueOrLifecycleEvidence) {
      errors.push(`${file}: 命中阶段/死亡/额外攻击等高风险语义，但缺少触发队列、阶段收口、无残留或等价 L4 生命周期证据。`);
    }
  }

  if (hasAny(content, IMAGE_CONTRACT_TERMS) && !hasAny(content, IMAGE_CONTRACT_EVIDENCE)) {
    errors.push(`${file}: 使用图片/图集/卡图作为真相源，但没有完整单卡主裁图、裁图清单、crop manifest、SHA256 或图片合同表。`);
  }

  if (/代表链/.test(content) && !/判等依据|仅配置不同|共享链路 ID|代表对象/.test(content)) {
    errors.push(`${file}: 使用代表链口径，但没有写清代表对象、判等依据或仅配置差异。`);
  }

  const unresolvedMarker = UNRESOLVED_COMPLETION_MARKERS.find(pattern => pattern.test(content));
  if (unresolvedMarker) {
    errors.push(`${file}: 声称全面审计或当前发布口径收口，但正文仍包含未完成/待补标记（${unresolvedMarker}）。`);
  }

  return errors;
}

function checkResidualDoc(file, content) {
  const errors = [];
  if (!/仍有残余范围/.test(content)) return errors;
  if (!/下一步|残余范围|pending|blocked|未完成|待补|不能宣称/.test(content)) {
    errors.push(`${file}: 结论为“仍有残余范围”，但没有写清下一步、残余项或阻塞项。`);
  }
  return errors;
}

function checkFile(file) {
  const absolutePath = path.resolve(repoRoot, file);
  if (!existsSync(absolutePath)) {
    return { file, skipped: true, errors: [`${file}: 文件不存在。`] };
  }
  if (!statSync(absolutePath).isFile()) {
    return { file, skipped: true, errors: [`${file}: 不是文件。`] };
  }

  const content = readFileSync(absolutePath, 'utf8');
  if (!isAuditDoc(content)) {
    return { file, skipped: true, errors: [] };
  }

  const errors = [];
  if (isInvalidationDoc(content)) {
    errors.push(...checkInvalidationDoc(file, content));
  } else if (hasFullAuditClaim(content)) {
    errors.push(...checkCompletionClaimDoc(file, content));
  }
  errors.push(...checkResidualDoc(file, content));

  return { file, skipped: false, errors };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printUsage();
    return;
  }

  const files = unique(
    (parsed.all
      ? collectMarkdownFiles(path.resolve(repoRoot, 'evidence'))
      : parsed.files.length > 0
        ? parsed.files
        : collectChangedEvidenceFiles({ includeUntracked: parsed.includeUntracked }))
      .map(normalizeFile)
      .filter(isEvidenceMarkdown),
  );

  if (files.length === 0) {
    console.log('[audit-evidence-completeness] no evidence markdown files to check');
    return;
  }

  const results = files.map(checkFile);
  const errors = results.flatMap(result => result.errors);
  const checkedCount = results.filter(result => !result.skipped).length;

  if (errors.length > 0) {
    console.error('[audit-evidence-completeness] evidence 留档门禁失败:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`[audit-evidence-completeness] checked files: ${files.length}; audit docs: ${checkedCount}`);
  console.log('[audit-evidence-completeness] OK');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
