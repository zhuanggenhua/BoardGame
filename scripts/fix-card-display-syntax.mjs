#!/usr/bin/env node
/**
 * 修复卡牌展示尺寸的语法错误
 * 将错误的模板字符串替换为正确的格式
 */

import { readFileSync, writeFileSync } from 'fs';

const file = 'src/games/smashup/ui/PromptOverlay.tsx';
console.log(`修复文件: ${file}`);

let content = readFileSync(file, 'utf-8');

// 修复 className 中的模板字符串语法错误
const fixes = [
  // 1. displayCards 模式的卡牌尺寸
  {
    from: /className=\{`w-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_WIDTH\}\] aspect-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_ASPECT\}\]`\} bg-slate-900 rounded"/g,
    to: 'className={`w-[${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}] aspect-[${CARD_DISPLAY_CONFIG.ACTION_CARD_ASPECT}] bg-slate-900 rounded`}',
  },
  // 2. 放大镜按钮 - displayCards 模式
  {
    from: /className="absolute -top-\[0\.5vw\] -right-\[0\.5vw\] \$\{CARD_DISPLAY_CONFIG\.MAGNIFY_BUTTON_SIZE\} flex/g,
    to: 'className={`absolute -top-[0.5vw] -right-[0.5vw] ${CARD_DISPLAY_CONFIG.MAGNIFY_BUTTON_SIZE} flex',
  },
  // 3. 放大镜图标 - displayCards 模式
  {
    from: /className="\$\{CARD_DISPLAY_CONFIG\.MAGNIFY_ICON_SIZE\} fill-current"/g,
    to: 'className={`${CARD_DISPLAY_CONFIG.MAGNIFY_ICON_SIZE} fill-current`}',
  },
  // 4. 卡牌名称 max-width - displayCards 模式
  {
    from: /className=\{`text-xs font-bold max-w-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_WIDTH\}\] truncate/g,
    to: 'className={`text-xs font-bold max-w-[${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}] truncate',
  },
  // 5. 内联模式上下文卡图
  {
    from: /className=\{`w-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_WIDTH\}\] aspect-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_ASPECT\}\]`\} rounded shadow/g,
    to: 'className={`w-[${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}] aspect-[${CARD_DISPLAY_CONFIG.ACTION_CARD_ASPECT}] rounded shadow',
  },
  // 6. 卡牌选择模式 - 多选勾选标记
  {
    from: /className="absolute -top-\[0\.5vw\] -right-\[0\.5vw\] \$\{CARD_DISPLAY_CONFIG\.MAGNIFY_BUTTON_SIZE\} bg-amber-400/g,
    to: 'className={`absolute -top-[0.5vw] -right-[0.5vw] ${CARD_DISPLAY_CONFIG.MAGNIFY_BUTTON_SIZE} bg-amber-400',
  },
  // 7. 卡牌选择模式 - 放大镜按钮
  {
    from: /className="absolute -top-\[0\.5vw\] -right-\[0\.5vw\] \$\{CARD_DISPLAY_CONFIG\.MAGNIFY_BUTTON_SIZE\} flex items-center justify-center bg-black\/70 hover:bg-amber-500\/90/g,
    to: 'className={`absolute -top-[0.5vw] -right-[0.5vw] ${CARD_DISPLAY_CONFIG.MAGNIFY_BUTTON_SIZE} flex items-center justify-center bg-black/70 hover:bg-amber-500/90',
  },
  // 8. 修复 max-w 中遗留的硬编码
  {
    from: /\$\{isBase \? 'max-w-\[14vw\]' : 'max-w-\[\$\{CARD_DISPLAY_CONFIG\.ACTION_CARD_WIDTH\}\]'\}/g,
    to: '${isBase ? `max-w-[${CARD_DISPLAY_CONFIG.BASE_CARD_WIDTH}]` : `max-w-[${CARD_DISPLAY_CONFIG.ACTION_CARD_WIDTH}]`}',
  },
];

let modified = false;
for (const { from, to } of fixes) {
  const before = content;
  content = content.replace(from, to);
  if (content !== before) {
    modified = true;
    console.log(`  ✓ 修复语法错误`);
  }
}

if (modified) {
  writeFileSync(file, content, 'utf-8');
  console.log(`✅ 已保存`);
} else {
  console.log(`⏭️  无需修改`);
}
