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
  /漏审/,
  /旧审计问题/,
  /审计问题/,
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

const ONCE_PER_TURN_TERMS = [
  /每回合一次/,
  /once[- ]per[- ]turn/i,
  /usesPerTurn/,
];

const BUTTON_INTERACTION_TERMS = [
  /按钮/,
  /button/i,
  /真实棋盘能力按钮/,
  /真实入口/,
];

const POST_USE_BUTTON_EVIDENCE = [
  /使用后.*(按钮|button).*(隐藏|消失|不可见|禁用|disabled|hidden)/s,
  /(二次|再次|重复).*(按钮|使用|发动|ACTIVATE_ABILITY).*(拒绝|不能|不可|失败|每回合只能使用一次)/s,
  /abilityUsageCount/,
  /每回合只能使用一次/,
];

const ALTERNATIVE_CHOICE_TERMS = [
  /或者/,
  /二选一/,
  /\bor\b/i,
];

const ALTERNATIVE_CHOICE_EVIDENCE = [
  /二选一/,
  /两个?选项/,
  /分支/,
  /选择前/,
  /确认后/,
  /consume_charge|take_damage/,
  /simple[- ]choice/i,
  /choice/i,
];

const OPTIONAL_OR_QUANTITY_TERMS = [
  /可以/,
  /至多/,
  /任意数量/,
  /可选/,
  /\bmay\b/i,
  /up to/i,
  /any number/i,
];

const OPTIONAL_OR_QUANTITY_EVIDENCE = [
  /空选/,
  /少选/,
  /跳过/,
  /拒绝/,
  /负向/,
  /不应/,
  /不得/,
  /无效/,
  /重复/,
  /边界/,
  /multi/i,
  /skip/i,
];

const PHASE_LIFECYCLE_TERMS = [
  /阶段结束/,
  /攻击阶段结束/,
  /移动阶段结束/,
  /魔力阶段结束/,
  /sys\.interaction\.current/,
  /simple[- ]choice/i,
  /prompt/i,
];

const PHASE_LIFECYCLE_EVIDENCE = [
  /阶段可继续/,
  /推进/,
  /进入.*阶段/,
  /流程收口/,
  /无残留/,
  /清空/,
  /确认后/,
  /选择前/,
  /triggerQueue/i,
  /finalState/i,
  /sys\.interaction\.current/,
];

const VISIBLE_INTERACTION_TERMS = [
  /sys\.interaction\.current/,
  /simple[- ]choice/i,
  /prompt/i,
  /状态横幅/,
  /横幅/,
  /StatusBanners/,
  /PromptOverlay/,
];

const VISIBLE_INTERACTION_EVIDENCE = [
  /真实入口/,
  /E2E/,
  /按钮/,
  /可见/,
  /隐藏/,
  /禁用/,
  /点击/,
  /optionId|option/i,
  /data-testid/,
  /Board\.tsx/,
  /StatusBanners/,
  /PromptOverlay/,
];

const TEST_COVERAGE_CLAIM_TERMS = [
  /可玩\s*handler\s*\+\s*测试/i,
  /定向测试覆盖/,
  /测试覆盖/,
  /(^|[^没未无不])有.{0,12}测试/,
];

const TEST_SEMANTIC_RISK_TERMS = [
  /选择/,
  /然后/,
  /可以/,
  /至多/,
  /任意数量/,
  /弃一张/,
  /抓.*弃/,
  /draw.*discard/i,
  /choose|then|may|up to|any number/i,
  /simple[- ]choice/i,
  /prompt/i,
];

const TEST_SEMANTIC_EVIDENCE = [
  /测试语义对账/,
  /测试断言/,
  /断言.*(最终|响应后|选择后|只|不应|不得)/s,
  /旧测试.*(失效|错误语义|过窄)/s,
  /首跑失败/,
  /红测/,
  /负向断言/,
];

const BUG_CLOSEOUT_TERMS = [
  /漏审/,
  /回归处理/,
  /旧结论失效/,
  /用户原始症状/,
  /本轮.*修复/,
  /反馈.*修复/,
];

const SIMILAR_ISSUE_AUDIT_EVIDENCE = [
  /同类扩审/,
  /扩审范围/,
  /横向搜索/,
  /搜索范围/,
  /搜索了什么/,
  /根因关键词/,
  /共享.*调用点/,
  /未审家族/,
  /残余扩审/,
];

const MISSED_AUDIT_ROOT_CAUSE_EVIDENCE = [
  /漏审归因/,
  /旧测试已经失效/,
  /测试断言过窄/,
  /证据停在中间态/,
  /审计对象没建全集/,
  /共享抽象没扩审/,
  /根因分级/,
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

const NON_DEFAULT_RESIDUAL_POOL_TERMS = [
  /非默认残余池/,
  /可回顾残余池/,
];

const P0_SCREENING_BEFORE_RESIDUAL_EVIDENCE = [
  /P1\/P2 入池前置筛查/,
  /已完成 P0 .*筛查/,
  /P0 实现正确性筛查/,
  /未经 P0 筛查/,
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
    name: '测试语义对账 / 旧测试失效检查',
    patterns: [/测试语义对账/, /测试断言/, /旧测试.*(失效|错误语义|过窄)/s, /红测/, /首跑失败/],
  },
  {
    name: '同类扩审记录',
    patterns: [/同类扩审/, /扩审范围/, /横向搜索/, /搜索范围/, /根因关键词/, /共享.*调用点/],
  },
  {
    name: '分支/可选/数量边界',
    patterns: [/分支/, /可选/, /或者/, /二选一/, /空选/, /少选/, /至多/, /任意数量/, /边界/],
  },
  {
    name: '阶段/生命周期收口',
    patterns: [/阶段.*(收口|推进|可继续)/s, /生命周期/, /无残留/, /sys\.interaction\.current/, /triggerQueue/i, /finalState/i],
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

function hasNonNegatedAny(content, patterns) {
  return patterns.some(pattern => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    for (const match of content.matchAll(globalPattern)) {
      const start = match.index ?? 0;
      const prefix = content.slice(Math.max(0, start - 36), start);
      if (/(不|未|无|勿|非|禁止|不得|不能|不可|不应|不再|不要|避免|降级|只能|并非).{0,35}$/.test(prefix)) {
        continue;
      }
      return true;
    }
    return false;
  });
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
  return hasAny(content, AUDIT_WORDS) || hasFullAuditClaim(content) || hasAny(content, INVALIDATION_MARKERS);
}

function isInvalidationDoc(content) {
  const head = content.slice(0, 2500);
  return hasAny(head, INVALIDATION_MARKERS);
}

function hasFullAuditClaim(content) {
  return hasNonNegatedAny(content, FULL_AUDIT_CLAIMS);
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

  if (hasAny(content, ONCE_PER_TURN_TERMS) && hasAny(content, BUTTON_INTERACTION_TERMS) && !hasAny(content, POST_USE_BUTTON_EVIDENCE)) {
    errors.push(`${file}: 命中“每回合一次/usesPerTurn + 真实按钮入口”，但缺少使用后按钮隐藏/禁用、二次使用拒绝或 abilityUsageCount 证据。`);
  }

  if (hasAny(content, ALTERNATIVE_CHOICE_TERMS) && !hasAny(content, ALTERNATIVE_CHOICE_EVIDENCE)) {
    errors.push(`${file}: 命中“或者/or/二选一”语义，但缺少分支选择、两个选项、选择前后状态或 simple-choice/choice 证据。`);
  }

  if (hasAny(content, OPTIONAL_OR_QUANTITY_TERMS) && !hasAny(content, OPTIONAL_OR_QUANTITY_EVIDENCE)) {
    errors.push(`${file}: 命中“可以/至多/任意数量/可选”语义，但缺少空选、少选、跳过、无效输入、重复输入或边界负向证据。`);
  }

  if (hasAny(content, PHASE_LIFECYCLE_TERMS) && !hasAny(content, PHASE_LIFECYCLE_EVIDENCE)) {
    errors.push(`${file}: 命中阶段结束、prompt 或 simple-choice 语义，但缺少阶段推进、流程收口、无残留、选择前后状态或最终状态证据。`);
  }

  if (hasAny(content, VISIBLE_INTERACTION_TERMS) && !hasAny(content, VISIBLE_INTERACTION_EVIDENCE)) {
    errors.push(`${file}: 命中系统交互/prompt/横幅语义，但缺少真实 UI 可见按钮、点击、optionId、E2E 或对应组件证据。`);
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

function checkTestCoverageClaimDoc(file, content) {
  const errors = [];
  if (!hasAny(content, TEST_COVERAGE_CLAIM_TERMS)) return errors;
  if (!hasAny(content, TEST_SEMANTIC_RISK_TERMS)) return errors;

  if (!hasAny(content, TEST_SEMANTIC_EVIDENCE)) {
    errors.push(`${file}: 声称“有测试/测试覆盖/可玩 handler + 测试”且命中选择、然后、可选或抽弃等交互语义，但没有写清测试语义对账、旧测试失效检查或最终状态断言。`);
  }

  return errors;
}

function checkBugCloseoutDoc(file, content) {
  const errors = [];
  if (!hasAny(content, BUG_CLOSEOUT_TERMS)) return errors;

  if (!hasAny(content, SIMILAR_ISSUE_AUDIT_EVIDENCE)) {
    errors.push(`${file}: 记录了漏审/回归/用户反馈修复，但没有写同类扩审记录、搜索范围、命中项或残余扩审范围。`);
  }

  if (/漏审/.test(content) && !hasAny(content, MISSED_AUDIT_ROOT_CAUSE_EVIDENCE)) {
    errors.push(`${file}: 记录了漏审，但没有写漏审归因，例如旧测试失效、测试断言过窄、证据停在中间态、审计对象没建全集或共享抽象没扩审。`);
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

function checkNonDefaultResidualPoolDoc(file, content) {
  const errors = [];
  if (!hasAny(content, NON_DEFAULT_RESIDUAL_POOL_TERMS)) return errors;

  if (!hasAny(content, P0_SCREENING_BEFORE_RESIDUAL_EVIDENCE)) {
    errors.push(`${file}: 使用“非默认/可回顾残余池”口径，但没有写清 P1/P2 入池前必须已完成 P0 实现正确性筛查。`);
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
  errors.push(...checkTestCoverageClaimDoc(file, content));
  errors.push(...checkBugCloseoutDoc(file, content));
  errors.push(...checkResidualDoc(file, content));
  errors.push(...checkNonDefaultResidualPoolDoc(file, content));

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
