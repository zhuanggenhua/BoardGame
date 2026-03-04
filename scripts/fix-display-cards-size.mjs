import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/ui/PromptOverlay.tsx';
const content = readFileSync(filePath, 'utf-8');

// 修改通用卡牌展示模式的样式
let updated = content
  // 标题从 text-base 改为 text-xl，mb-3 改为 mb-4
  .replace(
    /<h2 className="text-center text-base font-black text-amber-100 uppercase tracking-tight mb-3 drop-shadow-lg">\s*\{displayCards\.title\}/,
    '<h2 className="text-center text-xl font-black text-amber-100 uppercase tracking-tight mb-4 drop-shadow-lg">\n                            {displayCards.title}'
  )
  // gap-3 改为 gap-4
  .replace(
    /className="flex gap-3 overflow-x-auto max-w-\[90vw\] mx-auto px-4 py-3 smashup-h-scrollbar/,
    'className="flex gap-4 overflow-x-auto max-w-[90vw] mx-auto px-4 py-3 smashup-h-scrollbar'
  )
  // gap-1 改为 gap-1.5
  .replace(
    /className=\{`flex-shrink-0 flex flex-col items-center gap-1 group relative/,
    'className={`flex-shrink-0 flex flex-col items-center gap-1.5 group relative'
  )
  // ring-3 改为 ring-4，ring-1 改为 ring-2
  .replace(
    /ring-3 ring-amber-400 shadow-\[0_0_16px_rgba\(251,191,36,0\.5\)\]/,
    'ring-4 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]'
  )
  .replace(
    /: 'ring-1 ring-white\/20 group-hover:ring-white\/50/,
    ": 'ring-2 ring-white/20 group-hover:ring-white/50"
  )
  // 放大镜按钮尺寸：-top-[0.4vw] -right-[0.4vw] w-[1.4vw] h-[1.4vw] 改为 -top-[0.5vw] -right-[0.5vw] w-[2vw] h-[2vw]
  .replace(
    /className="absolute -top-\[0\.4vw\] -right-\[0\.4vw\] w-\[1\.4vw\] h-\[1\.4vw\] flex items-center justify-center bg-black\/60 hover:bg-amber-500\/80/,
    'className="absolute -top-[0.5vw] -right-[0.5vw] w-[2vw] h-[2vw] flex items-center justify-center bg-black/70 hover:bg-amber-500/90'
  )
  // 放大镜图标尺寸：w-[0.8vw] h-[0.8vw] 改为 w-[1.1vw] h-[1.1vw]
  .replace(
    /<svg className="w-\[0\.8vw\] h-\[0\.8vw\] fill-current" viewBox="0 0 20 20">\s*<path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110\.89 3\.476l4\.817 4\.817a1 1 0 01-1\.414 1\.414l-4\.816-4\.816A6 6 0 012 8z" clipRule="evenodd" \/>/,
    '<svg className="w-[1.1vw] h-[1.1vw] fill-current" viewBox="0 0 20 20">\n                                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />'
  )
  // 文字样式：text-[10px] 改为 text-xs，text-white/70 改为 text-white/80
  .replace(
    /<span className=\{`text-\[10px\] font-bold max-w-\[8\.5vw\] truncate text-center \$\{isSel \? 'text-amber-300' : 'text-white\/70'\}`\>/,
    '<span className={`text-xs font-bold max-w-[8.5vw] truncate text-center ${isSel ? \'text-amber-300\' : \'text-white/80\'}`}>'
  )
  // mt-3 改为 mt-4
  .replace(
    /<div className="flex items-center justify-center gap-3 mt-3">\s*\{selUid && displayCards\.selectHint/,
    '<div className="flex items-center justify-center gap-3 mt-4">\n                            {selUid && displayCards.selectHint'
  )
  // border 改为 border-2
  .replace(
    /shadow-lg border border-white\/20 z-40 cursor-zoom-in"/,
    'shadow-lg border-2 border-white/30 z-40 cursor-zoom-in"'
  );

writeFileSync(filePath, updated, 'utf-8');
console.log('✅ 已更新 displayCards 卡牌展示尺寸');
