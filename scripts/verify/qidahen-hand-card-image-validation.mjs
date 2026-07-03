#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

const EVIDENCE_FILE = 'test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json';
const TASKS_FILE = 'openspec/changes/refactor-qidahen-formal-core-loop-and-tutorial-coverage/tasks.md';
const VALID_STATUSES = new Set(['passed', 'failed', 'blocked', 'partial']);
const REQUIRED_LOCKED_FIELDS = ['中文牌名', '牌类为普通事件/军备/战术/银两之一', '规则效果摘要'];

const readJson = (path) => {
  if (!existsSync(path)) {
    throw new Error(`图片验收产物不存在：${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
};

const isTaskUnchecked = (content, taskId) => new RegExp(`^- \\[ \\] ${taskId.replace('.', '\\.')}\\b`, 'm').test(content);

const failures = [];
const evidence = readJson(EVIDENCE_FILE);
const tasksContent = readFileSync(TASKS_FILE, 'utf8');

if (evidence.id !== 'qidahen-formal-handcard-2.4') {
  failures.push(`id 必须是 qidahen-formal-handcard-2.4，实际为 ${evidence.id || '空'}`);
}

if (!Array.isArray(evidence.criteria)) {
  failures.push('criteria 必须是数组');
} else {
  for (const requiredCriterion of REQUIRED_LOCKED_FIELDS) {
    if (!evidence.criteria.includes(requiredCriterion)) {
      failures.push(`criteria 缺少正式反写门槛：${requiredCriterion}`);
    }
  }
}

if (!Array.isArray(evidence.items)) {
  failures.push('items 必须是数组');
}

const summary = evidence.summary ?? {};
const items = Array.isArray(evidence.items) ? evidence.items : [];
const statusCounts = { passed: 0, failed: 0, blocked: 0, partial: 0 };

items.forEach((item, index) => {
  const label = `items[${index}]`;
  if (item.idx !== index + 1) {
    failures.push(`${label}: idx 必须连续从 1 开始，实际为 ${item.idx}`);
  }
  if (!item.path) {
    failures.push(`${label}: 缺少 path`);
  }
  if (!VALID_STATUSES.has(item.status)) {
    failures.push(`${label}: 非法 status：${item.status || '空'}`);
  } else {
    statusCounts[item.status] += 1;
  }
  if (item.lockedFields == null || typeof item.lockedFields !== 'object' || Array.isArray(item.lockedFields)) {
    failures.push(`${label}: lockedFields 必须是对象`);
  }
  if (!item.reason) {
    failures.push(`${label}: 缺少 reason`);
  }
});

for (const status of VALID_STATUSES) {
  if (summary[status] !== statusCounts[status]) {
    failures.push(`summary.${status}=${summary[status]} 与 items 统计 ${statusCounts[status]} 不一致`);
  }
}

const statusTotal = [...VALID_STATUSES].reduce((total, status) => total + (summary[status] ?? 0), 0);
if (summary.total !== items.length) {
  failures.push(`summary.total=${summary.total} 与 items.length=${items.length} 不一致`);
}
if (summary.total !== statusTotal) {
  failures.push(`summary.total=${summary.total} 与状态合计 ${statusTotal} 不一致`);
}

if (summary.passed === 0) {
  for (const taskId of ['2.4', '4.5']) {
    if (!isTaskUnchecked(tasksContent, taskId)) {
      failures.push(`当前没有 passed 普通手牌，OpenSpec ${taskId} 必须保持未完成`);
    }
  }
}

if (summary.passed > 0 && !items.some((item) => item.status === 'passed')) {
  failures.push('summary.passed 大于 0，但 items 中没有 passed 行');
}

const processValidation = evidence.processValidation ?? {};
if (!processValidation.subagentVerdict || !processValidation.mainThreadCrossCheck) {
  failures.push('processValidation 必须记录子代理结果与主线程抽样对照');
}

if (!evidence.verdict?.includes('2.4') || !evidence.verdict?.includes('4.5')) {
  failures.push('verdict 必须说明 OpenSpec 2.4 / 4.5 的裁决');
}

console.log('# 七大恨普通手牌图片验收产物校验');
console.log('');
console.log(`- 验收产物：${EVIDENCE_FILE}`);
console.log(`- 图片条目：${items.length}`);
console.log(`- passed/failed/blocked/partial：${summary.passed ?? 0}/${summary.failed ?? 0}/${summary.blocked ?? 0}/${summary.partial ?? 0}`);
console.log(`- OpenSpec 任务文件：${TASKS_FILE}`);

if (failures.length > 0) {
  console.log('');
  console.log('## 失败项');
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  process.exit(1);
}

console.log('');
if (summary.passed === 0) {
  console.log('结论：图片验收产物自洽，且当前没有 passed 普通手牌；2.4 / 4.5 必须保持未完成。');
} else {
  console.log('结论：图片验收产物自洽；存在 passed 行时仍需人工录入反写校验与定向测试共同证明可改正式映射。');
}
