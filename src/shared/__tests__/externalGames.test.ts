import { describe, expect, it } from 'vitest';
import { isExternalGameId, mergeTimeRanges, parseExternalUrl, playerOptionsFromRange, resolveExternalEmbed } from '../externalGames';

describe('外部游戏的时间和网址合同', () => {
    it('合并多标签重叠时间，忽略无效区间', () => {
        expect(mergeTimeRanges([{ start: 0, end: 1000 }, { start: 500, end: 2000 }, { start: 3000, end: 4000 }, { start: 5, end: 2 }])).toBe(3000);
    });
    it('拒绝脚本协议及包含账号密码的网址', () => {
        expect(() => parseExternalUrl('javascript:alert(1)')).toThrow();
        expect(() => parseExternalUrl('https://user:pass@example.com/')).toThrow();
        expect(parseExternalUrl('https://example.com/game').hostname).toBe('example.com');
    });
    it('识别外站目录 ID，并按嵌入检查结论决定能否站内开玩', () => {
        expect(isExternalGameId('external-yuanyi-games')).toBe(true);
        expect(isExternalGameId('tictactoe')).toBe(false);
        expect(playerOptionsFromRange(1, 4)).toEqual([1, 2, 3, 4]);
        const blocked = resolveExternalEmbed({
            url: 'https://yuanyigames.top/', published: true, embedStatus: 'blocked', embedCheckedUrl: 'https://yuanyigames.top/',
        }, 'http://127.0.0.1:4273', 'http:');
        expect(blocked).toMatchObject({ restricted: true, canEmbed: false, sameOrigin: false, safeHttps: true });
        const allowed = resolveExternalEmbed({
            url: 'https://example.com/game', published: true, embedStatus: 'allowed', embedCheckedUrl: 'https://example.com/game',
        }, 'http://127.0.0.1:4273', 'http:');
        expect(allowed.canEmbed).toBe(true);
    });
});
