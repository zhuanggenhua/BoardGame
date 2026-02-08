/**
 * 合并音效翻译到主文件
 *
 * 用法：
 *   node scripts/audio/merge_audio_translations.js <batch_file.json>
 *
 * batch_file.json 格式：
 *   { "translations": { "English Stem": "中文翻译", ... } }
 *
 * 不传参数时，仅打印当前翻译统计。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mappingsPath = path.join(__dirname, '../../public/assets/common/audio/phrase-mappings.zh-CN.json');
const mainFile = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

const batchArg = process.argv[2];

if (!batchArg) {
  console.log(`[翻译统计] 当前翻译数: ${Object.keys(mainFile.phrases).length}`);
  console.log(`[翻译统计] 用法: node scripts/audio/merge_audio_translations.js <batch.json>`);
  process.exit(0);
}

const batchPath = path.resolve(batchArg);
if (!fs.existsSync(batchPath)) {
  console.error(`[错误] 文件不存在: ${batchPath}`);
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(batchPath, 'utf-8'));
const translations = batch.translations ?? batch.phrases ?? {};

let added = 0;
let updated = 0;

for (const [en, zh] of Object.entries(translations)) {
  if (!zh || String(zh).trim() === '') continue;
  if (!mainFile.phrases[en]) {
    added++;
  } else if (mainFile.phrases[en] !== zh) {
    updated++;
  }
  mainFile.phrases[en] = zh;
}

mainFile.version = (mainFile.version || 1) + 1;
mainFile.generatedAt = new Date().toISOString();

fs.writeFileSync(mappingsPath, JSON.stringify(mainFile, null, 2));

console.log(`[合并完成] 新增: ${added}  更新: ${updated}  总计: ${Object.keys(mainFile.phrases).length}`);
