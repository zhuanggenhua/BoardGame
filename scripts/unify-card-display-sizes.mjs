import { readFileSync, writeFileSync } from 'fs';

// 统一配置
const ACTION_CARD_WIDTH = '8.5vw';
const BASE_CARD_WIDTH = '14vw';
const CARD_GAP = '4';
const MAGNIFY_SIZE = '2vw';
const MAGNIFY_ICON_SIZE = '1.1vw';
const TITLE_SIZE = 'text-2xl';
const TITLE_MARGIN = 'mb-6';
const TEXT_SIZE = 'text-xs';
const TEXT_COLOR = 'text-white/80';

const files = [
  'src/games/smashup/ui/PromptOverlay.tsx',
  'src/games/smashup/ui/RevealOverlay.tsx',
];

for (const filePath of files) {
  console.log(`\n处理文件: ${filePath}`);
  let content = readFileSync(filePath, 'utf-8');
  let changed = false;

  // 1. 统一标题尺寸和间距
  const titlePatterns = [
    /text-xl font-black text-amber-100 uppercase tracking-tight mb-5/g,
    /text-base font-black text-amber-100 uppercase tracking-tight mb-3/g,
    /text-base font-black text-amber-100 uppercase tracking-tight mb-4/g,
  ];
  for (const pattern of titlePatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, `${TITLE_SIZE} font-black text-amber-100 uppercase tracking-tight ${TITLE_MARGIN}`);
      changed = true;
    }
  }

  // 2. 统一卡牌间距
  content = content.replace(/gap-3 overflow-x-auto/g, `gap-${CARD_GAP} overflow-x-auto`);
  content = content.replace(/gap-6 overflow-x-auto/g, `gap-${CARD_GAP} overflow-x-auto`);

  // 3. 统一放大镜按钮尺寸
  content = content.replace(/w-\[1\.4vw\] h-\[1\.4vw\]/g, `w-[${MAGNIFY_SIZE}] h-[${MAGNIFY_SIZE}]`);
  content = content.replace(/w-\[2vw\] h-\[2vw\]/g, `w-[${MAGNIFY_SIZE}] h-[${MAGNIFY_SIZE}]`);
  
  // 4. 统一放大镜图标尺寸
  content = content.replace(/w-\[0\.8vw\] h-\[0\.8vw\]/g, `w-[${MAGNIFY_ICON_SIZE}] h-[${MAGNIFY_ICON_SIZE}]`);
  content = content.replace(/w-\[1\.1vw\] h-\[1\.1vw\]/g, `w-[${MAGNIFY_ICON_SIZE}] h-[${MAGNIFY_ICON_SIZE}]`);

  // 5. 统一放大镜按钮位置
  content = content.replace(/-top-\[0\.4vw\] -right-\[0\.4vw\]/g, '-top-[0.5vw] -right-[0.5vw]');

  // 6. 统一放大镜按钮样式
  content = content.replace(/bg-black\/60 hover:bg-amber-500\/80/g, 'bg-black/70 hover:bg-amber-500/90');
  content = content.replace(/border border-white\/20/g, 'border-2 border-white/30');

  // 7. 统一文字尺寸和颜色
  content = content.replace(/text-\[10px\] font-bold/g, `${TEXT_SIZE} font-bold`);
  content = content.replace(/text-\[11px\] font-bold/g, `${TEXT_SIZE} font-bold`);
  content = content.replace(/text-white\/70/g, TEXT_COLOR);

  // 8. 统一描边尺寸
  content = content.replace(/ring-1 ring-white\/20/g, 'ring-2 ring-white/20');
  content = content.replace(/ring-3 ring-amber-400/g, 'ring-4 ring-amber-400');

  // 9. 统一阴影效果
  content = content.replace(/shadow-\[0_0_16px_rgba\(251,191,36,0\.5\)\]/g, 'shadow-[0_0_20px_rgba(251,191,36,0.6)]');

  // 10. 统一 gap 间距
  content = content.replace(/gap-1 group/g, 'gap-1.5 group');
  content = content.replace(/gap-1\.5 group/g, 'gap-1.5 group'); // 确保一致

  if (changed || content !== readFileSync(filePath, 'utf-8')) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ 已更新`);
  } else {
    console.log(`⏭️  无需更新`);
  }
}

console.log('\n✅ 所有文件已统一卡牌展示尺寸！');
console.log(`\n配置：`);
console.log(`  - 行动卡/随从: ${ACTION_CARD_WIDTH}`);
console.log(`  - 基地: ${BASE_CARD_WIDTH}`);
console.log(`  - 间距: gap-${CARD_GAP}`);
console.log(`  - 放大镜: ${MAGNIFY_SIZE}`);
console.log(`  - 标题: ${TITLE_SIZE} ${TITLE_MARGIN}`);
console.log(`  - 文字: ${TEXT_SIZE} ${TEXT_COLOR}`);
