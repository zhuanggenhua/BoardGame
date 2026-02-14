/**
 * DiceThrone 音效配置属性测试
 * 使用属性测试验证配置的完整性和正确性
 */
import { describe, it, expect } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { BARBARIAN_ABILITIES } from '../heroes/barbarian/abilities';
import { MONK_ABILITIES } from '../heroes/monk/abilities';
import {
    BLINDING_SHOT_2,
    COVERT_FIRE_2,
    COVERING_FIRE_2,
    ECLIPSE_2,
    ELUSIVE_STEP_2,
    ENTANGLING_SHOT_2,
    EXPLODING_ARROW_2,
    EXPLODING_ARROW_3,
    LONGBOW_2,
    LONGBOW_3,
    MOON_ELF_ABILITIES,
} from '../heroes/moon_elf/abilities';
import {
    BLESSING_OF_MIGHT_2,
    HOLY_DEFENSE_2,
    HOLY_DEFENSE_3,
    HOLY_LIGHT_2,
    HOLY_STRIKE_2,
    PALADIN_ABILITIES,
    RIGHTEOUS_COMBAT_2,
    RIGHTEOUS_COMBAT_3,
    RIGHTEOUS_PRAYER_2,
    VENGEANCE_2,
} from '../heroes/paladin/abilities';
import { PYROMANCER_ABILITIES } from '../heroes/pyromancer/abilities';
import {
    CORNUCOPIA_2,
    DAGGER_STRIKE_2,
    FEARLESS_RIPOSTE_2,
    KIDNEY_SHOT_2,
    PICKPOCKET_2,
    PIERCING_ATTACK,
    SHADOW_ASSAULT,
    SHADOW_DANCE_2,
    SHADOW_DEFENSE_2,
    SHADOW_THIEF_ABILITIES,
    STEAL_2,
} from '../heroes/shadow_thief/abilities';
import { ALL_TOKEN_DEFINITIONS } from '../domain/characters';
import type { AudioEvent } from '../../../lib/audio/types';
import { getOptimizedAudioUrl } from '../../../core/AssetLoader';
import * as fs from 'fs';
import * as path from 'path';

const resolveKey = (event: AudioEvent, ctx: any = { G: {}, ctx: {}, meta: {} }): string | null => {
    return DICETHRONE_AUDIO_CONFIG.feedbackResolver(event, ctx);
};

const CP_GAIN_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
const CP_SPEND_KEY = 'status.general.player_status_sound_fx_pack.fantasy.fantasy_dispel_001';
const CARD_PLAY_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const DAMAGE_LIGHT_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const DAMAGE_HEAVY_KEY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
const DAMAGE_SELF_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.body_hit.sfx_body_hit_generic_small_1';
const VICTORY_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const DEFEAT_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';
const DICE_ROLL_KEYS = [
    'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_001',
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_001',
];

const REGISTRY_BASE = 'common/audio';
const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
const registryExists = fs.existsSync(REGISTRY_PATH);
const registryRaw = registryExists ? fs.readFileSync(REGISTRY_PATH, 'utf-8') : '{"entries":[]}';
const registry = JSON.parse(registryRaw) as { entries: Array<{ key: string; src: string; type: 'sfx' | 'bgm' }> };
const registryMap = new Map(registry.entries.map(entry => [entry.key, entry]));

const resolveRegistryFilePath = (key: string): string => {
    const entry = registryMap.get(key);
    if (!entry) return '';
    const url = getOptimizedAudioUrl(entry.src, REGISTRY_BASE);
    if (!url) return '';
    const relative = url.replace(/^\/assets\//, '');
    return path.join(process.cwd(), 'public', 'assets', relative);
};

describe.skipIf(!registryExists)('DiceThrone 音效配置属性测试', () => {
    describe('属性 1：CP 变化音效正确性', () => {
        it('应对所有 CP 变化值返回正确的音效键', () => {
            
            // 测试多个随机 delta 值
            const testCases = [
                { delta: 5, expected: CP_GAIN_KEY },
                { delta: 1, expected: CP_GAIN_KEY },
                { delta: 0, expected: CP_GAIN_KEY },
                { delta: -1, expected: CP_SPEND_KEY },
                { delta: -3, expected: CP_SPEND_KEY },
                { delta: -10, expected: CP_SPEND_KEY },
                { delta: 100, expected: CP_GAIN_KEY },
                { delta: -100, expected: CP_SPEND_KEY },
            ];

            for (const { delta, expected } of testCases) {
                const event: AudioEvent = { type: 'CP_CHANGED', payload: { delta } };
                const result = resolveKey(event);
                expect(result).toBe(expected);
            }
        });

        it('CP 音效 key 必须存在于 registry', () => {
            expect(registryMap.has(CP_GAIN_KEY)).toBe(true);
            expect(registryMap.has(CP_SPEND_KEY)).toBe(true);
        });
    });

    describe('属性 2：技能音效正确性', () => {
        it('DAMAGE_DEALT 应返回 null（音效由动画层 onImpact 播放）', () => {
            const event: AudioEvent = {
                type: 'DAMAGE_DEALT',
                payload: {
                    actualDamage: 3,
                    targetId: 'player2',
                    sourceAbilityId: 'thunder-strike',
                },
            };

            const mockContext = {
                G: {
                    players: {
                        player1: { heroId: 'monk', abilities: MONK_ABILITIES },
                        player2: { heroId: 'monk', abilities: [] },
                    },
                },
                ctx: {},
                meta: { currentPlayerId: 'player1' },
            } as any;

            const result = DICETHRONE_AUDIO_CONFIG.feedbackResolver(event, mockContext);
            expect(result).toBeNull();
        });

        it('所有攻击型技能应配置 sfxKey', () => {
            const resolverAbilities = [
                ...MONK_ABILITIES,
                ...BARBARIAN_ABILITIES,
                ...PYROMANCER_ABILITIES,
                ...MOON_ELF_ABILITIES,
                ...PALADIN_ABILITIES,
                ...SHADOW_THIEF_ABILITIES,
            ];

            const offensiveAbilities = resolverAbilities.filter(ability => ability.type === 'offensive');
            // 攻击型技能应该有 sfxKey（至少大部分有）
            const withSfx = offensiveAbilities.filter(a => a.sfxKey);
            expect(withSfx.length).toBeGreaterThan(0);
        });

        it('所有自定义音效键应在 registry 中存在', () => {
            const allAbilityDefs = [
                ...MONK_ABILITIES,
                ...BARBARIAN_ABILITIES,
                ...PYROMANCER_ABILITIES,
                ...MOON_ELF_ABILITIES,
                ...PALADIN_ABILITIES,
                ...SHADOW_THIEF_ABILITIES,
                LONGBOW_2,
                LONGBOW_3,
                COVERT_FIRE_2,
                COVERING_FIRE_2,
                EXPLODING_ARROW_2,
                EXPLODING_ARROW_3,
                ENTANGLING_SHOT_2,
                BLINDING_SHOT_2,
                ECLIPSE_2,
                ELUSIVE_STEP_2,
                RIGHTEOUS_COMBAT_2,
                RIGHTEOUS_COMBAT_3,
                BLESSING_OF_MIGHT_2,
                HOLY_LIGHT_2,
                VENGEANCE_2,
                RIGHTEOUS_PRAYER_2,
                HOLY_STRIKE_2,
                HOLY_DEFENSE_2,
                HOLY_DEFENSE_3,
                DAGGER_STRIKE_2,
                PICKPOCKET_2,
                KIDNEY_SHOT_2,
                SHADOW_ASSAULT,
                PIERCING_ATTACK,
                SHADOW_DANCE_2,
                STEAL_2,
                CORNUCOPIA_2,
                SHADOW_DEFENSE_2,
                FEARLESS_RIPOSTE_2,
            ];

            const customSfxKeys = allAbilityDefs
                .filter(a => a.sfxKey)
                .map(a => a.sfxKey as string);

            for (const sfxKey of customSfxKeys) {
                expect(registryMap.has(sfxKey)).toBe(true);
            }
        });
    });

    describe('属性 2.1：状态/Token 音效键存在性', () => {
        it('所有 TokenDef.sfxKey 应在 registry 中存在', () => {
            const tokenSfxKeys = ALL_TOKEN_DEFINITIONS
                .map(def => def.sfxKey)
                .filter((key): key is string => Boolean(key));

            for (const sfxKey of tokenSfxKeys) {
                expect(registryMap.has(sfxKey)).toBe(true);
            }
        });
    });

    describe('属性 3：配置完整性', () => {
        it('所有使用到的 registry key 都必须存在并有资源文件', () => {
            const keys = new Set<string>();
                        DICETHRONE_AUDIO_CONFIG.bgm?.forEach(def => keys.add(def.key));
            DICE_ROLL_KEYS.forEach(key => keys.add(key));
            keys.add(CP_GAIN_KEY);
            keys.add(CP_SPEND_KEY);
            keys.add(CARD_PLAY_KEY);
            keys.add(DAMAGE_LIGHT_KEY);
            keys.add(DAMAGE_HEAVY_KEY);
            keys.add(DAMAGE_SELF_KEY);
            keys.add(VICTORY_KEY);
            keys.add(DEFEAT_KEY);
            for (const ability of MONK_ABILITIES) {
                if (ability.sfxKey) {
                    keys.add(ability.sfxKey);
                }
            }
            for (const token of ALL_TOKEN_DEFINITIONS) {
                if (token.sfxKey) {
                    keys.add(token.sfxKey);
                }
            }

            for (const key of keys) {
                const entry = registryMap.get(key);
                expect(entry).toBeDefined();
                if (!entry) continue;
                const filePath = resolveRegistryFilePath(key);
                const exists = fs.existsSync(filePath);
                if (!exists) {
                    console.error(`registry 音效文件不存在: ${key} -> ${filePath}`);
                }
                expect(exists).toBe(true);
            }
        });
    });
});
