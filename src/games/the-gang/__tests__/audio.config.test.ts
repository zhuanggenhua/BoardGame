import { describe, expect, it } from 'vitest';
import type { AudioEvent } from '../../../lib/audio/types';
import {
    THE_GANG_AUDIO_CONFIG,
    THE_GANG_CHIP_TAKEN_KEY,
    THE_GANG_NEXT_HEIST_KEY,
    THE_GANG_ROUND_ENDED_KEY,
    THE_GANG_SHOWDOWN_LOSE_KEY,
    THE_GANG_SHOWDOWN_SUCCESS_KEY,
    THE_GANG_SHOWDOWN_WIN_KEY,
} from '../audio.config';
import { THE_GANG_EVENTS, type TheGangCore } from '../domain/types';

const resolveKey = (event: AudioEvent) =>
    THE_GANG_AUDIO_CONFIG.feedbackResolver(event, {
        G: { phase: 'chip-selection' },
        ctx: {},
        meta: {},
    } as never);

describe('The Gang 音频配置', () => {
    it('核心游戏事件映射到对应音效', () => {
        expect(resolveKey({ type: THE_GANG_EVENTS.CHIP_TAKEN })).toBe(THE_GANG_CHIP_TAKEN_KEY);
        expect(resolveKey({ type: THE_GANG_EVENTS.PROGRESS_APPROVED })).toBe(THE_GANG_SHOWDOWN_SUCCESS_KEY);
        expect(resolveKey({ type: THE_GANG_EVENTS.ROUND_ENDED })).toBe(THE_GANG_ROUND_ENDED_KEY);
        expect(resolveKey({ type: THE_GANG_EVENTS.NEXT_HEIST_STARTED })).toBe(THE_GANG_NEXT_HEIST_KEY);
    });

    it('摊牌成功和失败分别播放胜利/失败提示', () => {
        expect(resolveKey({
            type: THE_GANG_EVENTS.SHOWDOWN_REVEALED,
            payload: { record: { outcome: 'success' } },
        })).toBe(THE_GANG_SHOWDOWN_WIN_KEY);

        expect(resolveKey({
            type: THE_GANG_EVENTS.SHOWDOWN_REVEALED,
            payload: { record: { outcome: 'failure' } },
        })).toBe(THE_GANG_SHOWDOWN_LOSE_KEY);
    });

    it('预热音效不重复且覆盖第一回合高频动作', () => {
        const criticalSounds = THE_GANG_AUDIO_CONFIG.criticalSounds ?? [];

        expect(criticalSounds).toContain(THE_GANG_CHIP_TAKEN_KEY);
        expect(criticalSounds).toContain(THE_GANG_ROUND_ENDED_KEY);
        expect(criticalSounds).toContain(THE_GANG_SHOWDOWN_WIN_KEY);
        expect(new Set(criticalSounds).size).toBe(criticalSounds.length);
    });

    it('BGM 在普通流程和摊牌流程之间切换', () => {
        const normalContext = {
            G: { phase: 'chip-selection' } as TheGangCore,
            ctx: {},
            meta: {},
        };
        const showdownContext = {
            G: { phase: 'showdown' } as TheGangCore,
            ctx: {},
            meta: {},
        };

        const normalRule = THE_GANG_AUDIO_CONFIG.bgmRules?.find((rule) => rule.when(normalContext as never));
        const showdownRule = THE_GANG_AUDIO_CONFIG.bgmRules?.find((rule) => rule.when(showdownContext as never));

        expect(normalRule?.group).toBe('normal');
        expect(showdownRule?.group).toBe('battle');
    });
});
