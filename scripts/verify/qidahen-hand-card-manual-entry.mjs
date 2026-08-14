#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

const FILES = [
  {
    label: '人工录入矩阵',
    path: 'docs/games/qidahen/records/qidahen-hand-card-manual-entry-matrix.md',
  },
  {
    label: '剩余候选人工复核清单',
    path: 'docs/games/qidahen/records/qidahen-hand-card-human-review-checklist.md',
  },
  {
    label: 'TTS CardID 完整人工录入矩阵',
    path: 'docs/games/qidahen/records/qidahen-hand-card-tts-cardid-full-manual-entry-matrix.md',
  },
  {
    label: '运行时图集候选人工录入矩阵',
    path: 'docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-manual-entry-matrix.md',
  },
  {
    label: 'atlas05 普通手牌人工录入矩阵',
    path: 'docs/games/qidahen/records/qidahen-hand-card-atlas05-manual-entry-matrix.md',
  },
];

const TASKS_FILE = 'openspec/changes/refactor-qidahen-formal-core-loop-and-tutorial-coverage/tasks.md';

const ORDINARY_KINDS = new Set(['普通事件', '事件', '军备', '战术', '银两']);
const ARMAMENT_IDS = new Set([
  'artillery-tech',
  'infantry-armor',
  'cavalry-armor',
  'western-bastion',
  'long-barreled-musket',
  'cavalry-firearm',
  'manzhou-banners',
  'horse-breeding',
  'mongol-banners',
  'han-banners',
]);

const splitMarkdownRow = (line) => line
  .trim()
  .replace(/^\|/, '')
  .replace(/\|$/, '')
  .split('|')
  .map((cell) => cell.trim());

const isSeparatorRow = (cells) => cells.every((cell) => /^:?-{3,}:?$/.test(cell));

const parseTables = (content) => {
  const lines = content.split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length; index += 1) {
    const headerLine = lines[index];
    const separatorLine = lines[index + 1];
    if (!headerLine?.trim().startsWith('|') || !separatorLine?.trim().startsWith('|')) {
      continue;
    }
    const headers = splitMarkdownRow(headerLine);
    const separator = splitMarkdownRow(separatorLine);
    if (!isSeparatorRow(separator)) {
      continue;
    }
    const rows = [];
    index += 2;
    while (index < lines.length && lines[index].trim().startsWith('|')) {
      const cells = splitMarkdownRow(lines[index]);
      rows.push(Object.fromEntries(headers.map((header, columnIndex) => [header, cells[columnIndex] ?? ''])));
      index += 1;
    }
    tables.push({ headers, rows });
    index -= 1;
  }
  return tables;
};

const normalizeStatus = (row) => row['复核状态'] ?? '';
const normalizeKind = (row) => row['人工牌类'] || row['人工结论'] || '';
const normalizeName = (row) => row['人工中文牌名'] || row['中文牌名'] || '';
const normalizeEffect = (row) => row['规则效果摘要'] || '';
const normalizeArmamentId = (row) => row['军备目标'] || '';

const confirmedRowsFromFile = ({ label, path }) => {
  if (!existsSync(path)) {
    throw new Error(`${label} 不存在：${path}`);
  }
  const content = readFileSync(path, 'utf8');
  return parseTables(content)
    .flatMap((table) => table.rows)
    .filter((row) => normalizeStatus(row) === '已确认')
    .map((row) => ({ label, path, row }));
};

const failures = [];
const confirmedRows = FILES.flatMap(confirmedRowsFromFile);
const tasksContent = readFileSync(TASKS_FILE, 'utf8');
const isTaskUnchecked = (taskId) => new RegExp(`^- \\[ \\] ${taskId.replace('.', '\\.')}\\b`, 'm').test(tasksContent);

for (const entry of confirmedRows) {
  const { label, path, row } = entry;
  const id = row.id || row.ID || row.CardID || row['序号'] || '(unknown id)';
  const kind = normalizeKind(row);
  const cardName = normalizeName(row);
  const effect = normalizeEffect(row);
  const armamentId = normalizeArmamentId(row);

  if (!ORDINARY_KINDS.has(kind)) {
    failures.push(`${label} ${id}: 已确认行的牌类必须是普通事件/事件/军备/战术/银两，实际为“${kind || '空'}” (${path})`);
  }
  if (!cardName) {
    failures.push(`${label} ${id}: 已确认行缺少人工中文牌名 (${path})`);
  }
  if (!effect) {
    failures.push(`${label} ${id}: 已确认行缺少规则效果摘要 (${path})`);
  }
  if (kind === '军备') {
    if (!armamentId) {
      failures.push(`${label} ${id}: 军备牌已确认行缺少军备目标 (${path})`);
    } else if (!ARMAMENT_IDS.has(armamentId)) {
      failures.push(`${label} ${id}: 军备目标“${armamentId}”不是已有 QidahenArmamentId (${path})`);
    }
  } else if (armamentId) {
    failures.push(`${label} ${id}: 非军备牌不得填写军备目标“${armamentId}” (${path})`);
  }
}

console.log('# 七大恨普通手牌人工录入反写校验');
console.log('');
console.log(`- 已确认行数：${confirmedRows.length}`);
console.log(`- 校验文件：${FILES.map((file) => file.path).join('；')}`);
console.log(`- OpenSpec 任务文件：${TASKS_FILE}`);

if (confirmedRows.length === 0) {
  for (const taskId of ['2.4', '4.5']) {
    if (!isTaskUnchecked(taskId)) {
      failures.push(`OpenSpec ${taskId}: 当前没有已确认普通手牌行，${taskId} 必须保持未完成 (${TASKS_FILE})`);
    }
  }
}

if (failures.length > 0) {
  console.log('');
  console.log('## 失败项');
  for (const failure of failures) {
    console.log(`- ${failure}`);
  }
  process.exit(1);
}

console.log('');
if (confirmedRows.length === 0) {
  console.log('结论：当前没有任何已确认普通手牌行，不允许反写正式手牌规则映射。');
} else {
  console.log('结论：所有已确认行均满足反写字段门槛；仍需结合来源证据和定向测试后才能修改正式映射。');
}
