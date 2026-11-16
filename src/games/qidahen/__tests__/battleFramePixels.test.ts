import { describe, expect, it } from 'vitest';
import { countNewResultInk } from '../../../../e2e/qidahen/battleFramePixels';

describe('战斗结果帧像素证据', () => {
    it('旧画面不算结果文字，真实新增亮色笔画才计数', () => {
        const baseline = new Uint8Array([40, 30, 20, 210, 200, 180, 60, 50, 40]);
        expect(countNewResultInk(baseline, baseline)).toBe(0);
        expect(countNewResultInk(new Uint8Array([255, 243, 220, 210, 200, 180, 60, 50, 40]), baseline)).toBe(1);
        expect(countNewResultInk(new Uint8Array([42, 32, 22, 210, 200, 180, 60, 50, 40]), baseline)).toBe(0);
    });
    it('区域像素长度不一致不能作为证据', () => {
        expect(() => countNewResultInk(new Uint8Array(3), new Uint8Array(6))).toThrow();
    });
});
