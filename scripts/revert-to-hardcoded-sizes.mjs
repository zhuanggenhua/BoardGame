#!/usr/bin/env node
/**
 * 将所有动态类名改回硬编码值
 * Tailwind JIT 需要完整的类名字符串才能生成样式
 */

import { readFileSync, writeFileSync } from 'fs';

const file = 'src/games/smashup/ui/PromptOverlay.tsx';
console.log(`修复文件: ${file}`);

let content = readFileSync(file, 'utf-8');

// 将所有模板字符串改回硬编码值
const fixes = [
  // 1. 放大镜按钮尺寸
  {
    from: /\$\{CARD_DISPLAY_CONFIG\.MAGNIFY_BUTTON_SIZE\}/g,
    to: 'w-[2vw] h-[2vw]',
  },
  // 2. 放大镜图标尺寸
  {
    from: /\$\{CARD_DISPLAY_CONFIG\.MAGNIFY_ICON_SIZE\}/g,
    to: 'w-[1.1vw] h-[1.1vw]',
  },
  // 3. 内联模式上下文卡图
  {
    from: /className=\{`w-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_WIDTH\}\] aspect-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_ASPECT\}\] rounded shadow/g,
    to: 'className="w-[8.5vw] aspect-[0.714] rounded shadow',
  },
  // 4. 卡牌选择模式的 max-width（嵌套模板字符串）
  {
    from: /\$\{isBase \? `max-w-\[\$\{CARD_DISPLAY_CONFIG\.BASE_CARD_WIDTH\}\]` : `max-w-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_WIDTH\}\]`\}/g,
    to: '${isBase ? \'max-w-[14vw]\' : \'max-w-[8.5vw]\'}',
  },
];

let modified = false;
for (const { from, to } of fixes) {
  const before = content;
  content = content.replace(from, to);
  if (content !== before) {
    modified = true;
    console.log(`  ✓ 修复动态类名`);
  }
}

if (modified) {
  writeFileSync(file, content, 'utf-8');
  console.log(`✅ 已保存`);
} else {
  console.log(`⏭️  无需修改`);
}
