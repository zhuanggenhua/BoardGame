import { describe, expect, it } from 'vitest';
import type { AudioEvent, GameAudioConfig } from '../types';
import { resolveAudioEvent, resolveFeedback, resolveBgmKey } from '../audioRouting';

const buildContext = () => ({
    G: {},
    ctx: { phase: 'a' } as { phase?: string },
    meta: { userId: 'u1' },
});

describe('audioRouting', () => {
    it('event.sfxKey 优先', () => {
        const event: AudioEvent = { type: 'X', sfxKey: 'custom' };
        const config: GameAudioConfig = { feedbackResolver: () => 'fallback' };
        const result = resolveFeedback(event, buildContext(), config);
        expect(result).toBe('custom');
    });

    it('feedbackResolver 返回 null 则静音', () => {
        const event: AudioEvent = { type: 'X' };
        const config: GameAudioConfig = { feedbackResolver: () => null };
        const result = resolveFeedback(event, buildContext(), config);
        expect(result).toBeNull();
    });

    it('feedbackResolver 结果直接返回', () => {
        const event: AudioEvent = { type: 'X' };
        const config: GameAudioConfig = { feedbackResolver: () => 'resolved' };
        const result = resolveFeedback(event, buildContext(), config);
        expect(result).toBe('resolved');
    });

    it('audioKey 优先级最高', () => {
        const event: AudioEvent = { type: 'X', audioKey: 'force' };
        const config: GameAudioConfig = { feedbackResolver: () => 'fallback' };
        const result = resolveFeedback(event, buildContext(), config);
        expect(result).toBe('force');
    });

    it('resolveBgmKey 优先匹配规则，否则 fallback', () => {
        const context = buildContext();
        const key = resolveBgmKey(context, [
            { when: (ctx) => ctx.ctx.phase === 'b', key: 'b' },
            { when: () => true, key: 'a' },
        ], 'fallback');
        expect(key).toBe('a');

        context.ctx.phase = 'none';
        const fallbackKey = resolveBgmKey(context, [], 'fallback');
        expect(fallbackKey).toBe('fallback');
    });

    it('resolveAudioEvent 默认解析 sys.log entry', () => {
        const event: AudioEvent = { type: 'TEST' };
        const entry = { type: 'event', data: event };
        expect(resolveAudioEvent(entry)).toEqual(event);
    });

    it('resolveAudioEvent 支持事件流条目', () => {
        const event: AudioEvent = { type: 'STREAM' };
        const entry = { id: 1, event };
        expect(resolveAudioEvent(entry)).toEqual(event);
    });
});
