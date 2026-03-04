#!/usr/bin/env node
/**
 * 统一所有卡牌展示界面的尺寸
 * 
 * 目标：所有弹窗、展示、选择界面的卡牌尺寸与手牌区域保持一致
 * - 行动卡/随从：8.5vw（与手牌一致）
 * - 基地卡：14vw（与场上基地一致）
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
  'src/games/smashup/ui/RevealOverlay.tsx',
  'src/games/smashup/ui/PromptOverlay.tsx',
];

const ACTION_CARD_WIDTH = '8.5vw';
const BASE_CARD_WIDTH = '14vw';

for (const file of files) {
  console.log(`\n处理文件: ${file}`);
  let content = readFileSync(file, 'utf-8');
  let modified = false;

  // 1. 添加 import（如果没有）
  if (!content.includes('import { CARD_DISPLAY_CONFIG }')) {
    content = content.replace(
      /(import.*from.*'\.\/CardMagnifyOverlay';)/,
      `$1\nimport { CARD_DISPLAY_CONFIG } from './cardDisplayConfig';`
    );
    modified = true;
    console.log('  ✓ 添加 CARD_DISPLAY_CONFIG import');
  }

  // 2. 替换硬编码的卡牌宽度
  const replacements = [
    // RevealOverlay 和 PromptOverlay 中的动态尺寸计算
    {
      from: /const cardWidth = isBase \? 'w-\[14vw\]' : 'w-\[8\.5vw\]';/g,
      to: `const cardWidth = isBase ? \`w-[\${CARD_DISPLAY_CONFIG.BASE_CARD_WIDTH}]\` : \`w-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}]\`;`,
      desc: '卡牌宽度'
    },
    {
      from: /const cardAspect = isBase \? 'aspect-\[1\.43\]' : 'aspect-\[0\.714\]';/g,
      to: `const cardAspect = isBase ? \`aspect-[\${CARD_DISPLAY_CONFIG.BASE_CARD_ASPECT}]\` : \`aspect-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_ASPECT}]\`;`,
      desc: '卡牌宽高比'
    },
    {
      from: /const maxWidth = isBase \? 'max-w-\[14vw\]' : 'max-w-\[8\.5vw\]';/g,
      to: `const maxWidth = isBase ? \`max-w-[\${CARD_DISPLAY_CONFIG.BASE_CARD_WIDTH}]\` : \`max-w-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}]\`;`,
      desc: '最大宽度'
    },
    // PromptOverlay displayCards 模式中的固定尺寸
    {
      from: /className="w-\[8\.5vw\] aspect-\[0\.714\]/g,
      to: `className={\`w-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}] aspect-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_ASPECT}]\`}`,
      desc: 'displayCards 卡牌尺寸'
    },
    {
      from: /max-w-\[8\.5vw\]/g,
      to: `max-w-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}]`,
      desc: 'displayCards 最大宽度'
    },
    // PromptOverlay 内联模式中的上下文卡图
    {
      from: /className="w-\[180px\] aspect-\[0\.714\]/g,
      to: `className={\`w-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}] aspect-[\${CARD_DISPLAY_CONFIG.ACTION_CARD_ASPECT}]\`}`,
      desc: '内联模式上下文卡图'
    },
    // 放大镜按钮尺寸
    {
      from: /w-\[2vw\] h-\[2vw\]/g,
      to: `\${CARD_DISPLAY_CONFIG.MAGNIFY_BUTTON_SIZE}`,
      desc: '放大镜按钮尺寸'
    },
    {
      from: /w-\[1\.1vw\] h-\[1\.1vw\]/g,
      to: `\${CARD_DISPLAY_CONFIG.MAGNIFY_ICON_SIZE}`,
      desc: '放大镜图标尺寸'
    },
  ];

  for (const { from, to, desc } of replacements) {
    const before = content;
    content = content.replace(from, to);
    if (content !== before) {
      modified = true;
      console.log(`  ✓ 替换 ${desc}`);
    }
  }

  if (modified) {
    writeFileSync(file, content, 'utf-8');
    console.log(`  ✅ 已保存`);
  } else {
    console.log(`  ⏭️  无需修改`);
  }
}

console.log('\n✅ 所有文件处理完成');
