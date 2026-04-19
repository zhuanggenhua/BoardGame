import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const assetsDir = path.join(repoRoot, 'dist', 'assets');
const cssAssets = readdirSync(assetsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
  .map((entry) => path.join('assets', entry.name));

if (cssAssets.length === 0) {
  throw new Error('[dicethrone-style-contract] dist/assets 下没有找到 CSS 产物');
}

let cssBundle = '';
for (const cssFile of cssAssets) {
  const absolutePath = path.join(repoRoot, 'dist', cssFile);
  cssBundle += readFileSync(absolutePath, 'utf8');
  cssBundle += '\n';
}

const requiredPatterns = [
  {
    name: '生命条横向渐变 utility',
    pattern: '.bg-gradient-to-r{',
  },
  {
    name: '按钮纵向渐变 utility',
    pattern: '.bg-gradient-to-b{',
  },
  {
    name: 'HUD 血条高度 arbitrary utility',
    pattern: '.h-\\[1\\.8vw\\]{',
  },
  {
    name: 'HUD 面板圆角 arbitrary utility',
    pattern: '.rounded-\\[1\\.2vw\\]{',
  },
  {
    name: '阶段按钮宽度 arbitrary utility',
    pattern: '.w-\\[10\\.2vw\\]{',
  },
  {
    name: '阶段按钮高度 arbitrary utility',
    pattern: '.h-\\[2\\.5vw\\]{',
  },
  {
    name: '阶段按钮阴影 arbitrary utility',
    pattern: '.shadow-\\[0_4px_0_\\#b45309\\]{',
  },
  {
    name: '渐变变量默认值',
    pattern: '--tw-gradient-stops:initial',
  },
  {
    name: '阴影变量默认值',
    pattern: '--tw-shadow:0 0 #0000',
  },
];

const missing = requiredPatterns
  .filter(({ pattern }) => !cssBundle.includes(pattern))
  .map(({ name }) => name);

if (missing.length > 0) {
  console.error('[dicethrone-style-contract] 以下样式合同未进入构建产物:');
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log(`[dicethrone-style-contract] 样式合同检查通过，共扫描 ${cssAssets.length} 个 CSS 产物`);
