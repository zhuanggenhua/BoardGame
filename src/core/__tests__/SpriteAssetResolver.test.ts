import { beforeEach, describe, expect, it } from 'vitest';

import { setAssetsBaseUrl } from '../AssetLoader';
import {
    buildSpriteBackgroundImage,
    resolveSpriteAssetUrl,
    resolveSpriteAssetUrls,
} from '../SpriteAssetResolver';

describe('SpriteAssetResolver', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
    });

    it('逻辑 spriteAsset 应解析为语言化压缩资源', () => {
        const urls = resolveSpriteAssetUrls('summonerwars/common/dice', 'zh-CN');

        expect(urls[0]).toContain('/assets/i18n/zh-CN/summonerwars/common/compressed/dice.webp');
        expect(urls[1]).toContain('/assets/i18n/en/summonerwars/common/compressed/dice.webp');
    });

    it('direct spriteAsset 应保持原路径', () => {
        expect(resolveSpriteAssetUrl('/game-data/dicethrone/monk/dice-sprite.png', 'zh-CN'))
            .toBe('/game-data/dicethrone/monk/dice-sprite.png');
    });

    it('buildSpriteBackgroundImage 应包装成 CSS background-image', () => {
        const backgroundImage = buildSpriteBackgroundImage('summonerwars/common/dice', 'zh-CN');

        expect(backgroundImage).toContain('url("');
        expect(backgroundImage).toContain('summonerwars/common/compressed/dice.webp');
    });
});
