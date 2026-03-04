#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

// 读取 TTS 存档文件
const ttsPath = 'public/assets/atlas-configs/smashup/2833984701.json';
const content = readFileSync(ttsPath, 'utf-8');
const ttsData = JSON.parse(content);

// 提取所有 CustomDeck 配置
const customDecks = new Map();

function extractCustomDecks(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    if (obj.CustomDeck) {
        for (const [deckId, config] of Object.entries(obj.CustomDeck)) {
            if (config.NumWidth && config.NumHeight) {
                customDecks.set(deckId, {
                    cols: config.NumWidth,
                    rows: config.NumHeight,
                    faceURL: config.FaceURL
                });
            }
        }
    }
    
    // 递归遍历
    for (const value of Object.values(obj)) {
        if (typeof value === 'object') {
            extractCustomDecks(value);
        }
    }
}

console.log('正在解析 TTS 存档...');
extractCustomDecks(ttsData);

console.log(`找到 ${customDecks.size} 个图集配置`);

// 生成 pod-atlas-config.json
const atlasConfig = {
    atlases: {}
};

for (const [deckId, config] of customDecks.entries()) {
    const atlasId = `tts_atlas_${deckId}`;
    atlasConfig.atlases[atlasId] = {
        grid: {
            rows: config.rows,
            cols: config.cols
        }
    };
    console.log(`${atlasId}: ${config.cols}x${config.rows}`);
}

// 保存配置
const outputPath = 'public/assets/atlas-configs/smashup/pod-atlas-config.json';
writeFileSync(outputPath, JSON.stringify(atlasConfig, null, 2), 'utf-8');

console.log(`\n✅ 已生成 ${outputPath}`);
console.log(`   包含 ${Object.keys(atlasConfig.atlases).length} 个图集配置`);
