import { describe, expect, it } from 'vitest';
import {
    resolveAiSeatDisplayName,
    resolveSeatPlayerDisplayName,
} from '../seatDisplayName';

describe('AI seat display names', () => {
    it('按座位序号生成中文 AI 显示名', () => {
        expect(resolveAiSeatDisplayName('3')).toBe('AI 4 号位');
        expect(resolveAiSeatDisplayName('7')).toBe('AI 8 号位');
    });

    it('AI 座位缺少 metadata name 时回退到 AI 座位名', () => {
        expect(resolveSeatPlayerDisplayName({
            playerId: '3',
            seatControllers: {
                '3': { type: 'local-ai' },
            },
        })).toBe('AI 4 号位');
    });

    it('已有玩家名优先于 AI 回退名', () => {
        expect(resolveSeatPlayerDisplayName({
            playerId: '3',
            name: ' 自定义 AI ',
            seatControllers: {
                '3': { type: 'local-ai' },
            },
        })).toBe('自定义 AI');
    });

    it('真人座位缺少名字时不伪造 AI 名', () => {
        expect(resolveSeatPlayerDisplayName({
            playerId: '3',
            seatControllers: {
                '3': { type: 'human' },
            },
        })).toBeUndefined();
    });
});
