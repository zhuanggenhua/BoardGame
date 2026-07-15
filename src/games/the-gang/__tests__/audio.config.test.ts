import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AudioEvent } from '../../../lib/audio/types';
import {
    THE_GANG_AUDIO_CONFIG,
    THE_GANG_CHIP_TAKEN_KEY,
    THE_GANG_NEXT_HEIST_KEY,
    THE_GANG_PROGRESS_APPROVED_KEY,
    THE_GANG_ROUND_ENDED_KEY,
    THE_GANG_SHOWDOWN_REVEALED_KEY,
    THE_GANG_SHOWDOWN_LOSE_KEY,
    THE_GANG_SHOWDOWN_WIN_KEY,
} from '../audio.config';
import { THE_GANG_EVENTS, type TheGangCore } from '../domain/types';

const resolveKey = (event: AudioEvent) =>
    THE_GANG_AUDIO_CONFIG.feedbackResolver(event, {
        G: { phase: 'chip-selection' },
        ctx: {},
        meta: {},
    } as never);

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
const registryExists = fs.existsSync(REGISTRY_PATH);
const registry = registryExists
    ? JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as { entries: Array<{ key: string }> }
    : { entries: [] };
const registryKeys = new Set(registry.entries.map((entry) => entry.key));

const collectConfiguredAudioKeys = () => {
    const keys = new Set<string>();

    THE_GANG_AUDIO_CONFIG.criticalSounds?.forEach((key) => keys.add(key));
    THE_GANG_AUDIO_CONFIG.bgm?.forEach((track) => keys.add(track.key));
    Object.values(THE_GANG_AUDIO_CONFIG.bgmGroups ?? {}).forEach((group) => group.forEach((key) => keys.add(key)));

    [
        resolveKey({ type: THE_GANG_EVENTS.HEIST_STARTED }),
        resolveKey({ type: THE_GANG_EVENTS.CHIP_TAKEN }),
        resolveKey({ type: THE_GANG_EVENTS.PROGRESS_APPROVED }),
        resolveKey({ type: THE_GANG_EVENTS.ROUND_ENDED }),
        resolveKey({ type: THE_GANG_EVENTS.NEXT_HEIST_STARTED }),
        resolveKey({
            type: THE_GANG_EVENTS.SHOWDOWN_REVEALED,
            payload: { record: { outcome: 'success' } },
        }),
        resolveKey({
            type: THE_GANG_EVENTS.SHOWDOWN_REVEALED,
            payload: { record: { outcome: 'failure' } },
        }),
        resolveKey({ type: THE_GANG_EVENTS.GAME_FINISHED }),
    ].forEach((key) => {
        if (key) keys.add(key);
    });

    return keys;
};

describe('The Gang 音频配置', () => {
    it('核心游戏事件映射到对应音效', () => {
        expect(resolveKey({ type: THE_GANG_EVENTS.HEIST_STARTED })).toBe(THE_GANG_NEXT_HEIST_KEY);
        expect(resolveKey({ type: THE_GANG_EVENTS.CHIP_TAKEN })).toBe(THE_GANG_CHIP_TAKEN_KEY);
        expect(resolveKey({ type: THE_GANG_EVENTS.PROGRESS_APPROVED })).toBe(THE_GANG_PROGRESS_APPROVED_KEY);
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

    it('游戏结束按最终结果播放胜利或失败提示', () => {
        expect(resolveKey({
            type: THE_GANG_EVENTS.GAME_FINISHED,
            payload: { winners: ['0', '1', '2'] },
        })).toBe(THE_GANG_SHOWDOWN_WIN_KEY);

        expect(resolveKey({
            type: THE_GANG_EVENTS.GAME_FINISHED,
            payload: { draw: false },
        })).toBe(THE_GANG_SHOWDOWN_LOSE_KEY);
    });

    it('摊牌揭示状态变化额外播放翻牌音', () => {
        const trigger = THE_GANG_AUDIO_CONFIG.stateTriggers?.find((candidate) => candidate.sound === THE_GANG_SHOWDOWN_REVEALED_KEY);

        expect(trigger).toBeDefined();
        expect(trigger?.condition({
            G: { lastShowdown: undefined } as TheGangCore,
            ctx: {},
            meta: {},
        }, {
            G: { lastShowdown: { outcome: 'success' } } as TheGangCore,
            ctx: {},
            meta: {},
        })).toBe(true);
    });

    it('预热音效不重复且覆盖第一回合高频动作', () => {
        const criticalSounds = THE_GANG_AUDIO_CONFIG.criticalSounds ?? [];

        expect(criticalSounds).toContain(THE_GANG_CHIP_TAKEN_KEY);
        expect(criticalSounds).toContain(THE_GANG_ROUND_ENDED_KEY);
        expect(criticalSounds).toContain(THE_GANG_SHOWDOWN_REVEALED_KEY);
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

    it.skipIf(!registryExists)('所有配置的音效和 BGM key 都存在于公共音频注册表', () => {
        for (const key of collectConfiguredAudioKeys()) {
            expect(registryKeys.has(key), `纸牌帮音频 key 不在 registry: ${key}`).toBe(true);
        }
    });
});
