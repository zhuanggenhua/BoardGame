/**
 * DiceThrone 音效配置单元测试
 * 验证 CP 音效和 Monk 技能音效配置的正确性
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { ALL_TOKEN_DEFINITIONS } from '../domain/characters';
import { MONK_ABILITIES } from '../heroes/monk/abilities';
import type { AudioEvent } from '../../../lib/audio/types';

const CP_GAIN_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
const CP_SPEND_KEY = 'status.general.player_status_sound_fx_pack.fantasy.fantasy_dispel_001';
const DICE_ROLL_SINGLE_KEY = 'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_001';
const DICE_ROLL_MULTI_KEYS = [
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_001',
    'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_003',
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_005',
];

const originalRandom = Math.random;

afterEach(() => {
    (Math.random as unknown as typeof Math.random) = originalRandom;
    vi.clearAllMocks();
});

/** 提取 feedbackResolver 返回的 SoundKey */
const resolveKey = (event: AudioEvent, ctx: unknown = { G: {}, ctx: {}, meta: {} }): string | null => {
    return DICETHRONE_AUDIO_CONFIG.feedbackResolver(event, ctx as never);
};

const ABILITY_SFX_KEYS = {
    transcendence: 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_02_krst',
    thunderStrike: 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst',
    taijiCombo: 'combat.general.mini_games_sound_effects_and_music_pack.kick_punch.sfx_fight_kick_swoosh_1',
} as const;

describe('DiceThrone 音效配置', () => {
    describe('CP 音效配置', () => {
        it('feedbackResolver 应根据 delta 正负值返回正确的 CP 音效键', () => {
            // 测试 CP 增加
            const gainEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 2 } };
            expect(resolveKey(gainEvent)).toBe(CP_GAIN_KEY);

            // 测试 CP 减少
            const spendEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: -3 } };
            expect(resolveKey(spendEvent)).toBe(CP_SPEND_KEY);

            // 测试 delta 为 0（边界情况）
            const zeroEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 0 } };
            expect(resolveKey(zeroEvent)).toBe(CP_GAIN_KEY); // delta >= 0 返回 cp_gain
        });
    });

    describe('掷骰音效配置', () => {
        it('单骰结果应返回单骰音效', () => {
            const event: AudioEvent = { type: 'DICE_ROLLED', payload: { results: [1], rollerId: '0' } } as AudioEvent;
            expect(resolveKey(event)).toBe(DICE_ROLL_SINGLE_KEY);
        });

        it('多骰结果应从多骰池中选择', () => {
            (Math.random as unknown as typeof Math.random) = vi.fn(() => 0);
            const event: AudioEvent = { type: 'DICE_ROLLED', payload: { results: [1, 2], rollerId: '0' } } as AudioEvent;
            expect(DICE_ROLL_MULTI_KEYS).toContain(resolveKey(event));
        });
    });

    describe('Monk 技能音效配置', () => {
        it('超凡入圣技能应配置正确的 sfxKey', () => {
            const transcendence = MONK_ABILITIES.find(a => a.id === 'transcendence');
            expect(transcendence).toBeDefined();
            expect(transcendence?.sfxKey).toBe(ABILITY_SFX_KEYS.transcendence);
        });

        it('雷霆一击技能应配置正确的 sfxKey', () => {
            const thunderStrike = MONK_ABILITIES.find(a => a.id === 'thunder-strike');
            expect(thunderStrike).toBeDefined();
            expect(thunderStrike?.sfxKey).toBe(ABILITY_SFX_KEYS.thunderStrike);
        });

        it('太极连击技能应配置正确的 sfxKey', () => {
            const taijiCombo = MONK_ABILITIES.find(a => a.id === 'taiji-combo');
            expect(taijiCombo).toBeDefined();
            expect(taijiCombo?.sfxKey).toBe(ABILITY_SFX_KEYS.taijiCombo);
        });

        it('防御技能不播放音效', () => {
            const meditation = MONK_ABILITIES.find(a => a.id === 'meditation');
            expect(meditation).toBeDefined();
            expect(meditation?.sfxKey).toBeUndefined();

            // ABILITY_ACTIVATED 事件在 feedbackResolver 中返回 null（技能音效由动画冲击帧驱动）
            const event: AudioEvent = {
                type: 'ABILITY_ACTIVATED',
                payload: { playerId: 'player1', abilityId: 'meditation', isDefense: true },
            };
            const mockContext = {
                G: {
                    players: {
                        player1: { heroId: 'monk', abilities: MONK_ABILITIES },
                    },
                },
                ctx: {},
                meta: {},
            };
            expect(resolveKey(event, mockContext)).toBeNull();
        });
    });

    describe('BGM 配置', () => {
        it('应有 16 首 BGM（4 normal + 12 battle）', () => {
            expect(DICETHRONE_AUDIO_CONFIG.bgm).toHaveLength(16);
        });

        it('BGM 不应与 SW 撞曲（禁止 Corsair / Lonely Bard / Luminesce / Wind Chime / Elder Awakening / Feysong Fields）', () => {
            const keys = DICETHRONE_AUDIO_CONFIG.bgm!.map(b => b.key);
            expect(keys).not.toContain('bgm.fantasy.fantasy_music_pack_vol.corsair_rt_3.fantasy_vol5_corsair_main');
            expect(keys).not.toContain('bgm.fantasy.fantasy_music_pack_vol.lonely_bard_rt_3.fantasy_vol5_lonely_bard_main');
            expect(keys).not.toContain('bgm.ethereal.ethereal_music_pack.luminesce_rt_4.ethereal_luminesce_main');
            expect(keys).not.toContain('bgm.ethereal.ethereal_music_pack.wind_chime_rt_5.ethereal_wind_chime_main');
            expect(keys).not.toContain('bgm.fantasy.fantasy_music_pack_vol.elder_awakening_rt_2.fantasy_vol7_elder_awakening_main');
            expect(keys).not.toContain('bgm.fantasy.fantasy_music_pack_vol.feysong_fields_rt_3.fantasy_vol7_feysong_fields_main');
        });

        it('应有 bgmGroups（normal + battle）', () => {
            expect(DICETHRONE_AUDIO_CONFIG.bgmGroups).toBeDefined();
            expect(DICETHRONE_AUDIO_CONFIG.bgmGroups!.normal).toBeDefined();
            expect(DICETHRONE_AUDIO_CONFIG.bgmGroups!.battle).toBeDefined();
            expect(DICETHRONE_AUDIO_CONFIG.bgmGroups!.normal.length).toBeGreaterThanOrEqual(3);
            expect(DICETHRONE_AUDIO_CONFIG.bgmGroups!.battle.length).toBeGreaterThanOrEqual(3);
        });

        it('bgmRules 应按阶段切换 group', () => {
            const rules = DICETHRONE_AUDIO_CONFIG.bgmRules ?? [];
            const battleRule = rules.find(r => r.when({ G: {}, ctx: { currentPhase: 'offensiveRoll' }, meta: {} } as never));
            const normalRule = rules.find(r => r.when({ G: {}, ctx: { currentPhase: 'upkeep' }, meta: {} } as never));
            expect(battleRule?.group).toBe('battle');
            expect(normalRule?.group).toBe('normal');
        });

        it('所有 BGM key 必须存在于 registry', () => {
            const registryPath = require('path').join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
            if (!require('fs').existsSync(registryPath)) {
                return; // registry.json 是生成产物，CI 环境可能不存在
            }
            const registryRaw = require('fs').readFileSync(registryPath, 'utf-8');
            const registry = JSON.parse(registryRaw) as { entries: Array<{ key: string }> };
            const registryMap = new Map(registry.entries.map(e => [e.key, e]));
            for (const bgm of DICETHRONE_AUDIO_CONFIG.bgm!) {
                expect(registryMap.has(bgm.key), `BGM key 不在 registry: ${bgm.key}`).toBe(true);
            }
        });
    });

    describe('状态/Token 音效映射', () => {
        it('状态施加应返回 null（音效由动画层 onImpact 播放）', () => {
            const event: AudioEvent = {
                type: 'STATUS_APPLIED',
                payload: { statusId: STATUS_IDS.BURN },
            };
            const result = resolveKey(event, { G: { tokenDefinitions: ALL_TOKEN_DEFINITIONS }, ctx: {}, meta: {} });
            expect(result).toBeNull();
        });

        it('Token 授予应返回 null（音效由动画层 onImpact 播放）', () => {
            const event: AudioEvent = {
                type: 'TOKEN_GRANTED',
                payload: { tokenId: TOKEN_IDS.TAIJI },
            };
            const result = resolveKey(event, { G: { tokenDefinitions: ALL_TOKEN_DEFINITIONS }, ctx: {}, meta: {} });
            expect(result).toBeNull();
        });
    });
});
