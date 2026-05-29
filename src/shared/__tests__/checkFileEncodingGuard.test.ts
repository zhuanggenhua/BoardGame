import { describe, expect, it } from 'vitest';
import { countDistinctMojibakeMarkers, detectWarnings } from '../../../scripts/infra/check-file-encoding.mjs';

describe('check-file-encoding mojibake guard', () => {
    it('应把常见 UTF-8 错解码后再写回的中文乱码识别为 likely-mojibake', () => {
        const broken = [
            '// \u6fe0\u7898\u69c5\u934b\u20ac\u95b8\u5b2b\u6347\u93cc?Block the Path\u95c2\u4f79\u5be7\u7ecb\u6226\u60a7\u9361\u6d99\u510d',
            '// \u95c1\u8bf2\u6d77\u93c1\u6401\u5d22\u8914\u5b95?FACTION_DISPLAY_NAMES \u5a75\u72ae\u57b9\u9416\u3224\u5d1f\u9852\u509c\u30b7',
            '// \u9866\u754c\u6686\u95b3\u044c\u5259\u7164',
        ].join('\n');

        expect(countDistinctMojibakeMarkers(broken)).toBeGreaterThanOrEqual(2);
        expect(detectWarnings(broken).map(rule => rule.id)).toContain('likely-mojibake');
    });

    it('不应把正常中文注释误报为 likely-mojibake', () => {
        const normal = [
            '// Block the Path：基地上可以同时存在多张不同 blockedFaction 的封路行动',
            '// 这里应逐张收集限制信息，而不是只取第一张同名来源',
        ].join('\n');

        expect(countDistinctMojibakeMarkers(normal)).toBe(0);
        expect(detectWarnings(normal).map(rule => rule.id)).not.toContain('likely-mojibake');
    });
});
