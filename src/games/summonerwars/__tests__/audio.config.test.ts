/**
 * 召唤师战争音效配置测试
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AudioEvent } from '../../../lib/audio/types';
import {
    resolveDiceRollSound,
    SUMMONER_WARS_AUDIO_CONFIG,
} from '../audio.config';
import { SW_EVENTS } from '../domain/types';
import { abilityRegistry } from '../domain/abilities';

const BGM_TO_THE_WALL_KEY = 'bgm.fantasy.fantasy_music_pack_vol.to_the_wall_rt_2.to_the_wall_main';
const BGM_TO_THE_WALL_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.to_the_wall_rt_2.to_the_wall_intensity_2';
const BGM_CORSAIR_KEY = 'bgm.fantasy.fantasy_music_pack_vol.corsair_rt_3.fantasy_vol5_corsair_main';
const BGM_LONELY_BARD_KEY = 'bgm.fantasy.fantasy_music_pack_vol.lonely_bard_rt_3.fantasy_vol5_lonely_bard_main';
const BGM_CORSAIR_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.corsair_rt_3.fantasy_vol5_corsair_intensity_2';
const BGM_LONELY_BARD_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.lonely_bard_rt_3.fantasy_vol5_lonely_bard_intensity_2';
const BGM_LUMINESCE_KEY = 'bgm.ethereal.ethereal_music_pack.luminesce_rt_4.ethereal_luminesce_main';
const BGM_LUMINESCE_INTENSE_KEY = 'bgm.ethereal.ethereal_music_pack.luminesce_rt_4.ethereal_luminesce_intensity_2';
const BGM_WIND_CHIME_KEY = 'bgm.ethereal.ethereal_music_pack.wind_chime_rt_5.ethereal_wind_chime_main';
const BGM_WIND_CHIME_INTENSE_KEY = 'bgm.ethereal.ethereal_music_pack.wind_chime_rt_5.ethereal_wind_chime_intensity_2';
const BGM_ELDER_AWAKENING_KEY = 'bgm.fantasy.fantasy_music_pack_vol.elder_awakening_rt_2.fantasy_vol7_elder_awakening_main';
const BGM_ELDER_AWAKENING_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.elder_awakening_rt_2.fantasy_vol7_elder_awakening_intensity_2';
const BGM_FEYSONG_KEY = 'bgm.fantasy.fantasy_music_pack_vol.feysong_fields_rt_3.fantasy_vol7_feysong_fields_main';
const BGM_FEYSONG_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.feysong_fields_rt_3.fantasy_vol7_feysong_fields_intensity_2';
const BGM_STONE_CHANT_KEY = 'bgm.fantasy.fantasy_music_pack_vol.stone_chant_rt_3.fantasy_vol8_stone_chant_main';
const BGM_STONE_CHANT_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.stone_chant_rt_3.fantasy_vol8_stone_chant_intensity_2';
const STINGER_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const STINGER_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const MAGIC_GAIN_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
const MAGIC_SPEND_KEY = 'status.general.player_status_sound_fx_pack.fantasy.fantasy_dispel_001';
const SUMMON_KEY = 'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_06_krst';
const MOVE_FALLBACK_KEY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.armor_movement_h';
const FACTION_MOVE_KEYS: Record<string, string[]> = {
    necromancer: [
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_01',
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_02',
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_03',
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_04',
    ],
    goblin: [
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_01',
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_02',
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_03',
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_04',
    ],
    paladin: [
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_01',
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_02',
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_03',
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_04',
    ],
    barbaric: [
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_01',
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_02',
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_03',
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_04',
    ],
};
const ALL_MOVE_KEYS = [
    MOVE_FALLBACK_KEY,
    ...Object.values(FACTION_MOVE_KEYS).flat(),
];
const BUILD_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const GATE_BUILD_KEYS = [
    'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_01_krst',
    'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_02_krst',
    'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_03_krst',
];
const GATE_DESTROY_KEYS = [
    'magic.general.spells_variations_vol_1.close_temporal_rift_summoning.magspel_close_temporal_rift_summoning_01_krst',
    'magic.general.spells_variations_vol_1.close_temporal_rift_summoning.magspel_close_temporal_rift_summoning_02_krst',
    'magic.general.spells_variations_vol_1.close_temporal_rift_summoning.magspel_close_temporal_rift_summoning_03_krst',
];
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const EVENT_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const UNIT_CHARGE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const DAMAGE_LIGHT_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const DAMAGE_HEAVY_KEY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
const UNIT_DESTROY_KEY = 'combat.general.fight_fury_vol_2.body_hitting_the_ground_with_blood.fghtbf_body_hitting_the_ground_with_blood_01_krst';
const STRUCTURE_DAMAGE_KEY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.shield_impact_a';
const STRUCTURE_DESTROY_KEY = 'magic.general.spells_variations_vol_2.stonecrash_impact.magelem_stonecrash_impact_01_krst_none';
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

const DICE_ROLL_SINGLE_KEY = 'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_001';
const DICE_ROLL_MULTI_KEYS = [
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_001',
    'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_003',
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_005',
];
const DICE_ROLL_KEYS = [DICE_ROLL_SINGLE_KEY, ...DICE_ROLL_MULTI_KEYS];

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
const registryExists = fs.existsSync(REGISTRY_PATH);
const registryRaw = registryExists ? fs.readFileSync(REGISTRY_PATH, 'utf-8') : '{"entries":[]}';
const registry = JSON.parse(registryRaw) as { entries: Array<{ key: string }> };
const registryMap = new Map(registry.entries.map(entry => [entry.key, entry]));

const mockContext = {
    G: {},
    ctx: { currentPhase: 'summon', isGameOver: false },
    meta: { currentPlayerId: '0' },
} as any;

const resolveKey = (event: AudioEvent): string | undefined => {
    const resolver = SUMMONER_WARS_AUDIO_CONFIG.feedbackResolver;
    if (!resolver) throw new Error('feedbackResolver 未定义');
    const result = resolver(event, mockContext);
    return result ?? undefined;
};

describe('Summoner Wars 音效配置', () => {
    it('应解析基础事件音效', () => {
        expect(resolveKey({ type: SW_EVENTS.FACTION_SELECTED } as AudioEvent)).toBe(SELECTION_KEY);
        expect(resolveKey({ type: SW_EVENTS.PLAYER_READY } as AudioEvent)).toBe(POSITIVE_SIGNAL_KEY);
        expect(resolveKey({ type: SW_EVENTS.HOST_STARTED } as AudioEvent)).toBe(UPDATE_CHIME_KEY);
        // UNIT_SUMMONED 音效由 FX 系统播放，不在 feedbackResolver 中返回
        expect(resolveKey({ type: SW_EVENTS.UNIT_SUMMONED } as AudioEvent)).toBeUndefined();
        expect(resolveKey({ type: SW_EVENTS.UNIT_MOVED } as AudioEvent)).toBe(MOVE_FALLBACK_KEY);
        expect(resolveKey({ type: SW_EVENTS.STRUCTURE_BUILT } as AudioEvent)).toBe(BUILD_KEY);
        expect(resolveKey({ type: SW_EVENTS.CARD_DRAWN } as AudioEvent)).toBe(CARD_DRAW_KEY);
        expect(resolveKey({ type: SW_EVENTS.CARD_DISCARDED } as AudioEvent)).toBe(CARD_DISCARD_KEY);
        expect(resolveKey({ type: SW_EVENTS.EVENT_PLAYED } as AudioEvent)).toBe(EVENT_PLAY_KEY);
        expect(resolveKey({ type: SW_EVENTS.UNIT_CHARGED } as AudioEvent)).toBe(UNIT_CHARGE_KEY);
        expect(resolveKey({ type: SW_EVENTS.HEALING_MODE_SET } as AudioEvent)).toBe(HEAL_MODE_KEY);
    });

    it('应区分传送门与城墙的建造/摧毁音效', () => {
        // 城墙建造 → 放置音
        const wallBuild = resolveKey({ type: SW_EVENTS.STRUCTURE_BUILT, payload: { card: { isGate: false } } } as AudioEvent);
        expect(wallBuild).toBe(BUILD_KEY);

        // 传送门建造 → 时空裂隙打开音
        const gateBuild = resolveKey({ type: SW_EVENTS.STRUCTURE_BUILT, payload: { card: { isGate: true } } } as AudioEvent);
        expect(GATE_BUILD_KEYS).toContain(gateBuild);

        // 城墙摧毁 → 石块崩碎（有动画，音效由动画层播放）
        const wallDestroy = resolveKey({
            type: SW_EVENTS.STRUCTURE_DESTROYED,
            payload: { isGate: false },
        } as AudioEvent);
        expect(wallDestroy).toBeUndefined();

        // 传送门摧毁 → 时空裂隙关闭音（有动画，音效由动画层播放）
        const gateDestroy = resolveKey({
            type: SW_EVENTS.STRUCTURE_DESTROYED,
            payload: { isGate: true },
        } as AudioEvent);
        expect(gateDestroy).toBeUndefined();
    });

    it('应解析伤害与治疗音效', () => {
        // 有动画的事件返回 undefined，音效由动画层播放
        expect(resolveKey({ type: SW_EVENTS.UNIT_DAMAGED, payload: { damage: 1 } } as AudioEvent)).toBeUndefined();
        expect(resolveKey({ type: SW_EVENTS.UNIT_DAMAGED, payload: { damage: 3 } } as AudioEvent)).toBeUndefined();
        // 治疗音效无动画，直接播放
        expect(resolveKey({ type: SW_EVENTS.UNIT_HEALED } as AudioEvent)).toBe(HEAL_KEY);
        expect(resolveKey({ type: SW_EVENTS.STRUCTURE_HEALED } as AudioEvent)).toBe(HEAL_KEY);
        // 摧毁有动画，音效由动画层播放
        expect(resolveKey({ type: SW_EVENTS.UNIT_DESTROYED } as AudioEvent)).toBeUndefined();
    });

    it('应解析魔力变化音效', () => {
        const gain = resolveKey({ type: SW_EVENTS.MAGIC_CHANGED, payload: { delta: 2 } } as AudioEvent);
        const spend = resolveKey({ type: SW_EVENTS.MAGIC_CHANGED, payload: { delta: -1 } } as AudioEvent);
        expect(gain).toBe(MAGIC_GAIN_KEY);
        expect(spend).toBe(MAGIC_SPEND_KEY);
    });

    it('应解析近战/远程与位移音效', () => {
        // 攻击有动画，音效由动画层播放
        const attackKey = resolveKey({ type: SW_EVENTS.UNIT_ATTACKED } as AudioEvent);
        expect(attackKey).toBeUndefined();
        const rangedKey = resolveKey({
            type: SW_EVENTS.UNIT_ATTACKED,
            payload: { attackType: 'ranged' },
        } as AudioEvent);
        expect(rangedKey).toBeUndefined();

        // 位移音效无动画，直接播放
        const moveKey = resolveKey({ type: SW_EVENTS.UNIT_PUSHED } as AudioEvent);
        expect(MOVE_SWING_KEYS).toContain(moveKey);
    });

    it('掷骰音效应按骰子数量选择', () => {
        const single = resolveDiceRollSound(1);
        expect(single).toBe(DICE_ROLL_SINGLE_KEY);

        const multi = resolveDiceRollSound(3);
        expect(DICE_ROLL_MULTI_KEYS).toContain(multi);
    });

    it('应解析技能音效', () => {
        // revive_undead 的召唤音效由 FX 系统播放，不在 feedbackResolver 中返回
        const reviveKey = resolveKey({ type: SW_EVENTS.UNIT_SUMMONED, payload: { sourceAbilityId: 'revive_undead' } } as AudioEvent);
        const telekinesisKey = resolveKey({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'telekinesis' } } as AudioEvent);
        const guidanceKey = resolveKey({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'guidance' } } as AudioEvent);
        const vanishKey = resolveKey({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'vanish' } } as AudioEvent);
        const structureShiftKey = resolveKey({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'structure_shift' } } as AudioEvent);
        const rapidFireKey = resolveKey({ type: SW_EVENTS.ABILITY_TRIGGERED, payload: { abilityId: 'rapid_fire' } } as AudioEvent);
        expect(reviveKey).toBeUndefined(); // 召唤音效由 FX 系统播放
        expect(telekinesisKey).toBe(ABILITY_KEYS.telekinesis);
        expect(guidanceKey).toBe(ABILITY_KEYS.guidance);
        expect(vanishKey).toBe(ABILITY_KEYS.vanish);
        expect(structureShiftKey).toBe(ABILITY_KEYS.structureShift);
        expect(rapidFireKey).toBe(ABILITY_KEYS.rapidFire);
    });

    it('应解析控制与请求音效', () => {
        expect(resolveKey({ type: SW_EVENTS.CONTROL_TRANSFERRED } as AudioEvent)).toBe(MAGIC_SHOCK_KEY);
        expect(resolveKey({ type: SW_EVENTS.SOUL_TRANSFER_REQUESTED } as AudioEvent)).toBe(PROMPT_KEY);
    });

    it('上下文预加载包含已选阵营的移动与技能音效', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.contextualPreloadKeys;
        if (!resolver) throw new Error('contextualPreloadKeys 未定义');

        const keys = resolver({
            G: {
                selectedFactions: { '0': 'goblin', '1': 'unselected' },
            },
            ctx: {},
            meta: { currentPlayerId: '0' },
        } as any);

        // 阵营专属音效
        const expectedMove = FACTION_MOVE_KEYS.goblin ?? [];
        expectedMove.forEach((key) => {
            expect(keys).toContain(key);
        });
        expect(keys).toContain(ABILITY_KEYS.vanish);

        // 通用战斗音效（选角后即预加载）
        MELEE_LIGHT_KEYS.forEach((key) => expect(keys).toContain(key));
        MELEE_HEAVY_KEYS.forEach((key) => expect(keys).toContain(key));
        RANGED_ATTACK_KEYS.forEach((key) => expect(keys).toContain(key));
        MOVE_SWING_KEYS.forEach((key) => expect(keys).toContain(key));
        DICE_ROLL_KEYS.forEach((key) => expect(keys).toContain(key));
        expect(keys).toContain(DAMAGE_HEAVY_KEY);
        expect(keys).toContain(UNIT_DESTROY_KEY);
        expect(keys).toContain(STRUCTURE_DAMAGE_KEY);
        expect(keys).toContain(STRUCTURE_DESTROY_KEY);
        GATE_BUILD_KEYS.forEach((key) => expect(keys).toContain(key));
        GATE_DESTROY_KEYS.forEach((key) => expect(keys).toContain(key));
    });

    it('无人选角时不预加载', () => {
        const resolver = SUMMONER_WARS_AUDIO_CONFIG.contextualPreloadKeys;
        if (!resolver) throw new Error('contextualPreloadKeys 未定义');

        const keys = resolver({
            G: {
                selectedFactions: { '0': 'unselected', '1': 'unselected' },
            },
            ctx: {},
            meta: { currentPlayerId: '0' },
        } as any);

        expect(keys).toHaveLength(0);
    });

    it('应按阶段切换 BGM', () => {
        const rules = SUMMONER_WARS_AUDIO_CONFIG.bgmRules ?? [];
        const attackKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'attack' } }))?.key;
        const normalKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'summon' } }))?.key;
        expect(attackKey).toBe(BGM_STONE_CHANT_KEY);
        expect(normalKey).toBe(BGM_TO_THE_WALL_KEY);
    });

    it('应定义 BGM 分组', () => {
        const groups = (SUMMONER_WARS_AUDIO_CONFIG.bgmGroups ?? {}) as Record<string, string[]>;
        expect(groups.normal).toBeDefined();
        expect(groups.battle).toBeDefined();
        expect(groups.normal).toContain(BGM_TO_THE_WALL_KEY);
        expect(groups.battle).toContain(BGM_STONE_CHANT_KEY);
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

    it.skipIf(!registryExists)('所有使用到的 key 必须存在于 registry', () => {
        const keys = [
            BGM_TO_THE_WALL_KEY,
            BGM_TO_THE_WALL_INTENSE_KEY,
            BGM_CORSAIR_KEY,
            BGM_LONELY_BARD_KEY,
            BGM_CORSAIR_INTENSE_KEY,
            BGM_LONELY_BARD_INTENSE_KEY,
            BGM_LUMINESCE_KEY,
            BGM_LUMINESCE_INTENSE_KEY,
            BGM_WIND_CHIME_KEY,
            BGM_WIND_CHIME_INTENSE_KEY,
            BGM_ELDER_AWAKENING_KEY,
            BGM_ELDER_AWAKENING_INTENSE_KEY,
            BGM_FEYSONG_KEY,
            BGM_FEYSONG_INTENSE_KEY,
            BGM_STONE_CHANT_KEY,
            BGM_STONE_CHANT_INTENSE_KEY,
            STINGER_WIN_KEY,
            STINGER_LOSE_KEY,
            MAGIC_GAIN_KEY,
            MAGIC_SPEND_KEY,
            SUMMON_KEY,
            ...ALL_MOVE_KEYS,
            BUILD_KEY,
            ...GATE_BUILD_KEYS,
            ...GATE_DESTROY_KEYS,
            CARD_DRAW_KEY,
            CARD_DISCARD_KEY,
            EVENT_PLAY_KEY,
            UNIT_CHARGE_KEY,
            DAMAGE_LIGHT_KEY,
            DAMAGE_HEAVY_KEY,
            UNIT_DESTROY_KEY,
            STRUCTURE_DAMAGE_KEY,
            STRUCTURE_DESTROY_KEY,
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
            ...DICE_ROLL_KEYS,
            ...Object.values(ABILITY_KEYS),
            ...abilitySfxKeys,
        ];

        const missing: string[] = [];
        for (const key of keys) {
            if (!registryMap.has(key)) {
                missing.push(key);
            }
        }
        
        if (missing.length > 0) {
            console.error('Missing keys from registry:', missing);
        }
        expect(missing).toEqual([]);
    });
});
