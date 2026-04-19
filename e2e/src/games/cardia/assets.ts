/**
 * Cardia 资源配置
 *
 * 关键图片完全由 criticalImageResolver 动态决定（按教程/牌组阶段裁剪），
 * 这里不再声明静态 criticalImages，避免与 resolver 叠加导致教程加载过重。
 */

import { registerGameAssets } from '../../core';

registerGameAssets('cardia', {
    criticalImages: [],
    warmImages: [],
    images: {},
    audio: {},
});
