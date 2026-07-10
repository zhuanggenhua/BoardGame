import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import type { AudioEvent } from '../../../lib/audio/types';
import {
    BETRAYAL_ATTACK_KEY,
    BETRAYAL_AUDIO_CONFIG,
    BETRAYAL_BGM_HAUNT_KEY,
    BETRAYAL_BGM_PRE_HAUNT_KEY,
    BETRAYAL_EXPLORE_KEY,
    BETRAYAL_HAUNT_KEY,
    BETRAYAL_MOVE_KEY,
} from '../audio.config';
import { createBetrayalCharacterSelectCore } from '../game';

const resolveKey = (event: AudioEvent) => BETRAYAL_AUDIO_CONFIG.feedbackResolver(event, {
    G: createBetrayalCharacterSelectCore(['0', '1', '2']),
    ctx: {},
    meta: { playerID: '0' },
});

const registryPath = path.join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as {
    entries: Array<{ key: string; src: string }>;
};
const registryByKey = new Map(registry.entries.map((entry) => [entry.key, entry]));

const configuredKeys = [
    BETRAYAL_MOVE_KEY,
    BETRAYAL_EXPLORE_KEY,
    BETRAYAL_HAUNT_KEY,
    BETRAYAL_ATTACK_KEY,
    BETRAYAL_BGM_PRE_HAUNT_KEY,
    BETRAYAL_BGM_HAUNT_KEY,
];

describe('山屋惊魂音频配置', () => {
    it('移动、探索、作祟和攻击结算映射到公共反馈音', () => {
        expect(resolveKey({ type: 'EXPLORER_MOVED' })).toBe(BETRAYAL_MOVE_KEY);
        expect(resolveKey({ type: 'ROOM_EXPLORED', payload: { hauntTriggered: false } })).toBe(BETRAYAL_EXPLORE_KEY);
        expect(resolveKey({ type: 'ROOM_EXPLORED', payload: { hauntTriggered: true } })).toBe(BETRAYAL_HAUNT_KEY);
        expect(resolveKey({ type: 'EVENT_CHOICE_RESOLVED', payload: { hauntTriggered: true } })).toBe(BETRAYAL_HAUNT_KEY);
        expect(resolveKey({ type: 'HAUNT_ATTACK_RESOLVED' })).toBe(BETRAYAL_ATTACK_KEY);
    });

    it('不把持有物和交易等私有流程误广播给全桌', () => {
        expect(resolveKey({ type: 'POSSESSION_USED' })).toBeNull();
        expect(resolveKey({ type: 'POSSESSION_TRADED' })).toBeNull();
        expect(resolveKey({ type: 'CORPSE_LOOTED' })).toBeNull();
    });

    it('恶兆前与作祟阶段使用不同 BGM', () => {
        const preHaunt = createBetrayalCharacterSelectCore(['0', '1', '2']);
        const haunt = { ...preHaunt, phase: 'haunt' as const };

        const normalRule = BETRAYAL_AUDIO_CONFIG.bgmRules?.find((rule) => rule.when({
            G: preHaunt,
            ctx: {},
            meta: {},
        }));
        const hauntRule = BETRAYAL_AUDIO_CONFIG.bgmRules?.find((rule) => rule.when({
            G: haunt,
            ctx: {},
            meta: {},
        }));

        expect(normalRule?.key).toBe(BETRAYAL_BGM_PRE_HAUNT_KEY);
        expect(normalRule?.group).toBe('normal');
        expect(hauntRule?.key).toBe(BETRAYAL_BGM_HAUNT_KEY);
        expect(hauntRule?.group).toBe('battle');
    });

    it('关键音效不重复，所有 key 均有注册表和本地压缩实体', () => {
        const criticalSounds = BETRAYAL_AUDIO_CONFIG.criticalSounds ?? [];
        expect(new Set(criticalSounds).size).toBe(criticalSounds.length);

        for (const key of configuredKeys) {
            const entry = registryByKey.get(key);
            expect(entry, `山屋惊魂音频 key 不在 registry: ${key}`).toBeDefined();

            const parsed = path.parse(entry!.src);
            const compressedPath = path.join(
                process.cwd(),
                'public',
                'assets',
                'common',
                'audio',
                parsed.dir,
                'compressed',
                parsed.base,
            );
            expect(fs.existsSync(compressedPath), `山屋惊魂音频缺少本地压缩实体: ${compressedPath}`).toBe(true);
        }
    });
});
