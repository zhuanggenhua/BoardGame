import { describe, expect, it } from 'vitest';
import { mergeTimeRanges, parseExternalUrl } from '../externalGames';

describe('外部游戏的时间和网址合同', () => {
    it('合并多标签重叠时间，忽略无效区间', () => {
        expect(mergeTimeRanges([{ start: 0, end: 1000 }, { start: 500, end: 2000 }, { start: 3000, end: 4000 }, { start: 5, end: 2 }])).toBe(3000);
    });
    it('拒绝脚本协议及包含账号密码的网址', () => {
        expect(() => parseExternalUrl('javascript:alert(1)')).toThrow();
        expect(() => parseExternalUrl('https://user:pass@example.com/')).toThrow();
        expect(parseExternalUrl('https://example.com/game').hostname).toBe('example.com');
    });
});
