import { describe, expect, it } from 'vitest';

import {
    DICETHRONE_DICE_BOX_STYLE_PROFILE,
    DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE,
} from '../diceBoxStyleProfiles';

describe('DiceThrone 3D 骰子物理样式合同', () => {
    it('投掷结束后应保留自然物理落点，禁止强制重排造成瞬移', () => {
        expect(DICETHRONE_DICE_BOX_STYLE_PROFILE.compactSettledDice).toBe(false);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.compactSettledDice).toBe(false);
    });

    it('移动横屏应把真实物理区域收进红框，而不是只靠结束回收', () => {
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.fitWorldToCameraView).toBe(true);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.worldWidthScale)
            .toBeGreaterThan(DICETHRONE_DICE_BOX_STYLE_PROFILE.worldWidthScale);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.worldHeightScale)
            .toBeGreaterThan(DICETHRONE_DICE_BOX_STYLE_PROFILE.worldHeightScale);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.worldHeightScale)
            .toBeGreaterThan(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.worldWidthScale);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.baseScale)
            .toBeGreaterThanOrEqual(40);
    });

    it('移动横屏应单独放大相机投影，不通过继续放大物理骰子换清晰度', () => {
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.cameraZoom)
            .toBeGreaterThan(1);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.cameraZoom)
            .toBeLessThanOrEqual(1.5);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.baseScale).toBe(40);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.strength)
            .toBeGreaterThan(DICETHRONE_DICE_BOX_STYLE_PROFILE.strength);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.initialThrowSpread)
            .toBeGreaterThanOrEqual(0.7);
        expect(DICETHRONE_MOBILE_DICE_BOX_STYLE_PROFILE.settledSpreadAnimationMs)
            .toBe(0);
    });

    it('越界安全回收位置应保持二维散落，而不是退化为单排', () => {
        const layout = DICETHRONE_DICE_BOX_STYLE_PROFILE.settledLayout ?? [];
        const xValues = layout.map((slot) => slot.x);
        const yValues = layout.map((slot) => slot.y);

        expect(layout).toHaveLength(5);
        expect(Math.max(...xValues) - Math.min(...xValues)).toBeGreaterThan(2.5);
        expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(0.9);
    });
});
