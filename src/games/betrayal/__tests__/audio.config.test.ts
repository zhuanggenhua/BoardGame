import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import type { AudioEvent } from '../../../lib/audio/types';
import {
    BETRAYAL_ATTACK_KEY,
    BETRAYAL_AUDIO_CONFIG,
    BETRAYAL_BGM_HAUNT_KEY,
    BETRAYAL_BGM_PRE_HAUNT_KEY,
    BETRAYAL_CONFIRM_EXPLORER_KEY,
    BETRAYAL_END_TURN_KEY,
    BETRAYAL_EVENT_CHOICE_KEY,
    BETRAYAL_EXORCISE_FAILURE_KEY,
    BETRAYAL_EXORCISE_SUCCESS_KEY,
    BETRAYAL_EXORCISM_STUDIED_KEY,
    BETRAYAL_EXPLORE_KEY,
    BETRAYAL_EXPLORE_EVENT_KEY,
    BETRAYAL_EXPLORE_OMEN_KEY,
    BETRAYAL_HAUNT_KEY,
    BETRAYAL_JACK_LEARNED_KEY,
    BETRAYAL_LOOT_CORPSE_KEY,
    BETRAYAL_MOVE_KEY,
    BETRAYAL_REROLL_KEY,
    BETRAYAL_ROOM_EFFECT_KEY,
    BETRAYAL_SCENARIO_COMPLETED_KEY,
    BETRAYAL_SCENARIO_PAGE_TURN_KEY,
    BETRAYAL_SELECT_EXPLORER_KEY,
    BETRAYAL_START_SCENARIO_KEY,
    BETRAYAL_TRADE_KEY,
    BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY,
    BETRAYAL_USE_POSSESSION_KEY,
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
    BETRAYAL_EXPLORE_EVENT_KEY,
    BETRAYAL_EXPLORE_OMEN_KEY,
    BETRAYAL_HAUNT_KEY,
    BETRAYAL_ATTACK_KEY,
    BETRAYAL_SCENARIO_PAGE_TURN_KEY,
    BETRAYAL_SELECT_EXPLORER_KEY,
    BETRAYAL_CONFIRM_EXPLORER_KEY,
    BETRAYAL_START_SCENARIO_KEY,
    BETRAYAL_USE_POSSESSION_KEY,
    BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY,
    BETRAYAL_REROLL_KEY,
    BETRAYAL_EVENT_CHOICE_KEY,
    BETRAYAL_ROOM_EFFECT_KEY,
    BETRAYAL_TRADE_KEY,
    BETRAYAL_LOOT_CORPSE_KEY,
    BETRAYAL_END_TURN_KEY,
    BETRAYAL_JACK_LEARNED_KEY,
    BETRAYAL_EXORCISM_STUDIED_KEY,
    BETRAYAL_EXORCISE_SUCCESS_KEY,
    BETRAYAL_EXORCISE_FAILURE_KEY,
    BETRAYAL_SCENARIO_COMPLETED_KEY,
    BETRAYAL_BGM_PRE_HAUNT_KEY,
    BETRAYAL_BGM_HAUNT_KEY,
];

describe('山屋惊魂音频配置', () => {
    it('移动、探索、作祟和攻击结算映射到公共反馈音', () => {
        expect(resolveKey({ type: 'EXPLORER_MOVED' })).toBe(BETRAYAL_MOVE_KEY);
        expect(resolveKey({ type: 'ROOM_EXPLORED', payload: { deckKind: 'item', hauntTriggered: false } })).toBe(BETRAYAL_EXPLORE_KEY);
        expect(resolveKey({ type: 'ROOM_EXPLORED', payload: { deckKind: 'event', hauntTriggered: false } })).toBe(BETRAYAL_EXPLORE_EVENT_KEY);
        expect(resolveKey({ type: 'ROOM_EXPLORED', payload: { deckKind: 'omen', hauntTriggered: false } })).toBe(BETRAYAL_EXPLORE_OMEN_KEY);
        expect(resolveKey({ type: 'ROOM_EXPLORED', payload: { hauntTriggered: true } })).toBe(BETRAYAL_HAUNT_KEY);
        expect(resolveKey({ type: 'EVENT_CHOICE_RESOLVED', payload: { hauntTriggered: true } })).toBe(BETRAYAL_HAUNT_KEY);
        expect(resolveKey({ type: 'HAUNT_ATTACK_RESOLVED' })).toBe(BETRAYAL_ATTACK_KEY);
    });

    it('角色、剧本、持有物、交易、回合和驱魔事件都有反馈音', () => {
        expect(resolveKey({ type: 'EXPLORER_SELECTED' })).toBe(BETRAYAL_SELECT_EXPLORER_KEY);
        expect(resolveKey({ type: 'EXPLORER_CONFIRMED' })).toBe(BETRAYAL_CONFIRM_EXPLORER_KEY);
        expect(resolveKey({ type: 'SCENARIO_STARTED' })).toBe(BETRAYAL_START_SCENARIO_KEY);
        expect(resolveKey({ type: 'EVENT_CHOICE_RESOLVED', payload: { hauntTriggered: false } })).toBe(BETRAYAL_EVENT_CHOICE_KEY);
        expect(resolveKey({ type: 'POSSESSION_USED' })).toBe(BETRAYAL_USE_POSSESSION_KEY);
        expect(resolveKey({ type: 'RABBIT_FOOT_USED' })).toBe(BETRAYAL_REROLL_KEY);
        expect(resolveKey({ type: 'ROOM_EFFECT_USED' })).toBe(BETRAYAL_ROOM_EFFECT_KEY);
        expect(resolveKey({ type: 'POSSESSION_TRADED' })).toBe(BETRAYAL_TRADE_KEY);
        expect(resolveKey({ type: 'CORPSE_LOOTED' })).toBe(BETRAYAL_LOOT_CORPSE_KEY);
        expect(resolveKey({ type: 'TURN_ENDED' })).toBe(BETRAYAL_END_TURN_KEY);
        expect(resolveKey({ type: 'JACK_LEARNED' })).toBe(BETRAYAL_JACK_LEARNED_KEY);
        expect(resolveKey({ type: 'EXORCISM_STUDIED' })).toBe(BETRAYAL_EXORCISM_STUDIED_KEY);
        expect(resolveKey({ type: 'JACK_EXORCISED', payload: { success: true } })).toBe(BETRAYAL_EXORCISE_SUCCESS_KEY);
        expect(resolveKey({ type: 'JACK_EXORCISED', payload: { success: false } })).toBe(BETRAYAL_EXORCISE_FAILURE_KEY);
        expect(resolveKey({ type: 'SCENARIO_COMPLETED' })).toBe(BETRAYAL_SCENARIO_COMPLETED_KEY);
    });

    it('语义明确的主动持有物使用会映射到物品专属音效', () => {
        expect(resolveKey({ type: 'POSSESSION_USED', payload: { cardId: 'holy-water' } })).toBe(BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY);
        expect(resolveKey({ type: 'POSSESSION_USED', payload: { cardId: 'holy-water-2' } })).toBe(BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY);
        expect(resolveKey({ type: 'POSSESSION_USED', payload: { cardId: 'omen-book' } })).toBe(BETRAYAL_USE_POSSESSION_KEY);
        expect(resolveKey({ type: 'POSSESSION_USED', payload: { cardId: 'map' } })).toBe(BETRAYAL_USE_POSSESSION_KEY);
        expect(resolveKey({ type: 'POSSESSION_USED', payload: { cardId: 'medical-kit' } })).toBe(BETRAYAL_USE_POSSESSION_KEY);
        expect(resolveKey({ type: 'POSSESSION_USED', payload: { cardId: 'mask' } })).toBe(BETRAYAL_USE_POSSESSION_KEY);
        expect(resolveKey({ type: 'POSSESSION_USED', payload: { cardId: 'unknown-item' } })).toBe(BETRAYAL_USE_POSSESSION_KEY);
    });

    it('木乃伊和怪物作祟事件都有反馈音', () => {
        expect(resolveKey({ type: 'MUMMY_NAME_STUDIED' })).toBe(BETRAYAL_JACK_LEARNED_KEY);
        expect(resolveKey({ type: 'MUMMY_BANISHMENT_LEARNED' })).toBe(BETRAYAL_EXORCISM_STUDIED_KEY);
        expect(resolveKey({ type: 'MUMMY_BANISHED', payload: { success: true } })).toBe(BETRAYAL_EXORCISE_SUCCESS_KEY);
        expect(resolveKey({ type: 'MUMMY_BANISHED', payload: { success: false } })).toBe(BETRAYAL_EXORCISE_FAILURE_KEY);
        expect(resolveKey({ type: 'MUMMY_GIRL_PICKED_UP' })).toBe(BETRAYAL_USE_POSSESSION_KEY);
        expect(resolveKey({ type: 'MUMMY_GIRL_GIVEN' })).toBe(BETRAYAL_TRADE_KEY);
        expect(resolveKey({ type: 'MUMMY_OMEN_GIVEN' })).toBe(BETRAYAL_TRADE_KEY);
        expect(resolveKey({ type: 'MUMMY_ATTACK_REWARD_RESOLVED', payload: { choice: 'steal' } })).toBe(BETRAYAL_LOOT_CORPSE_KEY);
        expect(resolveKey({ type: 'MUMMY_ATTACK_REWARD_RESOLVED', payload: { choice: 'damage' } })).toBe(BETRAYAL_ATTACK_KEY);
        expect(resolveKey({ type: 'MONSTER_TURN_START_RESOLVED' })).toBe(BETRAYAL_HAUNT_KEY);
        expect(resolveKey({ type: 'MONSTER_MOVEMENT_GROUP_ROLLED' })).toBe(BETRAYAL_REROLL_KEY);
        expect(resolveKey({ type: 'MONSTER_MOVED' })).toBe(BETRAYAL_MOVE_KEY);
        expect(resolveKey({ type: 'MONSTER_ATTACK_HERO_RESOLVED' })).toBe(BETRAYAL_ATTACK_KEY);
    });

    it('其它作祟怪物结算事件复用通用反馈音', () => {
        expect(resolveKey({ type: 'DYNAMITE_ATTACK_RESOLVED' })).toBe(BETRAYAL_ATTACK_KEY);
        expect(resolveKey({ type: 'MONSTER_DAMAGE_RESOLVED' })).toBe(BETRAYAL_ATTACK_KEY);
        expect(resolveKey({ type: 'BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED' })).toBe(BETRAYAL_HAUNT_KEY);
        expect(resolveKey({ type: 'BLOOD_FROM_STONE_MONSTER_TURN_ENDED' })).toBe(BETRAYAL_END_TURN_KEY);
        expect(resolveKey({ type: 'HELPING_HANDS_MONSTER_TURN_STARTED' })).toBe(BETRAYAL_HAUNT_KEY);
        expect(resolveKey({ type: 'HELPING_HANDS_TROLL_HAND_MOVED' })).toBe(BETRAYAL_MOVE_KEY);
        expect(resolveKey({ type: 'HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED' })).toBe(BETRAYAL_ATTACK_KEY);
        expect(resolveKey({ type: 'HELPING_HANDS_ATTACK_REWARD_RESOLVED', payload: { choice: 'steal' } })).toBe(BETRAYAL_LOOT_CORPSE_KEY);
        expect(resolveKey({ type: 'HELPING_HANDS_ATTACK_REWARD_RESOLVED', payload: { choice: 'damage' } })).toBe(BETRAYAL_ATTACK_KEY);
        expect(resolveKey({ type: 'HELPING_HANDS_MONSTER_TURN_ENDED' })).toBe(BETRAYAL_END_TURN_KEY);
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
        expect(criticalSounds).toContain(BETRAYAL_SCENARIO_PAGE_TURN_KEY);
        expect(BETRAYAL_AUDIO_CONFIG.warmSounds).toEqual(expect.arrayContaining([
            BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY,
        ]));

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
