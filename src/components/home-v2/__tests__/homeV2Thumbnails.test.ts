import { describe, expect, it } from 'vitest';
import { getHomeV2ReferenceThumbnailSrc } from '../homeV2Thumbnails';

describe('Home V2 reference thumbnails', () => {
    it('为有合格参考图的游戏使用 Home V2 参考缩略图资产', () => {
        expect(getHomeV2ReferenceThumbnailSrc('cardia')).toBe('/assets/common/images/home-v2/reference-thumbnails/cardia.png');
    });

    it('不使用井字棋那张仅含人数的弱参考图覆盖 V1 缩略图组件', () => {
        expect(getHomeV2ReferenceThumbnailSrc('tictactoe')).toBeUndefined();
    });

    it('不为未登记游戏伪造 Home V2 缩略图路径', () => {
        expect(getHomeV2ReferenceThumbnailSrc('unknown-game')).toBeUndefined();
    });
});
