import { createHash } from 'node:crypto';
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import type { AudioEvent } from '../../../lib/audio/types';
import type { RandomFn } from '../../../engine/types';
import {
    MAGE_WARS_AUDIO_CONFIG,
    MAGE_WARS_BGM_BATTLE_KEY,
    MAGE_WARS_BGM_NORMAL_KEY,
    MAGE_WARS_CARD_PLACE_KEY,
    MAGE_WARS_CARD_TAKE_KEY,
    MAGE_WARS_DISCARD_KEY,
    MAGE_WARS_HEAL_KEY,
    MAGE_WARS_LOSE_KEY,
    MAGE_WARS_UPDATE_KEY,
    MAGE_WARS_WIN_KEY,
} from '../audio.config';
import { MageWarsDomain } from '../domain';
import { MAGE_WARS_EVENTS } from '../domain/events';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 3,
    range: (min) => min,
    shuffle: <T,>(array: T[]) => [...array],
};

const resolveKey = (event: AudioEvent, phase = 'planning') =>
    MAGE_WARS_AUDIO_CONFIG.feedbackResolver(event, {
        G: {
            core: MageWarsDomain.setup(['0', '1'], fixedRandom),
            sys: { phase },
        },
        ctx: {},
        meta: { playerID: '0' },
    } as never);

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as {
    entries: Array<{ key: string; src: string }>;
};
const registryByKey = new Map(registry.entries.map((entry) => [entry.key, entry]));
const COMMON_ASSET_MANIFEST_PATH = path.join(process.cwd(), 'public', 'assets', 'common', 'assets-manifest.json');
const commonAssetManifest = JSON.parse(fs.readFileSync(COMMON_ASSET_MANIFEST_PATH, 'utf-8')) as {
    manifestVersion: number;
    scope: string;
    id: string;
    basePrefix: string;
    files: Record<string, {
        variants?: Record<string, {
            sha256?: string;
            bytes?: number;
            mime?: string;
        }>;
    }>;
};

const configuredKeys = [
    MAGE_WARS_CARD_PLACE_KEY,
    MAGE_WARS_CARD_TAKE_KEY,
    MAGE_WARS_DISCARD_KEY,
    MAGE_WARS_UPDATE_KEY,
    MAGE_WARS_HEAL_KEY,
    MAGE_WARS_WIN_KEY,
    MAGE_WARS_LOSE_KEY,
    MAGE_WARS_BGM_NORMAL_KEY,
    MAGE_WARS_BGM_BATTLE_KEY,
];

const getCommonManifestKey = (source: string) => {
    const parsed = path.posix.parse(source.replace(/\\/g, '/'));
    return path.posix.join('audio', parsed.dir, 'compressed', parsed.name);
};

const getFileSha256 = (filePath: string) =>
    createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

describe('法师战争音频配置', () => {
    it('无动画的核心事件映射到公共反馈音', () => {
        expect(resolveKey({ type: MAGE_WARS_EVENTS.SPELLS_PLANNED })).toBe(MAGE_WARS_CARD_PLACE_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.OBJECT_SPELL_PLANNED })).toBe(MAGE_WARS_CARD_TAKE_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.MANA_CHANNELED })).toBe(MAGE_WARS_UPDATE_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED })).toBe(MAGE_WARS_UPDATE_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.MANA_SPENT })).toBe(MAGE_WARS_DISCARD_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.MANA_DRAINED })).toBe(MAGE_WARS_DISCARD_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.MAGE_MOVED })).toBe(MAGE_WARS_CARD_TAKE_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED })).toBe(MAGE_WARS_CARD_TAKE_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.GUARD_GAINED })).toBe(MAGE_WARS_UPDATE_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED })).toBe(MAGE_WARS_HEAL_KEY);
        expect(resolveKey({ type: MAGE_WARS_EVENTS.MAGE_DEFEATED })).toBe(MAGE_WARS_WIN_KEY);
    });

    it('已有 FX 承接的事件不走即时音，避免同一动作双声', () => {
        expect(resolveKey({ type: MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED })).toBeNull();
        expect(resolveKey({ type: MAGE_WARS_EVENTS.ATTACK_DECLARED })).toBeNull();
        expect(resolveKey({ type: MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED })).toBeNull();
        expect(resolveKey({ type: MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED })).toBeNull();
        expect(resolveKey({ type: MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED })).toBeNull();
        expect(resolveKey({ type: MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED })).toBeNull();
        expect(resolveKey({ type: MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED })).toBeNull();
        expect(resolveKey({ type: 'DAMAGE_DEALT' })).toBeNull();
    });

    it('普通阶段和交战阶段切换 BGM', () => {
        const normalRule = MAGE_WARS_AUDIO_CONFIG.bgmRules?.find((rule) => rule.when({
            G: { core: MageWarsDomain.setup(['0', '1'], fixedRandom), sys: { phase: 'planning' } },
            ctx: {},
            meta: {},
        } as never));
        const battleRule = MAGE_WARS_AUDIO_CONFIG.bgmRules?.find((rule) => rule.when({
            G: { core: MageWarsDomain.setup(['0', '1'], fixedRandom), sys: { phase: 'creatureAction' } },
            ctx: {},
            meta: {},
        } as never));

        expect(normalRule?.key).toBe(MAGE_WARS_BGM_NORMAL_KEY);
        expect(normalRule?.group).toBe('normal');
        expect(battleRule?.key).toBe(MAGE_WARS_BGM_BATTLE_KEY);
        expect(battleRule?.group).toBe('battle');
    });

    it('预热音效不重复，所有配置 key 都在注册表和发布清单中', () => {
        const criticalSounds = MAGE_WARS_AUDIO_CONFIG.criticalSounds ?? [];
        expect(new Set(criticalSounds).size).toBe(criticalSounds.length);
        expect(criticalSounds).toEqual(expect.arrayContaining([
            MAGE_WARS_CARD_PLACE_KEY,
            MAGE_WARS_CARD_TAKE_KEY,
            MAGE_WARS_DISCARD_KEY,
            MAGE_WARS_UPDATE_KEY,
        ]));

        for (const key of configuredKeys) {
            const entry = registryByKey.get(key);
            expect(entry, `法师战争音频 key 不在 registry: ${key}`).toBeDefined();

            const parsed = path.parse(entry!.src);
            const manifestKey = getCommonManifestKey(entry!.src);
            const manifestFile = commonAssetManifest.files[manifestKey];
            expect(manifestFile, `法师战争音频未登记到 common assets manifest: ${manifestKey}`).toBeDefined();
            const oggVariant = manifestFile?.variants?.ogg;
            expect(oggVariant, `法师战争音频缺少 OGG 发布变体: ${manifestKey}`).toMatchObject({
                mime: 'audio/ogg',
            });

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
            if (fs.existsSync(compressedPath)) {
                expect(fs.statSync(compressedPath).size, `法师战争音频本地压缩实体大小与发布清单不符: ${compressedPath}`)
                    .toBe(oggVariant?.bytes);
                expect(getFileSha256(compressedPath), `法师战争音频本地压缩实体 hash 与发布清单不符: ${compressedPath}`)
                    .toBe(oggVariant?.sha256);
            }
        }
    });
});
