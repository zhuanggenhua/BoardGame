/**
 * DiceThrone 音效配置单元测试
 * 验证 CP 音效和 Monk 技能音效配置的正确性
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { ALL_TOKEN_DEFINITIONS } from '../domain/characters';
import { MONK_ABILITIES } from '../heroes/monk/abilities';
import { ARTIFICER_ABILITIES, ARTIFICER_SFX_ELECTRIC, ARTIFICER_SFX_METAL, ARTIFICER_SFX_ULTIMATE } from '../heroes/artificer/abilities';
import { ARTIFICER_CARDS } from '../heroes/artificer/cards';
import { CURSED_PIRATE_ABILITIES, CURSED_PIRATE_SFX_CURSE, CURSED_PIRATE_SFX_EXPLOSION, CURSED_PIRATE_SFX_SLASH, CURSED_PIRATE_SFX_ULTIMATE } from '../heroes/cursed_pirate/abilities';
import { CURSED_PIRATE_CARDS } from '../heroes/cursed_pirate/cards';
import { GUNSLINGER_ABILITIES, GUNSLINGER_SFX_BOUNTY, GUNSLINGER_SFX_HEAVY, GUNSLINGER_SFX_LOADED, GUNSLINGER_SFX_SHOT, GUNSLINGER_SFX_ULTIMATE } from '../heroes/gunslinger/abilities';
import { SHADOW_THIEF_ABILITIES, SHADOW_THIEF_SFX_LOOT, SHADOW_THIEF_SFX_STEAL } from '../heroes/shadow_thief/abilities';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { SAMURAI_ABILITIES, SAMURAI_SFX_DEFENSE, SAMURAI_SFX_HEAVY, SAMURAI_SFX_LIGHT, SAMURAI_SFX_ULTIMATE } from '../heroes/samurai/abilities';
import { SAMURAI_TOKEN_SFX_HONOR, SAMURAI_TOKEN_SFX_RETRIBUTION, SAMURAI_TOKEN_SFX_SHAME } from '../heroes/samurai/tokens';
import { TREANT_ABILITIES, TREANT_SFX_GROWTH, TREANT_SFX_HEAVY, TREANT_SFX_LIGHT, TREANT_SFX_ULTIMATE } from '../heroes/treant/abilities';
import { NINJA_ABILITIES, NINJA_SFX_POISON, NINJA_SFX_SMOKE } from '../heroes/ninja/abilities';
import { ZHANSHUJIA_ABILITIES, ZHANSHUJIA_SFX_COMMAND, ZHANSHUJIA_SFX_HEAVY, ZHANSHUJIA_SFX_LIGHT, ZHANSHUJIA_SFX_ULTIMATE } from '../heroes/zhanshujia/abilities';
import { ZHANSHUJIA_CARDS } from '../heroes/zhanshujia/cards';
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
        it('影贼金币相关技能应切到更贴题的新素材', () => {
            expect(SHADOW_THIEF_ABILITIES.find(a => a.id === 'steal')?.sfxKey).toBe(SHADOW_THIEF_SFX_STEAL);
            expect(SHADOW_THIEF_ABILITIES.find(a => a.id === 'cornucopia')?.sfxKey).toBe(SHADOW_THIEF_SFX_LOOT);
            expect(SHADOW_THIEF_SFX_STEAL).toBe('coins.decks_and_cards_sound_fx_pack.gold_pouch_handle_001');
            expect(SHADOW_THIEF_SFX_LOOT).toBe('coins.decks_and_cards_sound_fx_pack.fair_reward_001');
        });

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

        it('工匠核心技能应配置机械/电击主题音效', () => {
            expect(ARTIFICER_ABILITIES.find(a => a.id === 'wrench-strike')?.sfxKey).toBe(ARTIFICER_SFX_METAL);
            expect(ARTIFICER_ABILITIES.find(a => a.id === 'overclock')?.sfxKey).toBe(ARTIFICER_SFX_ELECTRIC);
            expect(ARTIFICER_ABILITIES.find(a => a.id === 'maximum-power')?.sfxKey).toBe(ARTIFICER_SFX_ULTIMATE);
        });

        it('咒缚海盗核心技能应配置刀剑/诅咒主题音效', () => {
            expect(CURSED_PIRATE_ABILITIES.find(a => a.id === 'soul-stab')?.sfxKey).toBe(CURSED_PIRATE_SFX_SLASH);
            expect(CURSED_PIRATE_ABILITIES.find(a => a.id === 'marked-for-death')?.sfxKey).toBe(CURSED_PIRATE_SFX_CURSE);
            expect(CURSED_PIRATE_ABILITIES.find(a => a.id === 'merciless-curse')?.sfxKey).toBe(CURSED_PIRATE_SFX_ULTIMATE);
        });

        it('战术家核心技能应配置军令/爆破主题音效', () => {
            expect(ZHANSHUJIA_ABILITIES.find(a => a.id === 'sabre-thrust')?.sfxKey).toBe(ZHANSHUJIA_SFX_LIGHT);
            expect(ZHANSHUJIA_ABILITIES.find(a => a.id === 'carpet-bombing')?.sfxKey).toBe(ZHANSHUJIA_SFX_HEAVY);
            expect(ZHANSHUJIA_ABILITIES.find(a => a.id === 'war-monger')?.sfxKey).toBe(ZHANSHUJIA_SFX_COMMAND);
            expect(ZHANSHUJIA_ABILITIES.find(a => a.id === 'high-ground')?.sfxKey).toBe(ZHANSHUJIA_SFX_ULTIMATE);
        });

        it('树人与忍者历史音效 key 应仍存在于注册表', () => {
            expect(TREANT_ABILITIES.find(a => a.id === 'shattering-fist')?.sfxKey).toBe(TREANT_SFX_HEAVY);
            expect(TREANT_ABILITIES.find(a => a.id === 'tend-care')?.sfxKey).toBe(TREANT_SFX_GROWTH);
            expect(TREANT_ABILITIES.find(a => a.id === 'vengeful-vines')?.sfxKey).toBe(TREANT_SFX_LIGHT);
            expect(TREANT_ABILITIES.find(a => a.id === 'forest-awakens')?.sfxKey).toBe(TREANT_SFX_ULTIMATE);
            expect(NINJA_ABILITIES.find(a => a.id === 'poison-blade')?.sfxKey).toBe(NINJA_SFX_POISON);
            expect(NINJA_ABILITIES.find(a => a.id === 'smoke-screen')?.sfxKey).toBe(NINJA_SFX_SMOKE);
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

        it('选中新补音效角色后应预热其专属技能音效', () => {
            const keys = DICETHRONE_AUDIO_CONFIG.contextualPreloadKeys?.({
                G: { selectedCharacters: { '0': 'artificer', '1': 'cursed_pirate', '2': 'zhanshujia' } },
                ctx: {},
                meta: {},
            } as never) ?? [];

            expect(keys).toContain(ARTIFICER_SFX_METAL);
            expect(keys).toContain(ARTIFICER_SFX_ELECTRIC);
            expect(keys).toContain(CURSED_PIRATE_SFX_CURSE);
            expect(keys).toContain(CURSED_PIRATE_SFX_SLASH);
            expect(keys).toContain(ZHANSHUJIA_SFX_COMMAND);
            expect(keys).toContain(ZHANSHUJIA_SFX_ULTIMATE);
        });
    });

    describe('新英雄手牌音效配置', () => {
        it('影贼金币主题手牌应返回卡牌级奖励音效', () => {
            const shadowCoinsCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'action-shadow-coins', cpCost: 0 },
            };

            expect(SHADOW_THIEF_CARDS.find(card => card.id === 'action-shadow-coins')?.sfxKey).toBe(SHADOW_THIEF_SFX_LOOT);
            expect(resolveKey(shadowCoinsCard)).toBe(SHADOW_THIEF_SFX_LOOT);
        });

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
                payload: { playerId: '0', cardId: 'card-zanshin', cpCost: 1 },
            };

            expect(resolveKey(samuraiHonorCard)).toBe(SAMURAI_TOKEN_SFX_HONOR);
            expect(resolveKey(samuraiAttackModifier)).toBe(SAMURAI_SFX_ULTIMATE);
        });

        it('工匠打出主题手牌时应返回卡牌级专属音效', () => {
            const electricCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-artificer-voltage', cpCost: 1 },
            };
            const metalCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-artificer-mechanical-strike', cpCost: 1 },
            };

            expect(ARTIFICER_CARDS.find(card => card.id === 'card-artificer-voltage')?.sfxKey).toBe(ARTIFICER_SFX_ELECTRIC);
            expect(resolveKey(electricCard)).toBe(ARTIFICER_SFX_ELECTRIC);
            expect(resolveKey(metalCard)).toBe(ARTIFICER_SFX_METAL);
        });

        it('咒缚海盗打出主题手牌时应返回卡牌级专属音效', () => {
            const curseCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-cursed-pirate-curse-card', cpCost: 0 },
            };
            const slashCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-cursed-pirate-flay', cpCost: 2 },
            };

            expect(CURSED_PIRATE_CARDS.find(card => card.id === 'card-cursed-pirate-curse-card')?.sfxKey).toBe(CURSED_PIRATE_SFX_CURSE);
            expect(resolveKey(curseCard)).toBe(CURSED_PIRATE_SFX_CURSE);
            expect(resolveKey(slashCard)).toBe(CURSED_PIRATE_SFX_SLASH);
        });

        it('战术家打出主题手牌时应返回卡牌级专属音效', () => {
            const commandCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-zhanshujia-war-room', cpCost: 1 },
            };
            const strikeCard: AudioEvent = {
                type: 'CARD_PLAYED',
                payload: { playerId: '0', cardId: 'card-zhanshujia-ambush', cpCost: 1 },
            };

            expect(ZHANSHUJIA_CARDS.find(card => card.id === 'card-zhanshujia-war-room')?.sfxKey).toBe(ZHANSHUJIA_SFX_COMMAND);
            expect(resolveKey(commandCard)).toBe(ZHANSHUJIA_SFX_COMMAND);
            expect(resolveKey(strikeCard)).toBe(ZHANSHUJIA_SFX_LIGHT);
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
        it('应有 8 首可随 Android 公共音频包播放的 BGM（4 normal + 4 battle）', () => {
            expect(DICETHRONE_AUDIO_CONFIG.bgm).toHaveLength(8);
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

    describe('枪手 Token 音效配置', () => {
        it('装填与赏金应暴露更贴题的枪械/悬赏音效', () => {
            const loaded = ALL_TOKEN_DEFINITIONS.find(token => token.id === TOKEN_IDS.LOADED);
            const bounty = ALL_TOKEN_DEFINITIONS.find(token => token.id === TOKEN_IDS.BOUNTY);

            expect(loaded?.sfxKey).toBe(GUNSLINGER_SFX_LOADED);
            expect(bounty?.sfxKey).toBe(GUNSLINGER_SFX_BOUNTY);
        });
    });

    describe('咒缚海盗 Token 音效配置', () => {
        it('炸药桶应使用爆炸音效，不应复用诅咒终极音效', () => {
            const powderKeg = ALL_TOKEN_DEFINITIONS.find(token => token.id === STATUS_IDS.POWDER_KEG);

            expect(powderKeg?.sfxKey).toBe(CURSED_PIRATE_SFX_EXPLOSION);
            expect(powderKeg?.sfxKey).not.toBe(CURSED_PIRATE_SFX_ULTIMATE);
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
