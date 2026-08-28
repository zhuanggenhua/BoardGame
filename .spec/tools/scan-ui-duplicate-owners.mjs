#!/usr/bin/env node
/**
 * scan-ui-duplicate-owners — UI 信息 owner 重复扫描。
 *
 * 用法：
 *   node .spec/tools/scan-ui-duplicate-owners.mjs --contract mage-wars-spellbook-builder <html-file>
 *
 * 目的：
 *   对用户已反复指出的“同一身份 / 数值 / 容量 / 数量被多个 UI 同时复写”做机械门禁。
 *   它只扫描额外 UI 文本与结构，不把正式卡面图片里的印刷文字当成违规。
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const CONTRACTS = {
  'mage-wars-spellbook-builder': {
    visibleMax: [
      {
        id: 'spellpoint-visible-owner',
        label: '默认态法术点总体容量 owner',
        pattern: /法术点/g,
        max: 1,
      },
      {
        id: 'spellpoint-ratio-visible-owner',
        label: '默认态 120 / 120 总体容量读数',
        pattern: /120\s*\/\s*120/g,
        max: 1,
      },
      {
        id: 'current-mage-visible-owner',
        label: '默认态当前法师身份 owner',
        pattern: /兽王/g,
        max: 1,
      },
      {
        id: 'standalone-detail-visible-entry',
        label: '默认态独立详情入口',
        pattern: /详情/g,
        max: 0,
      },
    ],
    visibleForbidden: [
      { id: 'current-mage-colon', label: '当前法师冒号身份复写', pattern: /当前法师：兽王/g },
      { id: 'beastmaster-standard-tab', label: '来源 tab 复写兽王身份', pattern: /兽王标准书/g },
      { id: 'count-badge-xn', label: '卡图数量角标 xN', pattern: /xN/g },
      { id: 'hidden-diy-library-copy', label: '角落 DIY 法术书文案', pattern: /DIY\s*法术书/g },
      { id: 'blank-builder-primary-entry', label: '空白自组主入口', pattern: /空白自组/g },
      { id: 'old-diy-empty-state', label: '旧 DIY 空态', pattern: /还没有\s*DIY\s*法术书/g },
      { id: 'redundant-current-spellbook-title', label: '选中态被复写为当前法术书', pattern: /当前法术书/g },
      { id: 'redundant-current-mage-library-title', label: '选中法师库被复写为当前法师法术书库', pattern: /当前法师法术书库/g },
      { id: 'redundant-edit-current-book', label: '编辑按钮复写当前书', pattern: /编辑当前书/g },
      { id: 'redundant-update-current-copy', label: '更新按钮复写当前副本', pattern: /更新当前副本/g },
      { id: 'redundant-name-current-book', label: '命名输入复写当前书', pattern: /给当前书取名/g },
      { id: 'redundant-save-from-current-book', label: '保存说明复写当前书', pattern: /新书从当前书/g },
      { id: 'redundant-current-book-filter', label: '筛选项复写当前书内', pattern: /当前书内/g },
      { id: 'seat-owner', label: '组书页席位主控', pattern: /席位/g },
      { id: 'p1-owner', label: '组书页 P1 主控', pattern: /\bP1\b/g },
      { id: 'p2-owner', label: '组书页 P2 主控', pattern: /\bP2\b/g },
      { id: 'missing-art', label: '缺图占位', pattern: /缺图/g },
      { id: 'default-management-helper-copy', label: '默认态不显示管理说明文案', pattern: /标准起始书和命名副本同级/g },
      { id: 'default-list-helper-copy', label: '默认态不显示右侧清单解释文案', pattern: /真实缩略、数量上限/g },
      { id: 'default-scroll-helper-copy', label: '默认态不显示滚动说明文案', pattern: /滚动查看整本书/g },
      { id: 'default-count-rule-copy', label: '默认态不显示数量规则说明块', pattern: /数量：1级/g },
      { id: 'default-cost-rule-copy', label: '默认态不显示成本规则说明块', pattern: /成本：受训/g },
    ],
    forbiddenSelectors: [
      { id: 'standalone-detail-button', label: '独立详情按钮', selector: '.mage-detail-trigger' },
      { id: 'builder-mage-switcher', label: '组书页内部法师切换器', selector: '[data-testid^="mage-wars-spellbook-builder-mage-option-"], .mage-option' },
      { id: 'default-expanded-library-panel', label: '默认态不得展开法术书库管理面板', selector: '.builder-library-panel' },
    ],
    requiredSelectors: [
      { id: 'hearthstone-comparison-topbar', label: '成熟组牌式紧凑顶栏', selector: '.builder-topbar[data-hearthstone-comparison="card-pool-deck-list"]' },
      { id: 'selected-mage-context-opens-detail', label: '已选法师主控打开规则卡', selector: '.mage-context[data-mage-detail-open]' },
      { id: 'saved-spellbook-library', label: '同法师已保存法术书库', selector: '[data-testid="mage-wars-spellbook-builder-saved-library"]' },
      { id: 'saved-spellbook-library-toggle', label: '法术书库按需展开入口', selector: '[data-testid="mage-wars-spellbook-builder-saved-library-toggle"]' },
      { id: 'spellpoint-capacity-owner', label: '顶部容量区总体法术点 owner', selector: '.capacity' },
      { id: 'card-pool-grid', label: '主视觉卡池网格', selector: '[data-testid="mage-wars-spellbook-builder-card-pool-grid"]' },
      { id: 'right-deck-list', label: '右侧法术书清单', selector: '[data-testid="mage-wars-spellbook-builder-current-list"]' },
    ],
    selectorForbidden: [
      {
        id: 'deck-headline-no-total-budget',
        label: '右侧清单标题不得复写总体容量',
        selector: '.deck-headline',
        includeHidden: true,
        patterns: [/法术点/g, /120\s*\/\s*120/g],
      },
      {
        id: 'detail-layer-no-total-budget-number',
        label: '详情层不得复写总体容量数值',
        selector: '.mage-detail-layer',
        includeHidden: true,
        patterns: [/法术点\s*120/g, /120\s*点上限/g, /120\s*\/\s*120/g],
      },
      {
        id: 'school-filter-no-subtype-leak',
        label: '学派筛选不得混入生物 / 装备子类型',
        selector: '[data-testid="mage-wars-spellbook-builder-filter-school"]',
        includeHidden: true,
        patterns: [/蝙蝠/g, /手套/g, /靴子/g, /传送门/g, /胸甲/g],
      },
    ],
  },
};

function usage() {
  const names = Object.keys(CONTRACTS).join(', ');
  console.error(`用法: node .spec/tools/scan-ui-duplicate-owners.mjs --contract <${names}> <html-file>`);
}

function parseArgs(argv) {
  let contract = 'mage-wars-spellbook-builder';
  let json = false;
  const files = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--contract') {
      contract = argv[i + 1];
      i += 1;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (CONTRACTS[arg] && files.length === 0) {
      contract = arg;
    } else {
      files.push(arg);
    }
  }

  if (!CONTRACTS[contract]) {
    usage();
    throw new Error(`未知 contract: ${contract}`);
  }
  if (files.length === 0) {
    usage();
    throw new Error('缺少 html-file');
  }

  return { contract, json, files };
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isHiddenElement(element) {
  for (let node = element; node; node = node.parentElement) {
    if (node.hasAttribute('hidden')) return true;
    if (node.getAttribute('aria-hidden') === 'true') return true;
    const style = (node.getAttribute('style') || '').replace(/\s+/g, '').toLowerCase();
    if (style.includes('display:none') || style.includes('visibility:hidden')) return true;
  }
  return false;
}

function collectVisibleText(document, root) {
  const NodeFilter = document.defaultView.NodeFilter;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'template') return NodeFilter.FILTER_REJECT;
      if (isHiddenElement(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const parts = [];
  while (walker.nextNode()) {
    const text = normalizeText(walker.currentNode.nodeValue || '');
    if (text) parts.push(text);
  }
  return normalizeText(parts.join(' '));
}

function selectorText(document, selector, includeHidden) {
  return Array.from(document.querySelectorAll(selector))
    .map((element) => {
      if (includeHidden) return normalizeText(element.textContent || '');
      return collectVisibleText(document, element);
    })
    .filter(Boolean)
    .join(' ');
}

function countMatches(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  return Array.from(text.matchAll(re)).length;
}

function runContract(file, contractName) {
  const absolute = resolve(file);
  const html = readFileSync(absolute, 'utf8');
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const contract = CONTRACTS[contractName];
  const visibleText = collectVisibleText(document, document.body);
  const violations = [];
  const checks = [];

  for (const rule of contract.visibleMax) {
    const count = countMatches(visibleText, rule.pattern);
    const ok = count <= rule.max;
    checks.push({ id: rule.id, label: rule.label, count, max: rule.max, ok });
    if (!ok) {
      violations.push(`${rule.label}: 默认可见文本命中 ${count} 次，最多允许 ${rule.max} 次`);
    }
  }

  for (const rule of contract.visibleForbidden) {
    const count = countMatches(visibleText, rule.pattern);
    const ok = count === 0;
    checks.push({ id: rule.id, label: rule.label, count, max: 0, ok });
    if (!ok) violations.push(`${rule.label}: 默认可见文本仍命中 ${count} 次`);
  }

  for (const rule of contract.forbiddenSelectors) {
    const count = document.querySelectorAll(rule.selector).length;
    const ok = count === 0;
    checks.push({ id: rule.id, label: rule.label, count, max: 0, ok });
    if (!ok) violations.push(`${rule.label}: 仍存在 ${count} 个 ${rule.selector}`);
  }

  for (const rule of contract.requiredSelectors) {
    const count = document.querySelectorAll(rule.selector).length;
    const ok = count > 0;
    checks.push({ id: rule.id, label: rule.label, count, min: 1, ok });
    if (!ok) violations.push(`${rule.label}: 未找到 ${rule.selector}`);
  }

  for (const rule of contract.selectorForbidden) {
    const text = selectorText(document, rule.selector, rule.includeHidden);
    for (const pattern of rule.patterns) {
      const count = countMatches(text, pattern);
      const ok = count === 0;
      checks.push({
        id: rule.id,
        label: `${rule.label}: ${pattern.source}`,
        count,
        max: 0,
        ok,
      });
      if (!ok) violations.push(`${rule.label}: ${rule.selector} 命中 ${pattern.source} ${count} 次`);
    }
  }

  return {
    file: absolute,
    name: basename(absolute),
    contract: contractName,
    ok: violations.length === 0,
    visibleTextLength: visibleText.length,
    checks,
    violations,
  };
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const results = parsed.files.map((file) => runContract(file, parsed.contract));
const ok = results.every((result) => result.ok);

if (parsed.json) {
  console.log(JSON.stringify({ ok, results }, null, 2));
} else {
  for (const result of results) {
    const status = result.ok ? 'OK' : 'FAIL';
    console.log(`${status} ${result.name} (${result.contract})`);
    for (const check of result.checks) {
      const marker = check.ok ? '✓' : '✗';
      const limit = check.max !== undefined ? `max=${check.max}` : `min=${check.min}`;
      console.log(`  ${marker} ${check.label}: count=${check.count} ${limit}`);
    }
    for (const violation of result.violations) {
      console.log(`  - ${violation}`);
    }
  }
}

if (!ok) process.exit(1);
