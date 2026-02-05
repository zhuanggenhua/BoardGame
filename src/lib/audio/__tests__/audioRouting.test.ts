import { describe, expect, it } from 'vitest';
import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../types';
import { resolveAudioEvent, resolveAudioKey, resolveBgmKey, resolveEventSoundKey } from '../audioRouting';

const buildContext = (): AudioRuntimeContext<unknown, { phase?: string }, { userId: string }> => ({
    G: {},
    ctx: { phase: 'a' },
    meta: { userId: 'u1' },
});

describe('audioRouting', () => {
    it('event.sfxKey 优先', () => {
        const event: AudioEvent = { type: 'X', sfxKey: 'custom' };
        const config: GameAudioConfig = { eventSoundMap: { X: 'fallback' } };
        const key = resolveEventSoundKey(event, buildContext(), config);
        expect(key).toBe('custom');
    });

    it('resolver 返回 null 则静音', () => {
        const event: AudioEvent = { type: 'X' };
        const config: GameAudioConfig = {
            eventSoundResolver: () => null,
            eventSoundMap: { X: 'fallback' },
        };
        const key = resolveEventSoundKey(event, buildContext(), config);
        expect(key).toBeNull();
    });

    it('resolver 返回 undefined 时使用 map', () => {
        const event: AudioEvent = { type: 'X' };
        const config: GameAudioConfig = {
            eventSoundResolver: () => undefined,
            eventSoundMap: { X: 'mapped' },
        };
        const key = resolveEventSoundKey(event, buildContext(), config);
        expect(key).toBe('mapped');
    });

    it('audioKey 优先级最高', () => {
        const event: AudioEvent = { type: 'X', audioKey: 'force' };
        const config: GameAudioConfig = { eventSoundMap: { X: 'mapped' } };
        const key = resolveAudioKey(event, buildContext(), config, () => 'category');
        expect(key).toBe('force');
    });

    it('audioCategory 命中时返回分类 key', () => {
        const event: AudioEvent = { type: 'X', audioCategory: { group: 'ui', sub: 'click' } };
        const config: GameAudioConfig = { eventSoundMap: { X: 'mapped' } };
        const key = resolveAudioKey(event, buildContext(), config, () => 'category');
        expect(key).toBe('category');
    });

    it('audioCategory 未命中时回退到 resolver/map', () => {
        const event: AudioEvent = { type: 'X', audioCategory: { group: 'ui' } };
        const config: GameAudioConfig = { eventSoundMap: { X: 'mapped' } };
        const key = resolveAudioKey(event, buildContext(), config, () => null);
        expect(key).toBe('mapped');
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
