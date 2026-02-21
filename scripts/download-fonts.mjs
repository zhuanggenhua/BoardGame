/**
 * 下载 Google Fonts 到本地（仅 latin 子集），生成精简 @font-face CSS
 * 用法: node scripts/download-fonts.mjs
 * 
 * 只下载项目实际使用的字体+字重+子集（仅 latin）：
 * - Crimson Text: 400/600/700 normal + 400 italic（body 默认衬线体）
 * - Inter: 400/500/600/700/900（UI/标题无衬线体）
 * - Cinzel: 400/700（王权骰铸 display 字体）
 * - Bebas Neue: 400（召唤师战争 display 字体）
 * - Bangers: 400（大杀四方 display 字体）
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import https from 'https';

const FONTS_DIR = 'public/fonts';
mkdirSync(FONTS_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 项目使用的全部字体
// - Crimson Text: body 默认衬线体（羊皮纸风格）
// - Inter: UI/标题无衬线体
// - Cinzel: 古典/奇幻风格标题（王权骰铸）
// - Bebas Neue: 硬朗/战术风格（召唤师战争、通用 HUD）
// - Bangers: 漫画/搞怪风格（大杀四方）
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&display=swap',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
  'https://fonts.googleapis.com/css2?family=Bangers&display=swap',
];

// 只保留 latin 子集（中英文用户够用）
const KEEP_SUBSETS = new Set(['latin']);

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBinary(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * 解析 Google Fonts CSS，按 subset 注释分块
 * 返回 [{ subset, css }]
 */
function parseFontFaceBlocks(css) {
  const blocks = [];
  // Google Fonts CSS 格式: /* subset-name */ @font-face { ... }
  const regex = /\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    blocks.push({ subset: match[1], css: match[2] });
  }
  return blocks;
}

async function main() {
  let allCss = '/* 自托管 Google Fonts — 避免国内用户加载 fonts.googleapis.com 被阻塞 */\n';
  allCss += '/* 仅包含 latin 子集（中英文用户够用），精简文件数量 */\n\n';
  let fileIndex = 0;
  let totalSize = 0;

  for (const url of FONT_URLS) {
    console.log(`获取 CSS: ${url.split('?')[1]?.slice(0, 60)}...`);
    const css = await fetchText(url);
    const blocks = parseFontFaceBlocks(css);
    
    console.log(`  共 ${blocks.length} 个 @font-face 块`);
    
    for (const block of blocks) {
      if (!KEEP_SUBSETS.has(block.subset)) {
        continue;
      }
      
      // 提取 url() 并下载字体文件
      let processedCss = block.css;
      const fontUrlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
      let urlMatch;
      
      while ((urlMatch = fontUrlRegex.exec(block.css)) !== null) {
        const fontUrl = urlMatch[1];
        // 从 font-face 中提取字体名和字重用于命名
        const familyMatch = processedCss.match(/font-family:\s*'([^']+)'/);
        const weightMatch = processedCss.match(/font-weight:\s*(\d+)/);
        const styleMatch = processedCss.match(/font-style:\s*(\w+)/);
        
        const family = (familyMatch?.[1] || 'font').toLowerCase().replace(/\s+/g, '-');
        const weight = weightMatch?.[1] || '400';
        const style = styleMatch?.[1] === 'italic' ? '-italic' : '';
        const filename = `${family}-${weight}${style}-latin.woff2`;
        
        console.log(`  下载: ${filename}`);
        const data = await fetchBinary(fontUrl);
        writeFileSync(join(FONTS_DIR, filename), data);
        totalSize += data.length;
        
        processedCss = processedCss.replace(fontUrl, `/fonts/${filename}`);
        fileIndex++;
      }
      
      allCss += `/* ${block.subset} */\n${processedCss}\n\n`;
    }
  }

  writeFileSync('src/fonts.css', allCss, 'utf-8');
  console.log(`\n完成！`);
  console.log(`  字体文件: ${fileIndex} 个，共 ${(totalSize / 1024).toFixed(1)} KB`);
  console.log(`  CSS: src/fonts.css`);
  console.log(`  字体目录: ${FONTS_DIR}/`);
}

main().catch(console.error);
