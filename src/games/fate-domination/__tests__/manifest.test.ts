import { describe, expect, it } from 'vitest';
import { FATE_DOMINATION_MANIFEST } from '../manifest';

describe('命运支配游戏清单', () => {
    it('实施完成前必须保留实施中标记', () => {
        expect(FATE_DOMINATION_MANIFEST.statusTag).toBe('under_construction');
    });

    it('横屏手机使用真实视口布局，不用1920画布整体缩小HUD', () => {
        expect(FATE_DOMINATION_MANIFEST.mobileProfile).toBe('landscape-adapted');
        expect(FATE_DOMINATION_MANIFEST.preferredOrientation).toBe('landscape');
        expect(FATE_DOMINATION_MANIFEST.mobileLayoutPreset).toBe('map-shell');
        expect(FATE_DOMINATION_MANIFEST.mobileBoardShellLayout).toBeUndefined();
    });
});
