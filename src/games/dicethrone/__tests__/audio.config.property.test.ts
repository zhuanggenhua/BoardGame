/**
 * DiceThrone 音效配置属性测试
 * 使用属性测试验证配置的完整性和正确性
 */
import { describe, it, expect } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { MONK_ABILITIES } from '../monk/abilities';
import type { AudioEvent } from '../../../lib/audio/types';
import { getOptimizedAudioUrl } from '../../../core/AssetLoader';
import * as fs from 'fs';
import * as path from 'path';

const CP_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const CP_SPEND_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
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
const registryRaw = fs.readFileSync(REGISTRY_PATH, 'utf-8');
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

describe('DiceThrone 音效配置属性测试', () => {
    describe('属性 1：CP 变化音效正确性', () => {
        it('应对所有 CP 变化值返回正确的音效键', () => {
            const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
            if (!resolver) {
                throw new Error('eventSoundResolver 未定义');
            }

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
                const result = resolver(event, { G: {}, ctx: {}, meta: {} } as any);
                expect(result).toBe(expected);
            }
        });

        it('CP 音效 key 必须存在于 registry', () => {
            expect(registryMap.has(CP_GAIN_KEY)).toBe(true);
            expect(registryMap.has(CP_SPEND_KEY)).toBe(true);
        });
    });

    describe('属性 2：技能音效正确性', () => {
        it('所有 Monk 技能应正确解析音效键', () => {
            const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
            if (!resolver) {
                throw new Error('eventSoundResolver 未定义');
            }

            for (const ability of MONK_ABILITIES) {
                const event: AudioEvent = {
                    type: 'ABILITY_ACTIVATED',
                    payload: { playerId: 'player1', abilityId: ability.id },
                };

                const mockContext = {
                    G: {
                        players: {
                            player1: {
                                heroId: 'monk',
                                abilities: MONK_ABILITIES, // 使用完整的技能列表
                            },
                        },
                    },
                    ctx: {},
                    meta: {},
                } as any;

                const result = resolver(event, mockContext);

                if (ability.sfxKey) {
                    // 有 sfxKey 的技能应返回自定义音效键
                    expect(result).toBe(ability.sfxKey);
                } else {
                    // 没有 sfxKey 的技能不播放技能音效
                    expect(result).toBeNull();
                }
            }
        });

        it('所有自定义音效键应在 registry 中存在', () => {
            const customSfxKeys = MONK_ABILITIES
                .filter(a => a.sfxKey)
                .map(a => a.sfxKey as string);

            for (const sfxKey of customSfxKeys) {
                expect(registryMap.has(sfxKey)).toBe(true);
            }
        });
    });

    describe('属性 3：配置完整性', () => {
        it('所有使用到的 registry key 都必须存在并有资源文件', () => {
            const keys = new Set<string>();
            const eventKeys = Object.values(DICETHRONE_AUDIO_CONFIG.eventSoundMap ?? {});
            eventKeys.forEach(key => keys.add(key));
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
