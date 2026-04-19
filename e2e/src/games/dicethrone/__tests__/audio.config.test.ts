/**
 * DiceThrone 音效配置单元测试
 * 验证 CP 音效和 Monk 技能音效配置的正确性
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { ALL_TOKEN_DEFINITIONS } from '../domain/characters';
import { MONK_ABILITIES } from '../heroes/monk/abilities';
import { GUNSLINGER_ABILITIES, GUNSLINGER_SFX_HEAVY, GUNSLINGER_SFX_SHOT, GUNSLINGER_SFX_ULTIMATE } from '../heroes/gunslinger/abilities';
import { SAMURAI_ABILITIES, SAMURAI_SFX_DEFENSE, SAMURAI_SFX_HEAVY, SAMURAI_SFX_LIGHT, SAMURAI_SFX_ULTIMATE } from '../heroes/samurai/abilities';
import { SAMURAI_TOKEN_SFX_HONOR, SAMURAI_TOKEN_SFX_RETRIBUTION, SAMURAI_TOKEN_SFX_SHAME } from '../heroes/samurai/tokens';
import type { AudioEvent } from '../../../lib/audio/types';

const DICE_ROLL_SINGLE_KEY = 'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_001';
const DICE_ROLL_MULTI_KEYS = [
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_001',
    'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_003',
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_005',
];
const READY_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const HOST_STARTED_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const PHASE_CHANGED_KEY = 'fantasy.gothic_fantasy_sound_fx_pack_vol.musical.drums_of_fate_002';

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
    revolver: GUNSLINGER_SFX_SHOT,
    showdown: GUNSLINGER_SFX_HEAVY,
    fillEmWithLead: GUNSLINGER_SFX_ULTIMATE,
    katanaSlice: SAMURAI_SFX_LIGHT,
    masamune: SAMURAI_SFX_HEAVY,
    standTall: SAMURAI_SFX_DEFENSE,
    samuraiUltimate: SAMURAI_SFX_ULTIMATE,
} as const;

describe('DiceThrone 音效配置', () => {
    describe('CP 音效配置', () => {
        it('feedbackResolver 应对 CP_CHANGED 返回 null（音效由 FX 飞行动画 onImpact 播放）', () => {
            const gainEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 2 } };
            expect(resolveKey(gainEvent)).toBeNull();

            const spendEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: -3 } };
            expect(resolveKey(spendEvent)).toBeNull();

            const zeroEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 0 } };
            expect(resolveKey(zeroEvent)).toBeNull();
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

    describe('选角阶段音效职责', () => {
        const localPlayerContext = { G: {}, ctx: {}, meta: { currentPlayerId: '0' } };

        it('CHARACTER_SELECTED 不应播放事件音（点击音由本地按钮负责）', () => {
            const event: AudioEvent = {
                type: 'CHARACTER_SELECTED',
                payload: { playerId: '0', characterId: 'monk' },
            } as AudioEvent;
            expect(resolveKey(event, localPlayerContext)).toBeNull();
        });

        it('PLAYER_READY 为本地玩家时不应播放事件音（避免与按钮点击音叠加）', () => {
            const event: AudioEvent = {
                type: 'PLAYER_READY',
                payload: { playerId: '0' },
            };
            expect(resolveKey(event, localPlayerContext)).toBeNull();
        });

        it('PLAYER_READY 为其他玩家时应播放提示音', () => {
            const event: AudioEvent = {
                type: 'PLAYER_READY',
                payload: { playerId: '1' },
            };
            expect(resolveKey(event, localPlayerContext)).toBe(READY_SIGNAL_KEY);
        });

        it('HOST_STARTED 为本地玩家时不应播放事件音（避免与按钮点击音叠加）', () => {
            const event: AudioEvent = {
                type: 'HOST_STARTED',
                payload: { playerId: '0' },
            };
            expect(resolveKey(event, localPlayerContext)).toBeNull();
        });

        it('HOST_STARTED 为其他玩家时应播放提示音', () => {
            const event: AudioEvent = {
                type: 'HOST_STARTED',
                payload: { playerId: '1' },
            };
            expect(resolveKey(event, localPlayerContext)).toBe(HOST_STARTED_SIGNAL_KEY);
        });

        it('开局 setup→upkeep 的 SYS_PHASE_CHANGED 不应播放（避免与开始音叠加）', () => {
            const event: AudioEvent = {
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'setup', to: 'upkeep' },
            };
            expect(resolveKey(event, { G: { turnNumber: 1 }, ctx: {}, meta: {} })).toBeNull();
        });

        it('开局 upkeep/income 自动连推的 SYS_PHASE_CHANGED 不应播放', () => {
            const eventFromUpkeep: AudioEvent = {
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'upkeep', to: 'income' },
            };
            const eventFromIncome: AudioEvent = {
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'income', to: 'main1' },
            };
            const context = { G: { turnNumber: 1 }, ctx: {}, meta: {} };
            expect(resolveKey(eventFromUpkeep, context)).toBeNull();
            expect(resolveKey(eventFromIncome, context)).toBeNull();
        });

        it('非开局阶段切换仍应播放阶段提示音', () => {
            const event: AudioEvent = {
                type: 'SYS_PHASE_CHANGED',
                payload: { from: 'main1', to: 'offensiveRoll' },
            };
            expect(resolveKey(event, { G: { turnNumber: 2 }, ctx: {}, meta: {} })).toBe(PHASE_CHANGED_KEY);
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

        it.skip('防御技能应播放默认技能音效（没有专属 sfxKey）', () => {
            const meditation = MONK_ABILITIES.find(a => a.id === 'meditation');
            expect(meditation).toBeDefined();
            expect(meditation?.sfxKey).toBeUndefined();

            // ABILITY_ACTIVATED 事件应返回默认技能音效
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
            // 没有专属 sfxKey 的技能应返回默认技能音效
            const result = resolveKey(event, mockContext);
            expect(result).toBe('ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001');
        });
    });

    describe('新英雄技能音效配置', () => {
        it('枪手核心技能应配置枪械主题音效', () => {
            expect(GUNSLINGER_ABILITIES.find(a => a.id === 'revolver')?.sfxKey).toBe(ABILITY_SFX_KEYS.revolver);
            expect(GUNSLINGER_ABILITIES.find(a => a.id === 'showdown')?.sfxKey).toBe(ABILITY_SFX_KEYS.showdown);
            expect(GUNSLINGER_ABILITIES.find(a => a.id === 'fill-em-with-lead')?.sfxKey).toBe(ABILITY_SFX_KEYS.fillEmWithLead);
        });

        it('武士核心技能应配置刀剑主题音效', () => {
            expect(SAMURAI_ABILITIES.find(a => a.id === 'katana-slice')?.sfxKey).toBe(ABILITY_SFX_KEYS.katanaSlice);
            expect(SAMURAI_ABILITIES.find(a => a.id === 'masamune')?.sfxKey).toBe(ABILITY_SFX_KEYS.masamune);
            expect(SAMURAI_ABILITIES.find(a => a.id === 'stand-tall')?.sfxKey).toBe(ABILITY_SFX_KEYS.standTall);
            expect(SAMURAI_ABILITIES.find(a => a.id === 'samurai-ultimate')?.sfxKey).toBe(ABILITY_SFX_KEYS.samuraiUltimate);
        });

        it('选中枪手后应预热枪手专属技能音效', () => {
            const keys = DICETHRONE_AUDIO_CONFIG.contextualPreloadKeys?.({
                G: { selectedCharacters: { '0': 'gunslinger' } },
                ctx: {},
                meta: {},
            } as never) ?? [];

            expect(keys).toContain(GUNSLINGER_SFX_SHOT);
            expect(keys).toContain(GUNSLINGER_SFX_HEAVY);
            expect(keys).toContain(GUNSLINGER_SFX_ULTIMATE);
        });

        it('选中武士后应预热武士专属技能音效', () => {
            const keys = DICETHRONE_AUDIO_CONFIG.contextualPreloadKeys?.({
                G: { selectedCharacters: { '0': 'samurai' } },
                ctx: {},
                meta: {},
            } as never) ?? [];

            expect(keys).toContain(SAMURAI_SFX_LIGHT);
            expect(keys).toContain(SAMURAI_SFX_HEAVY);
            expect(keys).toContain(SAMURAI_SFX_DEFENSE);
            expect(keys).toContain(SAMURAI_SFX_ULTIMATE);
        });
    });

    describe('枪手 / 武士手牌音效配置', () => {
        it('枪手打出主题手牌时应返回卡牌级专属音效', () => {
            const gunslingerShotCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-high-noon', cpCost: 1 },
            };
            const gunslingerUltimateCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-eat-my-lead', cpCost: 2 },
            };

            expect(resolveKey(gunslingerShotCard)).toBe(GUNSLINGER_SFX_SHOT);
            expect(resolveKey(gunslingerUltimateCard)).toBe(GUNSLINGER_SFX_ULTIMATE);
        });

        it('武士打出主题手牌时应返回卡牌级专属音效', () => {
            const samuraiHonorCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-samurai-honor', cpCost: 1 },
            };
            const samuraiAttackModifier: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-zanshin', cpCost: 2 },
            };

            expect(resolveKey(samuraiHonorCard)).toBe(SAMURAI_TOKEN_SFX_HONOR);
            expect(resolveKey(samuraiAttackModifier)).toBe(SAMURAI_SFX_ULTIMATE);
        });
    });

    describe('武士 token 专属音效配置', () => {
        it('选中武士后应预热武士 token 的专属音效', () => {
            const keys = DICETHRONE_AUDIO_CONFIG.contextualPreloadKeys?.({
                G: { selectedCharacters: { '0': 'samurai' } },
                ctx: {},
                meta: {},
            } as never) ?? [];

            expect(keys).toContain(SAMURAI_TOKEN_SFX_HONOR);
            expect(keys).toContain(SAMURAI_TOKEN_SFX_SHAME);
            expect(keys).toContain(SAMURAI_TOKEN_SFX_RETRIBUTION);
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
