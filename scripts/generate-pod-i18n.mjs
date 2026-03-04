#!/usr/bin/env node
/**
 * 为 POD 派系卡牌生成 i18n 条目
 * POD 卡牌复用原版卡牌的翻译，只是 ID 加了 _pod 后缀
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 读取中英文 i18n 文件
const zhPath = join(rootDir, 'public/locales/zh-CN/game-smashup.json');
const enPath = join(rootDir, 'public/locales/en/game-smashup.json');

const zhData = JSON.parse(readFileSync(zhPath, 'utf-8'));
const enData = JSON.parse(readFileSync(enPath, 'utf-8'));

// 确保 cards 对象存在
if (!zhData.cards) zhData.cards = {};
if (!enData.cards) enData.cards = {};

// 从所有 POD 派系文件中提取卡牌 ID
const factionsDir = join(rootDir, 'src/games/smashup/data/factions');
const podFiles = readdirSync(factionsDir).filter(f => f.endsWith('_pod.ts'));

const allPodCardIds = new Set();

for (const file of podFiles) {
    const content = readFileSync(join(factionsDir, file), 'utf-8');
    // 提取所有 id: 'xxx_pod' 的卡牌
    const matches = content.matchAll(/id:\s*['"]([a-z_]+_pod)['"]/g);
    for (const match of matches) {
        allPodCardIds.add(match[1]);
    }
}

console.log(`📋 找到 ${allPodCardIds.size} 张 POD 卡牌`);

let addedZh = 0;
let addedEn = 0;
let skipped = 0;

// 为每个 POD 卡牌创建 i18n 条目
for (const podId of allPodCardIds) {
    const originalId = podId.replace(/_pod$/, '');
    
    // 中文
    if (zhData.cards[originalId]) {
        if (!zhData.cards[podId]) {
            zhData.cards[podId] = { ...zhData.cards[originalId] };
            addedZh++;
        } else {
            skipped++;
        }
    } else {
        console.warn(`⚠️  原版卡牌 ${originalId} 在 zh-CN 中不存在`);
    }
    
    // 英文
    if (enData.cards[originalId]) {
        if (!enData.cards[podId]) {
            enData.cards[podId] = { ...enData.cards[originalId] };
            addedEn++;
        }
    } else {
        console.warn(`⚠️  原版卡牌 ${originalId} 在 en 中不存在`);
    }
}

// 写回文件
writeFileSync(zhPath, JSON.stringify(zhData, null, 2) + '\n', 'utf-8');
writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n', 'utf-8');

console.log(`✅ zh-CN: 新增 ${addedZh} 条，跳过 ${skipped} 条`);
console.log(`✅ en: 新增 ${addedEn} 条`);
console.log(`✅ 完成！`);
