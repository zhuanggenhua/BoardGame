#!/usr/bin/env node
/**
 * scan-ui-duplicate-owners — UI 信息 owner 重复扫描。
 *
 * 用法：
 *   node .spec/tools/scan-ui-duplicate-owners.mjs --ruleset <ruleset-name> <html-file>
 *   node .spec/tools/scan-ui-duplicate-owners.mjs --self-check
 *
 * 目的：
 *   对用户已反复指出的“同一身份 / 数值 / 容量 / 数量被多个 UI 同时复写”做机械门禁。
 *   它只扫描额外 UI 文本与结构，不把正式卡面图片里的印刷文字当成违规。
 *   规则按 UI 类型沉淀，不为单张卡、单个截图或单次反馈另建清单。
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const MAGE_WARS_MAGE_STANDARD_BOOK_RE = /(?:兽王|女祭司|邪术师|巫师)标准书/g;

const RULESETS = {
  'selection-library': {
    visibleMax: [],
    visibleForbidden: [
      { id: 'standard-card-edit-save-copy', label: '标准书卡常驻编辑并另存', pattern: /编辑并另存|Edit and save copy/g },
      { id: 'clickability-as-visible-state', label: '可点击性被写成可见状态', pattern: /点击使用|点击选择|点此加入|Click to use|Tap to select/g },
      { id: 'selected-state-duplicated-as-copy', label: '选中态被额外文字复写', pattern: /已使用|In use/g },
      { id: 'old-mage-card-selector', label: '旧法师卡主选择器文案', pattern: /选择双方学徒法师|Choose apprentice mages/g },
      { id: 'named-copy-empty-state', label: '命名副本空态文字不得替代加号入口', pattern: /暂无命名副本|No named copies/g },
      { id: 'new-book-from-selected-copy', label: '新建入口不得隐式沿用选中书', pattern: /新书从选中书|从选中书新建|从选中书保存命名副本|Create a named copy from the selected book|Save from selected book/g },
    ],
    forbiddenSelectors: [
      {
        id: 'standard-card-edit-button',
        label: '标准书卡旧编辑另存按钮',
        selector: '[data-testid^="mage-wars-mage-selection-edit-standard-spellbook-"]',
      },
      {
        id: 'old-mage-card-selector',
        label: '旧法师卡主选择器',
        selector: '[data-testid^="mage-wars-mage-selection-card-"]',
      },
    ],
    requiredSelectors: [
      { id: 'spellbook-selection-gate', label: '法术书选择页', selector: '[data-testid="mage-wars-mage-selection-gate"]' },
      { id: 'spellbook-library', label: '主对象法术书库', selector: '[data-testid="mage-wars-mage-selection-spellbook-library"]' },
      { id: 'standard-spellbooks', label: '标准起始书卡', selector: '[data-testid="mage-wars-mage-selection-standard-spellbook"]' },
      { id: 'new-spellbook-plus-entry', label: '法术书库加号新建入口', selector: '[data-testid="mage-wars-mage-selection-new-spellbook-entry"]' },
      { id: 'new-spellbook-requires-mage-choice', label: '新建法术书必须先选择绑定法师', selector: '[data-testid="mage-wars-mage-selection-new-spellbook-entry"][data-new-spellbook-mage-choice="required"]' },
      { id: 'single-edit-selected-entry', label: '统一编辑选中书入口', selector: '[data-testid="mage-wars-open-spellbook-builder"]' },
    ],
    perItemRequiredSelectors: [
      {
        id: 'saved-spellbook-diy-badge',
        label: '命名副本卡必须显示 DIY 身份标记',
        parentSelector: '[data-testid="mage-wars-mage-selection-saved-spellbook"]',
        childSelector: '[data-testid="mage-wars-mage-selection-saved-spellbook-diy-badge"]',
      },
    ],
    numericAttributes: [
      {
        id: 'selection-saved-spellbook-limit',
        label: '选择页命名法术书保存上限',
        selector: '[data-testid="mage-wars-mage-selection-new-spellbook-entry"]',
        attribute: 'data-saved-spellbook-limit',
        min: 10,
      },
    ],
    selectorForbidden: [],
  },
  'deck-builder': {
    visibleMax: [
      {
        id: 'spellpoint-visible-owner',
        label: '法术点总体容量 owner',
        pattern: /法术点/g,
        max: 1,
      },
      {
        id: 'spellpoint-ratio-visible-owner',
        label: '120 / 120 总体容量读数',
        pattern: /120\s*\/\s*120/g,
        max: 1,
      },
      {
        id: 'standalone-detail-visible-entry',
        label: '独立详情入口',
        pattern: /详情/g,
        max: 0,
      },
    ],
    visibleForbidden: [
      { id: 'current-mage-colon', label: '当前法师冒号身份复写', pattern: /当前法师[:：]/g },
      { id: 'mage-standard-tab', label: '来源 tab 复写具体法师身份', pattern: MAGE_WARS_MAGE_STANDARD_BOOK_RE },
      { id: 'count-badge-xn', label: '卡图数量角标 xN', pattern: /xN/g },
      { id: 'click-view-ability-card-copy', label: '法师详情入口不得复述点击动作', pattern: /点击查看能力牌|Click to view ability card/g },
      { id: 'hidden-diy-library-copy', label: '角落 DIY 法术书文案', pattern: /DIY\s*法术书/g },
      { id: 'blank-builder-primary-entry', label: '空白自组主入口', pattern: /空白自组/g },
      { id: 'old-diy-empty-state', label: '旧 DIY 空态', pattern: /还没有\s*DIY\s*法术书/g },
      { id: 'named-copy-empty-state', label: '命名副本空态文字不得替代加号入口', pattern: /暂无命名副本|No named copies/g },
      { id: 'redundant-current-spellbook-title', label: '选中态被复写为当前法术书', pattern: /当前法术书/g },
      { id: 'redundant-current-mage-library-title', label: '选中法师库被复写为当前法师法术书库', pattern: /当前法师法术书库/g },
      { id: 'redundant-edit-current-book', label: '编辑按钮复写当前书', pattern: /编辑当前书/g },
      { id: 'redundant-update-current-copy', label: '更新按钮复写当前副本', pattern: /更新当前副本/g },
      { id: 'redundant-name-current-book', label: '命名输入复写当前书', pattern: /给当前书取名/g },
      { id: 'redundant-save-from-current-book', label: '保存说明复写当前书', pattern: /新书从当前书/g },
      { id: 'new-book-from-selected-copy', label: '新建入口不得隐式沿用选中书', pattern: /新书从选中书|从选中书新建|从选中书保存命名副本|Create a named copy from the selected book|Save from selected book/g },
      { id: 'redundant-current-book-filter', label: '筛选项复写当前书内', pattern: /当前书内/g },
      { id: 'seat-owner', label: '组书页席位主控', pattern: /席位/g },
      { id: 'p1-owner', label: '组书页 P1 主控', pattern: /\bP1\b/g },
      { id: 'p2-owner', label: '组书页 P2 主控', pattern: /\bP2\b/g },
      { id: 'missing-art', label: '缺图占位', pattern: /缺图/g },
      { id: 'default-management-helper-copy', label: '主可见层不显示管理说明文案', pattern: /标准起始书和命名副本同级/g },
      { id: 'default-list-helper-copy', label: '主可见层不显示右侧清单解释文案', pattern: /真实缩略、数量上限/g },
      { id: 'default-scroll-helper-copy', label: '主可见层不显示滚动说明文案', pattern: /滚动查看整本书/g },
      { id: 'default-count-rule-copy', label: '主可见层不显示数量规则说明块', pattern: /数量：1级/g },
      { id: 'default-cost-rule-copy', label: '主可见层不显示成本规则说明块', pattern: /成本：受训/g },
      { id: 'redundant-scope-all-button', label: '主可见层不得出现第二套全部卡牌范围按钮', pattern: /全部卡牌/g },
    ],
    forbiddenSelectors: [
      { id: 'standalone-detail-button', label: '独立详情按钮', selector: '.mage-detail-trigger' },
      { id: 'builder-mage-switcher', label: '组书页内部法师切换器', selector: '[data-testid^="mage-wars-spellbook-builder-mage-option-"], .mage-option' },
      { id: 'redundant-scope-filter-row', label: '主可见层不得出现第二套范围按钮组', selector: '[data-testid="mage-wars-spellbook-builder-scope-filters"]' },
    ],
    requiredSelectors: [
      { id: 'hearthstone-comparison-topbar', label: '成熟组牌式紧凑顶栏', selector: '.builder-topbar[data-hearthstone-comparison="card-pool-deck-list"]' },
      { id: 'selected-mage-context-opens-detail', label: '已选法师主控打开规则卡', selector: '.mage-context[data-mage-detail-open]' },
      { id: 'selected-mage-context-visible-cue', label: '已选法师主控有详情视觉入口', selector: '[data-testid="mage-wars-spellbook-builder-mage-detail-cue"]' },
      { id: 'saved-spellbook-library', label: '同法师已保存法术书库', selector: '[data-testid="mage-wars-spellbook-builder-saved-library"]' },
      { id: 'saved-spellbook-library-toggle', label: '法术书库按需展开入口', selector: '[data-testid="mage-wars-spellbook-builder-saved-library-toggle"]' },
      { id: 'new-spellbook-plus-button', label: '组书器加号新建入口', selector: '[data-testid="mage-wars-spellbook-builder-new-spellbook"]' },
      { id: 'builder-new-spellbook-requires-mage-choice', label: '组书器新建法术书必须回到绑定法师选择', selector: '[data-testid="mage-wars-spellbook-builder-new-spellbook"][data-new-spellbook-mage-choice="required"]' },
      { id: 'spellpoint-capacity-owner', label: '顶部容量区总体法术点 owner', selector: '.capacity' },
      { id: 'mana-cost-filter', label: '法力费用筛选', selector: '[data-testid="mage-wars-spellbook-builder-filter-mana"]' },
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
    perItemRequiredSelectors: [
      {
        id: 'builder-saved-spellbook-diy-badge',
        label: '组书库命名副本必须显示 DIY 身份标记',
        parentSelector: '[data-testid="mage-wars-spellbook-builder-saved-spellbook"]',
        childSelector: '[data-testid="mage-wars-spellbook-builder-saved-spellbook-diy-badge"]',
      },
    ],
    numericAttributes: [
      {
        id: 'card-pool-min-card-width',
        label: '卡池普通法术卡最小网格宽度',
        selector: '[data-testid="mage-wars-spellbook-builder-card-pool-grid"]',
        attribute: 'data-min-card-width-rem',
        min: 10.5,
      },
      {
        id: 'builder-saved-spellbook-limit',
        label: '组书器命名法术书保存上限',
        selector: '[data-testid="mage-wars-spellbook-builder"]',
        attribute: 'data-saved-spellbook-limit',
        min: 10,
      },
    ],
  },
  'rolled-damage-resolution': {
    visibleMax: [
      {
        id: 'damage-total-visible-owner',
        label: '伤害骰合计唯一可见 owner',
        pattern: /伤害骰合计\s*\d+/g,
        max: 1,
      },
      {
        id: 'event-branch-visible-owner',
        label: '事件原文结果副标题唯一可见 owner',
        pattern: /受到(?:一颗|[一二三四五六\d]+\s*颗)骰子的(?:精神|物理)伤害/g,
        max: 1,
      },
    ],
    visibleForbidden: [
      { id: 'roll-kind-copy', label: '伤害骰阶段不得复写骰种标题', pattern: /重新投掷的伤害骰|重新投掷\s*\d+\s*颗骰子/g },
      { id: 'pending-allocation-copy', label: '伤害骰阶段不得提前显示待分配伤害', pattern: /待分配\s*\d+\s*点(?:精神|物理)伤害/g },
      { id: 'event-total-copy', label: '伤害骰阶段不得沿用事件总点数', pattern: /事件总点数/g },
      { id: 'subtotal-breakdown-copy', label: '伤害骰阶段不得复写骰面小计或固定加值', pattern: /骰面合计|加值/g },
    ],
    forbiddenSelectors: [
      { id: 'damage-dice-copy', label: '伤害骰阶段旧伤害骰说明块', selector: '[data-testid="betrayal-recent-roll-damage-dice"]' },
      { id: 'effect-damage-copy', label: '伤害骰阶段旧待分配说明块', selector: '[data-testid="betrayal-recent-roll-effect-damage"]' },
      { id: 'roll-breakdown-copy', label: '伤害骰阶段旧小计拆解块', selector: '[data-testid="betrayal-recent-roll-breakdown"]' },
      { id: 'damage-source-title', label: '伤害骰阶段不得把来源卡名当标题', selector: '[data-testid="betrayal-recent-roll-source-title"][data-result-role="event-damage-source-title"]' },
    ],
    requiredSelectors: [
      { id: 'damage-roll-panel', label: '伤害骰面板', selector: '[data-testid="betrayal-recent-roll-panel"][data-visible-dice-source="event-rolled-damage"]' },
      { id: 'damage-event-description', label: '伤害骰面板保留事件原文描述', selector: '[data-testid="betrayal-recent-roll-event-description"][data-result-role="event-damage-description"]' },
      { id: 'damage-event-effect', label: '伤害骰面板保留实际效果', selector: '[data-testid="betrayal-recent-roll-event-effect"][data-result-role="event-damage-effect"]' },
      { id: 'damage-total', label: '伤害骰合计', selector: '[data-testid="betrayal-recent-roll-total"]' },
      { id: 'damage-dice-group', label: '伤害骰由骰子本体承接', selector: '[data-testid="betrayal-house-dice-3d-group"][data-dice-count]' },
      { id: 'hidden-reroll-caption', label: '骰种说明只保留无障碍/隐藏承载', selector: '[data-testid="betrayal-reroll-prompt-outside-dice"][aria-hidden="true"]' },
    ],
    perItemRequiredSelectors: [],
    numericAttributes: [],
    selectorForbidden: [],
  },
  'damage-allocation': {
    visibleMax: [
      {
        id: 'mental-damage-amount-visible-owner',
        label: '精神伤害总额唯一可见 owner',
        pattern: /\d+\s*点精神伤害/g,
        max: 1,
      },
    ],
    visibleForbidden: [
      { id: 'trait-damage-button-copy', label: '属性刻度尺外不得复写承伤点数', pattern: /承担\s*\d+\s*点|×\d/g },
      { id: 'pending-allocation-copy', label: '分配阶段不得继续显示待分配句', pattern: /待分配\s*\d+\s*点精神伤害/g },
      { id: 'trait-damage-step-copy', label: '分配阶段不得显示机械步数文案', pattern: /[+-]\s*\d+\s*步|[+-]\s*\d+\s*steps/gi },
    ],
    forbiddenSelectors: [],
    requiredSelectors: [
      { id: 'allocation-panel', label: '精神伤害分配面板', selector: '[data-testid="betrayal-damage-allocation-panel"]' },
      { id: 'source-hidden-owner', label: '来源事件只作隐藏归属，不占主可见层', selector: '[data-testid="betrayal-damage-allocation-source"][data-visible-source-owner="discovery-card"].sr-only' },
      { id: 'knowledge-trait-owner', label: '知识刻度尺承接已选 1 点', selector: '[data-testid="betrayal-damage-allocation-trait-knowledge"][data-damage-selected-count="1"][data-trait-preview-step-count="1"]' },
      { id: 'sanity-trait-owner', label: '神志刻度尺承接已选 1 点', selector: '[data-testid="betrayal-damage-allocation-trait-sanity"][data-damage-selected-count="1"][data-trait-preview-step-count="1"]' },
      { id: 'knowledge-trait-increase', label: '知识刻度尺提供加号分配', selector: '[data-testid="betrayal-damage-allocation-trait-knowledge-increase"]' },
      { id: 'knowledge-trait-decrease', label: '知识刻度尺提供减号分配', selector: '[data-testid="betrayal-damage-allocation-trait-knowledge-decrease"]' },
      { id: 'knowledge-trait-count', label: '知识刻度尺内部承接已选数量', selector: '[data-testid="betrayal-damage-allocation-trait-knowledge-selected-count"]' },
      { id: 'sanity-trait-increase', label: '神志刻度尺提供加号分配', selector: '[data-testid="betrayal-damage-allocation-trait-sanity-increase"]' },
      { id: 'sanity-trait-decrease', label: '神志刻度尺提供减号分配', selector: '[data-testid="betrayal-damage-allocation-trait-sanity-decrease"]' },
      { id: 'sanity-trait-count', label: '神志刻度尺内部承接已选数量', selector: '[data-testid="betrayal-damage-allocation-trait-sanity-selected-count"]' },
    ],
    perItemRequiredSelectors: [],
    numericAttributes: [],
    selectorForbidden: [
      {
        id: 'traits-no-secondary-allocation-copy',
        label: '属性列表不得把刻度尺选择改写成第二套文字',
        selector: '[data-testid="betrayal-damage-allocation-traits"]',
        includeHidden: false,
        patterns: [/承担\s*\d+\s*点/g, /×\d/g, /[+-]\s*\d+\s*步/g, /[+-]\s*\d+\s*steps/gi],
      },
    ],
  },
};

function usage() {
  const names = Object.keys(RULESETS).join(', ');
  console.error(`用法: node .spec/tools/scan-ui-duplicate-owners.mjs --ruleset <${names}> <html-file>`);
  console.error('      node .spec/tools/scan-ui-duplicate-owners.mjs --self-check');
}

function parseArgs(argv) {
  let ruleset = 'deck-builder';
  let json = false;
  let selfCheck = false;
  const files = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ruleset') {
      ruleset = argv[i + 1];
      i += 1;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--self-check') {
      selfCheck = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (RULESETS[arg] && files.length === 0) {
      ruleset = arg;
    } else {
      files.push(arg);
    }
  }

  if (selfCheck) return { ruleset, json, files, selfCheck };
  if (!RULESETS[ruleset]) {
    usage();
    throw new Error(`未知 ruleset: ${ruleset}`);
  }
  if (files.length === 0) {
    usage();
    throw new Error('缺少 html-file');
  }

  return { ruleset, json, files, selfCheck };
}

function validatePattern(owner, rule, key = 'pattern') {
  const pattern = rule?.[key];
  if (!(pattern instanceof RegExp)) {
    throw new Error(`${owner}.${rule?.id || 'unknown'} 缺少 RegExp ${key}`);
  }
}

function validateArray(owner, ruleset, key) {
  if (!Array.isArray(ruleset[key])) {
    throw new Error(`${owner} 缺少数组字段 ${key}`);
  }
}

function runSelfCheck() {
  for (const [name, ruleset] of Object.entries(RULESETS)) {
    for (const key of [
      'visibleMax',
      'visibleForbidden',
      'forbiddenSelectors',
      'requiredSelectors',
      'selectorForbidden',
      'perItemRequiredSelectors',
      'numericAttributes',
    ]) {
      validateArray(name, ruleset, key);
    }

    for (const rule of ruleset.visibleMax) validatePattern(name, rule);
    for (const rule of ruleset.visibleForbidden) validatePattern(name, rule);
    for (const rule of ruleset.selectorForbidden) {
      if (!Array.isArray(rule.patterns)) {
        throw new Error(`${name}.${rule.id} 缺少 patterns 数组`);
      }
      for (const pattern of rule.patterns) {
        if (!(pattern instanceof RegExp)) {
          throw new Error(`${name}.${rule.id} patterns 包含非 RegExp`);
        }
      }
    }
  }
  return { ok: true, rulesets: Object.keys(RULESETS) };
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isHiddenElement(element) {
  for (let node = element; node; node = node.parentElement) {
    if (
      node.classList?.contains('sr-only')
      || node.classList?.contains('visually-hidden')
      || node.classList?.contains('hidden')
      || node.classList?.contains('invisible')
      || node.classList?.contains('opacity-0')
    ) return true;
    if (node.hasAttribute('hidden')) return true;
    if (node.getAttribute('aria-hidden') === 'true') return true;
    const style = (node.getAttribute('style') || '').replace(/\s+/g, '').toLowerCase();
    if (
      style.includes('display:none')
      || style.includes('visibility:hidden')
      || style.includes('opacity:0')
      || style.includes('clip:rect(0,0,0,0)')
      || style.includes('clip-path:inset(50%)')
    ) return true;
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

function runRuleset(file, rulesetName) {
  const absolute = resolve(file);
  const html = readFileSync(absolute, 'utf8');
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const ruleset = RULESETS[rulesetName];
  const visibleText = collectVisibleText(document, document.body);
  const violations = [];
  const checks = [];

  for (const rule of ruleset.visibleMax) {
    const count = countMatches(visibleText, rule.pattern);
    const ok = count <= rule.max;
    checks.push({ id: rule.id, label: rule.label, count, max: rule.max, ok });
    if (!ok) {
      violations.push(`${rule.label}: 默认可见文本命中 ${count} 次，最多允许 ${rule.max} 次`);
    }
  }

  for (const rule of ruleset.visibleForbidden) {
    const count = countMatches(visibleText, rule.pattern);
    const ok = count === 0;
    checks.push({ id: rule.id, label: rule.label, count, max: 0, ok });
    if (!ok) violations.push(`${rule.label}: 默认可见文本仍命中 ${count} 次`);
  }

  for (const rule of ruleset.forbiddenSelectors) {
    const count = document.querySelectorAll(rule.selector).length;
    const ok = count === 0;
    checks.push({ id: rule.id, label: rule.label, count, max: 0, ok });
    if (!ok) violations.push(`${rule.label}: 仍存在 ${count} 个 ${rule.selector}`);
  }

  for (const rule of ruleset.requiredSelectors) {
    const count = document.querySelectorAll(rule.selector).length;
    const ok = count > 0;
    checks.push({ id: rule.id, label: rule.label, count, min: 1, ok });
    if (!ok) violations.push(`${rule.label}: 未找到 ${rule.selector}`);
  }

  for (const rule of ruleset.selectorForbidden) {
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

  for (const rule of ruleset.perItemRequiredSelectors || []) {
    const parents = Array.from(document.querySelectorAll(rule.parentSelector));
    const missing = parents.filter((element) => !element.querySelector(rule.childSelector));
    const ok = missing.length === 0;
    checks.push({
      id: rule.id,
      label: `${rule.label}: parents=${parents.length}`,
      count: missing.length,
      max: 0,
      ok,
    });
    if (!ok) {
      violations.push(`${rule.label}: ${missing.length}/${parents.length} 个对象缺少 ${rule.childSelector}`);
    }
  }

  for (const rule of ruleset.numericAttributes || []) {
    const elements = Array.from(document.querySelectorAll(rule.selector));
    const values = elements.map((element) => Number(element.getAttribute(rule.attribute)));
    const invalid = values.filter((value) => !Number.isFinite(value) || value < rule.min);
    const ok = elements.length > 0 && invalid.length === 0;
    checks.push({
      id: rule.id,
      label: `${rule.label}: ${rule.attribute}>=${rule.min}`,
      count: elements.length - invalid.length,
      min: elements.length,
      ok,
    });
    if (!ok) {
      violations.push(`${rule.label}: ${rule.selector} 的 ${rule.attribute} 缺失或低于 ${rule.min}`);
    }
  }

  return {
    file: absolute,
    name: basename(absolute),
    ruleset: rulesetName,
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

if (parsed.selfCheck) {
  try {
    const result = runSelfCheck();
    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`OK UI duplicate owner rulesets: ${result.rulesets.join(', ')}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const results = parsed.files.map((file) => runRuleset(file, parsed.ruleset));
const ok = results.every((result) => result.ok);

if (parsed.json) {
  console.log(JSON.stringify({ ok, results }, null, 2));
} else {
  for (const result of results) {
    const status = result.ok ? 'OK' : 'FAIL';
    console.log(`${status} ${result.name} (${result.ruleset})`);
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
