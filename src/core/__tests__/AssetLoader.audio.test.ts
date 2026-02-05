import { beforeEach, describe, expect, it } from 'vitest';
import { getOptimizedAudioUrl, setAssetsBaseUrl } from '../AssetLoader';

describe('AssetLoader.getOptimizedAudioUrl', () => {
    beforeEach(() => {
        setAssetsBaseUrl('/assets');
    });

    it('空路径返回空', () => {
        expect(getOptimizedAudioUrl('')).toBe('');
    });

    it('穿透源保持原样', () => {
        const src = 'data:audio/ogg;base64,AAAA';
        expect(getOptimizedAudioUrl(src)).toBe(src);
    });

    it('无 basePath 自动插入 compressed', () => {
        const url = getOptimizedAudioUrl('common/audio/dice/Dice_Roll_001.ogg');
        expect(url).toBe('/assets/common/audio/dice/compressed/Dice_Roll_001.ogg');
    });

    it('含 basePath 自动插入 compressed', () => {
        const url = getOptimizedAudioUrl('dice/Dice_Roll_001.ogg', 'common/audio');
        expect(url).toBe('/assets/common/audio/dice/compressed/Dice_Roll_001.ogg');
    });
});
