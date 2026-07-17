#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT_DIR = process.cwd();
const GAMES_DIR = path.join(ROOT_DIR, 'src', 'games');
const STRICT = process.argv.includes('--strict');

const CONTROL_PATTERN = /createSkipOption|__emergency_skip__|__cancel__|\bskip\b|\bpass\b|\bdone\b|\bcancel\b/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'rule') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(file);
    }
  }
  return out;
}

function getCallName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return '';
}

function getLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function compactText(sourceFile, node, limit = 180) {
  return node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, limit);
}

function hasControlOption(sourceFile, node) {
  return CONTROL_PATTERN.test(node.getText(sourceFile));
}

function getMultiConfigText(sourceFile, configArg) {
  if (!configArg) return '';
  const text = configArg.getText(sourceFile);
  const match = text.match(/multi\s*:\s*\{[^}]*\}/);
  return match ? match[0].replace(/\s+/g, ' ') : '';
}

function isRequiredMulti(multiText) {
  if (!multiText) return false;
  if (/min\s*:\s*0\b/.test(multiText)) return false;
  if (/min\s*:\s*Math\.min\(/.test(multiText)) return false;
  return true;
}

const findings = [];
const stats = {
  calls: 0,
  literalEmptyArrays: 0,
  literalArraysWithControl: 0,
  literalArraysWithoutControl: 0,
  dynamicOptions: 0,
  requiredMultiDynamicOptions: 0,
};

for (const file of walk(GAMES_DIR)) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (ts.isCallExpression(node) && getCallName(node.expression) === 'createSimpleChoice') {
      stats.calls += 1;
      const optionsArg = node.arguments[3];
      const configArg = node.arguments[4];
      const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
      const line = getLine(sourceFile, node);
      const multiText = getMultiConfigText(sourceFile, configArg);

      if (!optionsArg) {
        findings.push({
          level: 'error',
          rel,
          line,
          reason: '缺少选项参数',
          detail: 'createSimpleChoice 没有第 4 个 options 参数',
        });
      } else if (ts.isArrayLiteralExpression(optionsArg)) {
        if (optionsArg.elements.length === 0) {
          stats.literalEmptyArrays += 1;
          findings.push({
            level: 'error',
            rel,
            line,
            reason: '直接创建空选择',
            detail: '不要传 []；应在能力逻辑里不创建交互、给显式 skip/cancel，或确认由通用应急跳过接管',
          });
        } else if (hasControlOption(sourceFile, optionsArg)) {
          stats.literalArraysWithControl += 1;
        } else {
          stats.literalArraysWithoutControl += 1;
        }
      } else {
        stats.dynamicOptions += 1;
        if (isRequiredMulti(multiText)) {
          stats.requiredMultiDynamicOptions += 1;
          findings.push({
            level: STRICT ? 'error' : 'warn',
            rel,
            line,
            reason: '动态候选 + 强制最少选择',
            detail: `${multiText} :: ${compactText(sourceFile, optionsArg)}`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const errors = findings.filter((finding) => finding.level === 'error');
const warnings = findings.filter((finding) => finding.level === 'warn');

console.log('[interaction-empty-options-audit] createSimpleChoice 扫描完成');
console.log(`[interaction-empty-options-audit] calls=${stats.calls}; literalEmptyArrays=${stats.literalEmptyArrays}; dynamicOptions=${stats.dynamicOptions}; requiredMultiDynamicOptions=${stats.requiredMultiDynamicOptions}`);

for (const finding of findings.slice(0, 200)) {
  const prefix = finding.level === 'error' ? 'ERROR' : 'WARN';
  console.log(`[interaction-empty-options-audit] ${prefix} ${finding.rel}:${finding.line} ${finding.reason} - ${finding.detail}`);
}

if (findings.length > 200) {
  console.log(`[interaction-empty-options-audit] 还有 ${findings.length - 200} 条未展示；请用 --strict 或收窄文件继续审计`);
}

if (errors.length > 0) {
  console.error(`[interaction-empty-options-audit] 失败：发现 ${errors.length} 个必须处理的问题`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.log(`[interaction-empty-options-audit] 提醒：发现 ${warnings.length} 个动态强制选择候选；当前不阻塞，运行 --strict 可把它们提升为失败`);
}

console.log('[interaction-empty-options-audit] OK');
