/**
 * 召唤师战争音效配置测试
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AudioEvent } from '../../../lib/audio/types';
import { SUMMONER_WARS_AUDIO_CONFIG } from '../audio.config';
import { SW_EVENTS } from '../domain/types';
import { abilityRegistry } from '../domain/abilities';

const BGM_NORMAL_KEY = 'bgm.fantasy.fantasy_music_pack_vol.dragon_dance_rt_2.fantasy_vol5_dragon_dance_main';
const BGM_BATTLE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.shields_and_spears_rt_2.fantasy_vol5_shields_and_spears_main';
const STINGER_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const STINGER_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const MAGIC_GAIN_KEY = 'fantasy.magic_sword_recharge_01';
const MAGIC_SPEND_KEY = 'fantasy.dark_sword_recharge';
const SUMMON_KEY = 'status.general.player_status_sound_fx_pack_vol.action_and_interaction.ready_a';
const MOVE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001';
const BUILD_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const EVENT_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const UNIT_CHARGE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const DAMAGE_LIGHT_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const DAMAGE_HEAVY_KEY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
const UNIT_DESTROY_KEY = 'combat.general.fight_fury_vol_2.body_hitting_the_ground_with_blood.fghtbf_body_hitting_the_ground_with_blood_01_krst';
const STRUCTURE_DAMAGE_KEY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.shield_impact_a';
const MAGIC_SHOCK_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_shock';
const HEAL_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_light';
const HEAL_MODE_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_ward';
const POSITIVE_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const UPDATE_CHIME_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const SELECTION_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const PROMPT_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_spring_a';

const MELEE_LIGHT_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1',
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1',
];

const MELEE_HEAVY_KEYS = [
    'fantasy.dark_sword_whoosh_01',
    'fantasy.dark_sword_whoosh_02',
    'fantasy.dark_sword_whoosh_03',
];

const RANGED_ATTACK_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_3',
];

const MOVE_SWING_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1',
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1',
];

const ABILITY_KEYS = {
    reviveUndead: 'magic.dark.29.dark_resurrection',
    telekinesis: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_001',
    guidance: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_002',
    vanish: 'magic.rock.35.earth_magic_whoosh_01',
    structureShift: 'fantasy.elemental_sword_iceattack_v1',
    rapidFire: 'fantasy.elemental_bow_fireattack_01',
} as const;

const abilitySfxKeys = Array.from(
    new Set(
        abilityRegistry
            .getAll()
            .map((ability) => ability.sfxKey)
            .filter((key): key is string => !!key)
    )
);

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
const registry = JSON.parse(registryRaw) as { entries: Array<{ key: string }> };
const registryMap = new Map(registry.entries.map(entry => [entry.key, entry]));

const mockContext = {
    G: {},
    ctx: { currentPhase: 'summon', isGameOver: false },
    meta: { currentPlayerId: '0' },
} as any;

describe('Summoner Wars 音效配置', () => {
    it('应解析基础事件音效', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.eventSoundResolver;
        if (!resolver) throw new Error('eventSoundResolver 未定义');

        expect(resolver({ type: SW_EVENTS.FACTION_SELECTED } as AudioEvent, mockContext)).toBe(SELECTION_KEY);
        expect(resolver({ type: SW_EVENTS.PLAYER_READY } as AudioEvent, mockContext)).toBe(POSITIVE_SIGNAL_KEY);
        expect(resolver({ type: SW_EVENTS.HOST_STARTED } as AudioEvent, mockContext)).toBe(UPDATE_CHIME_KEY);
        expect(resolver({ type: SW_EVENTS.UNIT_SUMMONED } as AudioEvent, mockContext)).toBe(SUMMON_KEY);
        expect(resolver({ type: SW_EVENTS.UNIT_MOVED } as AudioEvent, mockContext)).toBe(MOVE_KEY);
        expect(resolver({ type: SW_EVENTS.STRUCTURE_BUILT } as AudioEvent, mockContext)).toBe(BUILD_KEY);
        expect(resolver({ type: SW_EVENTS.CARD_DRAWN } as AudioEvent, mockContext)).toBe(CARD_DRAW_KEY);
        expect(resolver({ type: SW_EVENTS.CARD_DISCARDED } as AudioEvent, mockContext)).toBe(CARD_DISCARD_KEY);
        expect(resolver({ type: SW_EVENTS.EVENT_PLAYED } as AudioEvent, mockContext)).toBe(EVENT_PLAY_KEY);
        expect(resolver({ type: SW_EVENTS.UNIT_CHARGED } as AudioEvent, mockContext)).toBe(UNIT_CHARGE_KEY);
        expect(resolver({ type: SW_EVENTS.HEALING_MODE_SET } as AudioEvent, mockContext)).toBe(HEAL_MODE_KEY);
    });

    it('应解析伤害与治疗音效', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.eventSoundResolver;
        if (!resolver) throw new Error('eventSoundResolver 未定义');

        const light = resolver({ type: SW_EVENTS.UNIT_DAMAGED, payload: { damage: 1 } } as AudioEvent, mockContext);
        const heavy = resolver({ type: SW_EVENTS.UNIT_DAMAGED, payload: { damage: 3 } } as AudioEvent, mockContext);
        expect(light).toBe(DAMAGE_LIGHT_KEY);
        expect(heavy).toBe(DAMAGE_HEAVY_KEY);
        expect(resolver({ type: SW_EVENTS.UNIT_HEALED } as AudioEvent, mockContext)).toBe(HEAL_KEY);
        expect(resolver({ type: SW_EVENTS.STRUCTURE_HEALED } as AudioEvent, mockContext)).toBe(HEAL_KEY);
        expect(resolver({ type: SW_EVENTS.STRUCTURE_DAMAGED } as AudioEvent, mockContext)).toBe(STRUCTURE_DAMAGE_KEY);
        expect(resolver({ type: SW_EVENTS.UNIT_DESTROYED } as AudioEvent, mockContext)).toBe(UNIT_DESTROY_KEY);
    });

    it('应解析魔力变化音效', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.eventSoundResolver;
        if (!resolver) throw new Error('eventSoundResolver 未定义');

        const gain = resolver({ type: SW_EVENTS.MAGIC_CHANGED, payload: { delta: 2 } } as AudioEvent, mockContext);
        const spend = resolver({ type: SW_EVENTS.MAGIC_CHANGED, payload: { delta: -1 } } as AudioEvent, mockContext);
        expect(gain).toBe(MAGIC_GAIN_KEY);
        expect(spend).toBe(MAGIC_SPEND_KEY);
    });

    it('应解析近战/远程与位移音效', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.eventSoundResolver;
        if (!resolver) throw new Error('eventSoundResolver 未定义');

        const meleeKey = resolver({ type: SW_EVENTS.UNIT_ATTACKED } as AudioEvent, mockContext);
        expect([...MELEE_LIGHT_KEYS, ...MELEE_HEAVY_KEYS]).toContain(meleeKey);

        const rangedKey = resolver({ type: SW_EVENTS.UNIT_ATTACKED, payload: { attackType: 'ranged' } } as AudioEvent, mockContext);
        expect(RANGED_ATTACK_KEYS).toContain(rangedKey);

        const moveKey = resolver({ type: SW_EVENTS.UNIT_PUSHED } as AudioEvent, mockContext);
        expect(MOVE_SWING_KEYS).toContain(moveKey);
    });

    it('应解析技能音效', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.eventSoundResolver;
        if (!resolver) throw new Error('eventSoundResolver 未定义');

        const reviveKey = resolver({ type: SW_EVENTS.UNIT_SUMMONED, payload: { sourceAbilityId: 'revive_undead' } } as AudioEvent, mockContext);
        const telekinesisKey = resolver({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'telekinesis' } } as AudioEvent, mockContext);
        const guidanceKey = resolver({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'guidance' } } as AudioEvent, mockContext);
        const vanishKey = resolver({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'vanish' } } as AudioEvent, mockContext);
        const structureShiftKey = resolver({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'structure_shift' } } as AudioEvent, mockContext);
        const rapidFireKey = resolver({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'rapid_fire' } } as AudioEvent, mockContext);
        expect(reviveKey).toBe(ABILITY_KEYS.reviveUndead);
        expect(telekinesisKey).toBe(ABILITY_KEYS.telekinesis);
        expect(guidanceKey).toBe(ABILITY_KEYS.guidance);
        expect(vanishKey).toBe(ABILITY_KEYS.vanish);
        expect(structureShiftKey).toBe(ABILITY_KEYS.structureShift);
        expect(rapidFireKey).toBe(ABILITY_KEYS.rapidFire);
    });

    it('应解析控制与请求音效', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.eventSoundResolver;
        if (!resolver) throw new Error('eventSoundResolver 未定义');

        expect(resolver({ type: SW_EVENTS.CONTROL_TRANSFERRED } as AudioEvent, mockContext)).toBe(MAGIC_SHOCK_KEY);
        expect(resolver({ type: SW_EVENTS.SOUL_TRANSFER_REQUESTED } as AudioEvent, mockContext)).toBe(PROMPT_KEY);
    });

    it('应按阶段切换 BGM', () => {
        const rules = SUMMONER_WARS_AUDIO_CONFIG.bgmRules ?? [];
        const attackKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'attack' } }))?.key;
        const normalKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'summon' } }))?.key;
        expect(attackKey).toBe(BGM_BATTLE_KEY);
        expect(normalKey).toBe(BGM_NORMAL_KEY);
    });

    it('游戏结束应触发胜负音效', () => {
        const trigger = SUMMONER_WARS_AUDIO_CONFIG.stateTriggers?.[0];
        if (!trigger) throw new Error('stateTriggers 未定义');

        const shouldTrigger = trigger.condition(
            { G: {}, ctx: { isGameOver: false }, meta: {} } as any,
            { G: {}, ctx: { isGameOver: true }, meta: {} } as any
        );
        expect(shouldTrigger).toBe(true);
        expect(trigger.resolveSound?.({} as any, { ctx: { isWinner: true } } as any)).toBe(STINGER_WIN_KEY);
        expect(trigger.resolveSound?.({} as any, { ctx: { isWinner: false } } as any)).toBe(STINGER_LOSE_KEY);
    });

    it('所有使用到的 key 必须存在于 registry', () => {
        const keys = [
            BGM_NORMAL_KEY,
            BGM_BATTLE_KEY,
            STINGER_WIN_KEY,
            STINGER_LOSE_KEY,
            MAGIC_GAIN_KEY,
            MAGIC_SPEND_KEY,
            SUMMON_KEY,
            MOVE_KEY,
            BUILD_KEY,
            CARD_DRAW_KEY,
            CARD_DISCARD_KEY,
            EVENT_PLAY_KEY,
            UNIT_CHARGE_KEY,
            DAMAGE_LIGHT_KEY,
            DAMAGE_HEAVY_KEY,
            UNIT_DESTROY_KEY,
            STRUCTURE_DAMAGE_KEY,
            MAGIC_SHOCK_KEY,
            HEAL_KEY,
            HEAL_MODE_KEY,
            POSITIVE_SIGNAL_KEY,
            UPDATE_CHIME_KEY,
            SELECTION_KEY,
            PROMPT_KEY,
            ...MELEE_LIGHT_KEYS,
            ...MELEE_HEAVY_KEYS,
            ...RANGED_ATTACK_KEYS,
            ...MOVE_SWING_KEYS,
            ...Object.values(ABILITY_KEYS),
            ...abilitySfxKeys,
        ];

        for (const key of keys) {
            expect(registryMap.has(key)).toBe(true);
        }
    });
});
