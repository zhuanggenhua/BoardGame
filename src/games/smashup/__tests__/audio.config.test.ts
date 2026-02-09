/**
 * Smash Up 音效配置测试
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AudioEvent } from '../../../lib/audio/types';
import { SMASHUP_AUDIO_CONFIG } from '../audio.config';
import { SU_EVENTS } from '../domain/types';

const BGM_NORMAL_KEY = 'bgm.general.casual_music_pack_vol.tiki_party_rt_2.casual_tiki_party_main';
const BGM_BATTLE_KEY = 'bgm.general.casual_music_pack_vol.tiki_party_rt_2.casual_tiki_party_intensity_2';
const STINGER_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const STINGER_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const SELECTION_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const POSITIVE_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const UPDATE_CHIME_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const PROMPT_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_spring_a';

const MINION_PLAY_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const ACTION_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const CARD_SHUFFLE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001';
const CARD_SCROLL_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001';

const MOVE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001';
const MINION_DESTROY_KEY = 'combat.general.fight_fury_vol_2.body_hitting_the_ground_with_blood.fghtbf_body_hitting_the_ground_with_blood_01_krst';
const POWER_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const POWER_LOSE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
const TALENT_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001';
const MADNESS_KEY = 'magic.dark.32.dark_spell_01';

const ZOMBIE_MINION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_001',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_002',
    'magic.general.spells_variations_vol_2.undead_wail_impact.magevil_undead_wail_impact_01_krst_none',
];
const ZOMBIE_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_002',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_003',
];
const WIZARD_MINION_KEYS = [
    'magic.general.spells_variations_vol_1.arcane_blast.magspel_arcane_blast_01_krst',
    'magic.general.spells_variations_vol_1.arcane_blast.magspel_arcane_blast_02_krst',
    'magic.general.spells_variations_vol_1.arcane_blast.magspel_arcane_blast_03_krst',
];
const WIZARD_ACTION_KEYS = [
    'magic.general.spells_variations_vol_1.little_arcane_blast.magspel_little_arcane_blast_01_krst',
    'magic.general.spells_variations_vol_1.little_arcane_blast.magspel_little_arcane_blast_02_krst',
    'magic.general.spells_variations_vol_1.little_arcane_blast.magspel_little_arcane_blast_03_krst',
];
const DINO_MINION_KEYS = [
    'monster.general.files.14.short_roar_01',
    'monster.general.files.14.short_roar_02',
    'monster.general.files.15.long_roar_01',
];
const DINO_ACTION_KEYS = [
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_01_krst_none',
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_02_krst_none',
    'magic.fire.3.fire_earthquake',
];
const ALIEN_MINION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_charge_generic_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_charge_generic_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_charge_generic_3',
];
const ALIEN_ACTION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_shoot_3',
];
const PIRATE_MINION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_retro_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_retro_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_retro_shoot_3',
];
const PIRATE_ACTION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_b_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_b_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_b_shoot_3',
];
const NINJA_MINION_KEYS = [
    'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_01_krst',
    'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_02_krst',
    'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_03_krst',
];
const NINJA_ACTION_KEYS = [
    'combat.general.forged_in_fury_vol_1.katana.katana_only_hit_layer.fghtimpt_katana_only_hit_layer_01_krst',
    'combat.general.forged_in_fury_vol_1.katana.katana_only_hit_layer.fghtimpt_katana_only_hit_layer_02_krst',
    'combat.general.forged_in_fury_vol_1.katana.katana_only_hit_layer.fghtimpt_katana_only_hit_layer_03_krst',
];

const ALL_KEYS = [
    BGM_NORMAL_KEY,
    BGM_BATTLE_KEY,
    STINGER_WIN_KEY,
    STINGER_LOSE_KEY,
    SELECTION_KEY,
    POSITIVE_SIGNAL_KEY,
    UPDATE_CHIME_KEY,
    PROMPT_KEY,
    MINION_PLAY_KEY,
    ACTION_PLAY_KEY,
    CARD_DRAW_KEY,
    CARD_DISCARD_KEY,
    CARD_SHUFFLE_KEY,
    CARD_SCROLL_KEY,
    MOVE_KEY,
    MINION_DESTROY_KEY,
    POWER_GAIN_KEY,
    POWER_LOSE_KEY,
    TALENT_KEY,
    MADNESS_KEY,
    ...ZOMBIE_MINION_KEYS,
    ...ZOMBIE_ACTION_KEYS,
    ...WIZARD_MINION_KEYS,
    ...WIZARD_ACTION_KEYS,
    ...DINO_MINION_KEYS,
    ...DINO_ACTION_KEYS,
];

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
const registry = JSON.parse(registryRaw) as { entries: Array<{ key: string }> };
const registryMap = new Map(registry.entries.map(entry => [entry.key, entry]));

const mockContext = {
    G: {},
    ctx: { currentPhase: 'playCards', isGameOver: false },
    meta: { currentPlayerId: '0' },
} as any;

describe('Smash Up 音效配置', () => {
    it('应解析基础事件音效', () => {
        const resolver = SMASHUP_AUDIO_CONFIG.eventSoundResolver;
        if (!resolver) throw new Error('eventSoundResolver 未定义');

        expect(resolver({ type: SU_EVENTS.FACTION_SELECTED } as AudioEvent, mockContext)).toBe(SELECTION_KEY);
        expect(resolver({ type: SU_EVENTS.ALL_FACTIONS_SELECTED } as AudioEvent, mockContext)).toBe(UPDATE_CHIME_KEY);
        const zombieMinion = resolver({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'zombie_lord' } } as AudioEvent, mockContext);
        const zombieAction = resolver({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'zombie_grave_robbing' } } as AudioEvent, mockContext);
        const wizardMinion = resolver({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'wizard_archmage' } } as AudioEvent, mockContext);
        const wizardAction = resolver({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'wizard_summon' } } as AudioEvent, mockContext);
        const dinoMinion = resolver({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'dino_king_rex' } } as AudioEvent, mockContext);
        const dinoAction = resolver({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'dino_howl' } } as AudioEvent, mockContext);
        const talentUsed = resolver({ type: SU_EVENTS.TALENT_USED, payload: { defId: 'wizard_archmage' } } as AudioEvent, mockContext);

        expect(ZOMBIE_MINION_KEYS).toContain(zombieMinion);
        expect(ZOMBIE_ACTION_KEYS).toContain(zombieAction);
        expect(WIZARD_MINION_KEYS).toContain(wizardMinion);
        expect(WIZARD_ACTION_KEYS).toContain(wizardAction);
        expect(DINO_MINION_KEYS).toContain(dinoMinion);
        expect(DINO_ACTION_KEYS).toContain(dinoAction);
        expect(WIZARD_MINION_KEYS).toContain(talentUsed);
        expect(resolver({ type: SU_EVENTS.CARDS_DRAWN } as AudioEvent, mockContext)).toBe(CARD_DRAW_KEY);
        expect(resolver({ type: SU_EVENTS.CARDS_DISCARDED } as AudioEvent, mockContext)).toBe(CARD_DISCARD_KEY);
        expect(resolver({ type: SU_EVENTS.DECK_RESHUFFLED } as AudioEvent, mockContext)).toBe(CARD_SHUFFLE_KEY);
        expect(resolver({ type: SU_EVENTS.MINION_RETURNED } as AudioEvent, mockContext)).toBe(CARD_SCROLL_KEY);
        expect(resolver({ type: SU_EVENTS.MINION_DESTROYED } as AudioEvent, mockContext)).toBe(MINION_DESTROY_KEY);
        expect(resolver({ type: SU_EVENTS.MINION_MOVED } as AudioEvent, mockContext)).toBe(MOVE_KEY);
        expect(resolver({ type: SU_EVENTS.POWER_COUNTER_ADDED } as AudioEvent, mockContext)).toBe(POWER_GAIN_KEY);
        expect(resolver({ type: SU_EVENTS.POWER_COUNTER_REMOVED } as AudioEvent, mockContext)).toBe(POWER_LOSE_KEY);
        expect(resolver({ type: SU_EVENTS.MADNESS_DRAWN } as AudioEvent, mockContext)).toBe(MADNESS_KEY);
        expect(resolver({ type: SU_EVENTS.MADNESS_RETURNED } as AudioEvent, mockContext)).toBe(MADNESS_KEY);
        expect(resolver({ type: SU_EVENTS.PROMPT_CONTINUATION } as AudioEvent, mockContext)).toBe(PROMPT_KEY);
    });

    it('应按阶段切换 BGM', () => {
        const rules = SMASHUP_AUDIO_CONFIG.bgmRules ?? [];
        const battleKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'playCards' } }))?.key;
        const normalKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'draw' } }))?.key;
        expect(battleKey).toBe(BGM_BATTLE_KEY);
        expect(normalKey).toBe(BGM_NORMAL_KEY);
    });

    it('游戏结束应触发胜负音效', () => {
        const trigger = SMASHUP_AUDIO_CONFIG.stateTriggers?.[0];
        if (!trigger) throw new Error('stateTriggers 未定义');

        const shouldTrigger = trigger.condition(
            { ...mockContext, ctx: { currentPhase: 'playCards', isGameOver: false } },
            { ...mockContext, ctx: { currentPhase: 'draw', isGameOver: true, isWinner: true } }
        );
        expect(shouldTrigger).toBe(true);

        const winKey = trigger.resolveSound?.(
            mockContext,
            { ...mockContext, ctx: { currentPhase: 'draw', isGameOver: true, isWinner: true } }
        );
        const loseKey = trigger.resolveSound?.(
            mockContext,
            { ...mockContext, ctx: { currentPhase: 'draw', isGameOver: true, isWinner: false } }
        );
        expect(winKey).toBe(STINGER_WIN_KEY);
        expect(loseKey).toBe(STINGER_LOSE_KEY);
    });

    it('音效 key 必须存在于 registry', () => {
        for (const key of ALL_KEYS) {
            expect(registryMap.has(key)).toBe(true);
        }
    });
});
