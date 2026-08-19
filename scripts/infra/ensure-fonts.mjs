import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cssPath = join(repoRoot, 'src/fonts.css');
const css = readFileSync(cssPath, 'utf8');
const fontUrls = [...css.matchAll(/url\((\/fonts\/[^)]+)\)/g)]
  .map((match) => match[1])
  .filter(Boolean);

const missingFonts = fontUrls.filter((url) => !existsSync(join(repoRoot, 'public', url.slice(1))));

if (missingFonts.length === 0) {
  process.exit(0);
}

console.log(`[ensure-fonts] 缺少 ${missingFonts.length} 个字体文件，开始生成 public/fonts`);

const result = spawnSync(process.execPath, [join(repoRoot, 'scripts/download-fonts.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const stillMissing = fontUrls.filter((url) => !existsSync(join(repoRoot, 'public', url.slice(1))));

if (stillMissing.length > 0) {
  console.error(`[ensure-fonts] 字体生成后仍缺少: ${stillMissing.join(', ')}`);
  process.exit(1);
}
