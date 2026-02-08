#!/usr/bin/env node
/**
 * 卡牌多语言生成脚本
 * 
 * 从 cards.ts 的 i18n 字段读取卡牌文案，生成/更新 locale JSON 的 cards 部分。
 * 保持卡牌配置与文案的单一数据源。
 * 
 * 使用方式：
 *   node scripts/game/generate-card-locales.cjs
 *   npm run generate:locales
 */

const fs = require('fs');
const path = require('path');

// 路径配置
const CARDS_FILE = path.join(__dirname, '../..', 'src', 'games', 'dicethrone', 'monk', 'cards.ts');
const LOCALES_DIR = path.join(__dirname, '../..', 'public', 'locales');
const LOCALE_FILE_NAME = 'game-dicethrone.json';

// 支持的语言列表（与 src/lib/i18n/types.ts 保持一致）
const SUPPORTED_LANGUAGES = ['zh-CN', 'en'];

/**
 * 从 cards.ts 提取卡牌 i18n 数据
 * 使用正则匹配 i18n 块，只匹配 card- 开头的卡牌 ID
 */
function extractCardI18n(cardsFileContent) {
    const cards = {};
    
    // 匹配每个卡牌定义块（只匹配 card- 开头的 ID，排除技能定义）
    // 匹配模式: id: 'card-xxx', ... i18n: { ... }
    const cardBlockRegex = /{\s*id:\s*'(card-[^']+)',[\s\S]*?i18n:\s*{([\s\S]*?)},\s*(?:\/\/.*\n\s*)?(?:playCondition|effects)/g;
    
    let match;
    while ((match = cardBlockRegex.exec(cardsFileContent)) !== null) {
        const cardId = match[1];
        const i18nBlock = match[2];
        
        // 提取每个语言的 name 和 description
        // 支持转义单引号（如 opponent\'s）
        const langRegex = /'([^']+)':\s*{\s*name:\s*'((?:[^'\\]|\\.)*)',\s*description:\s*'((?:[^'\\]|\\.)*)'\s*}/g;
        let langMatch;
        
        while ((langMatch = langRegex.exec(i18nBlock)) !== null) {
            const lang = langMatch[1];
            // 去除转义字符（如 \\' -> '）
            const name = langMatch[2].replace(/\\'/g, "'");
            const description = langMatch[3].replace(/\\'/g, "'");
            
            if (!cards[lang]) {
                cards[lang] = {};
            }
            cards[lang][cardId] = { name, description };
        }
    }
    
    return cards;
}

/**
 * 更新 locale JSON 文件的 cards 部分
 */
function updateLocaleFile(lang, cardTexts) {
    const localeFilePath = path.join(LOCALES_DIR, lang, LOCALE_FILE_NAME);
    
    if (!fs.existsSync(localeFilePath)) {
        console.log(`⚠️  跳过 ${lang}: 文件不存在 ${localeFilePath}`);
        return false;
    }
    
    // 读取现有 locale 文件
    const localeContent = fs.readFileSync(localeFilePath, 'utf-8');
    const localeData = JSON.parse(localeContent);
    
    // 保留 cards 下的非卡牌字段（如 actions, hints）
    const existingCards = localeData.cards || {};
    const preservedFields = {};
    
    for (const key of Object.keys(existingCards)) {
        // 保留非 card- 开头的字段
        if (!key.startsWith('card-')) {
            preservedFields[key] = existingCards[key];
        }
    }
    
    // 构建新的 cards 对象：先放卡牌，再放保留字段
    const newCards = {};
    
    // 添加卡牌文案
    for (const [cardId, texts] of Object.entries(cardTexts)) {
        newCards[cardId] = texts;
    }
    
    // 添加保留字段（actions, hints 等）
    for (const [key, value] of Object.entries(preservedFields)) {
        newCards[key] = value;
    }
    
    // 更新 locale 数据
    localeData.cards = newCards;
    
    // 写回文件（保持格式化）
    fs.writeFileSync(localeFilePath, JSON.stringify(localeData, null, 2) + '\n', 'utf-8');
    
    return true;
}

// 主程序
console.log('📦 从 cards.ts 生成卡牌多语言...\n');

// 读取 cards.ts
if (!fs.existsSync(CARDS_FILE)) {
    console.error(`❌ 错误: 找不到 cards.ts 文件: ${CARDS_FILE}`);
    process.exit(1);
}

const cardsContent = fs.readFileSync(CARDS_FILE, 'utf-8');

// 提取 i18n 数据
const cardI18n = extractCardI18n(cardsContent);

// 统计
let totalCards = 0;
for (const lang of SUPPORTED_LANGUAGES) {
    if (cardI18n[lang]) {
        const count = Object.keys(cardI18n[lang]).length;
        totalCards = Math.max(totalCards, count);
        console.log(`  ${lang}: 找到 ${count} 张卡牌文案`);
    } else {
        console.log(`  ${lang}: 无卡牌文案`);
    }
}

if (totalCards === 0) {
    console.log('\n⚠️  警告: 未找到任何卡牌 i18n 数据');
    console.log('请确保 cards.ts 中的卡牌定义包含 i18n 字段');
    process.exit(0);
}

console.log('');

// 更新每个语言的 locale 文件
let successCount = 0;
for (const lang of SUPPORTED_LANGUAGES) {
    if (cardI18n[lang]) {
        const success = updateLocaleFile(lang, cardI18n[lang]);
        if (success) {
            console.log(`✅ 已更新 ${lang}/${LOCALE_FILE_NAME}`);
            successCount++;
        }
    }
}

console.log(`\n🎉 完成！已更新 ${successCount} 个语言文件，共 ${totalCards} 张卡牌。`);
