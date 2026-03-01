/**
 * Cardia 资源配置
 * 注册游戏资源到 AssetLoader，启用预加载机制
 */

import { registerGameAssets } from '../../core';

// 生成所有卡牌图片路径
const generateCardPaths = () => {
    const paths: string[] = [];
    
    // 标题和辅助图片
    paths.push('cardia/cards/title');
    paths.push('cardia/cards/helper1');
    paths.push('cardia/cards/helper2');
    
    // Deck I 卡牌（1-16）
    for (let i = 1; i <= 16; i++) {
        paths.push(`cardia/cards/deck1/${i}`);
    }
    
    // Deck II 卡牌（1-16）
    for (let i = 1; i <= 16; i++) {
        paths.push(`cardia/cards/deck2/${i}`);
    }
    
    // 地点卡牌（1-8）
    for (let i = 1; i <= 8; i++) {
        paths.push(`cardia/cards/locations/${i}`);
    }
    
    return paths;
};

// 注册 Cardia 资源
registerGameAssets('cardia', {
    // 关键图片：游戏开始前必须加载完成
    // 包含所有卡牌图片，确保游戏过程中不会出现加载延迟
    criticalImages: generateCardPaths(),
    
    // 暖加载图片：后台预加载，不阻塞游戏开始
    warmImages: [],
    
    // 图片资源映射（可选，用于 getImagePath API）
    images: {},
    
    // 音频资源映射（可选）
    audio: {},
});

console.log('[Cardia] 资源已注册，共', generateCardPaths().length, '张关键图片');
