/**
 * DiceThrone 音效配置属性测试
 * 使用属性测试验证配置的完整性和正确性
 */
import { describe, it, expect } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { COMMON_AUDIO_CONFIG } from '../../../lib/audio/common.config';
import { MONK_ABILITIES } from '../monk/abilities';
import type { AudioEvent, GameAudioConfig } from '../../../lib/audio/types';
import * as fs from 'fs';
import * as path from 'path';

// 合并通用配置和游戏配置
function mergeAudioConfigs(common: GameAudioConfig, game: GameAudioConfig): GameAudioConfig {
    return {
        basePath: game.basePath || common.basePath,
        sounds: { ...common.sounds, ...game.sounds },
        eventSoundMap: { ...common.eventSoundMap, ...game.eventSoundMap },
        eventSoundResolver: game.eventSoundResolver || common.eventSoundResolver,
        bgm: { ...common.bgm, ...game.bgm },
    };
}

const MERGED_CONFIG = mergeAudioConfigs(COMMON_AUDIO_CONFIG, DICETHRONE_AUDIO_CONFIG);

describe('DiceThrone 音效配置属性测试', () => {
    describe('属性 1：CP 变化音效正确性', () => {
        it('应对所有 CP 变化值返回正确的音效键', () => {
            const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
            if (!resolver) {
                throw new Error('eventSoundResolver 未定义');
            }

            // 测试多个随机 delta 值
            const testCases = [
                { delta: 5, expected: 'cp_gain' },
                { delta: 1, expected: 'cp_gain' },
                { delta: 0, expected: 'cp_gain' },
                { delta: -1, expected: 'cp_spend' },
                { delta: -3, expected: 'cp_spend' },
                { delta: -10, expected: 'cp_spend' },
                { delta: 100, expected: 'cp_gain' },
                { delta: -100, expected: 'cp_spend' },
            ];

            for (const { delta, expected } of testCases) {
                const event: AudioEvent = { type: 'CP_CHANGED', payload: { delta } };
                const result = resolver(event, { G: {}, ctx: {}, meta: {} } as any);
                expect(result).toBe(expected);
            }
        });

        it('CP 音效资源路径应包含正确的关键词', () => {
            // CP 音效现在在通用配置中定义
            const cpGainConfig = COMMON_AUDIO_CONFIG.sounds.cp_gain;
            const cpSpendConfig = COMMON_AUDIO_CONFIG.sounds.cp_spend;

            expect(cpGainConfig.src).toContain('Charged');
            expect(cpSpendConfig.src).toContain('Purged');
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
                    // 没有 sfxKey 的技能应返回默认音效
                    expect(result).toBe('ability_activate');
                }
            }
        });

        it('所有自定义音效键应在配置中存在', () => {
            const customSfxKeys = MONK_ABILITIES
                .filter(a => a.sfxKey)
                .map(a => a.sfxKey as string);

            for (const sfxKey of customSfxKeys) {
                const config = DICETHRONE_AUDIO_CONFIG.sounds[sfxKey];
                expect(config).toBeDefined();
                expect(config.src).toBeTruthy();
            }
        });
    });

    describe('属性 3：配置完整性', () => {
        it('所有音效配置的文件路径应存在', () => {
            // 检查通用配置的文件路径
            const commonBasePath = path.join(process.cwd(), 'public', 'assets', COMMON_AUDIO_CONFIG.basePath);
            for (const [key, config] of Object.entries(COMMON_AUDIO_CONFIG.sounds)) {
                const filePath = path.join(commonBasePath, config.src);
                const exists = fs.existsSync(filePath);
                if (!exists) {
                    console.error(`通用音效文件不存在: ${key} -> ${filePath}`);
                }
                expect(exists).toBe(true);
            }

            // 检查游戏配置的文件路径
            const gameBasePath = path.join(process.cwd(), 'public', 'assets', DICETHRONE_AUDIO_CONFIG.basePath);
            for (const [key, config] of Object.entries(DICETHRONE_AUDIO_CONFIG.sounds)) {
                const filePath = path.join(gameBasePath, config.src);
                const exists = fs.existsSync(filePath);
                if (!exists) {
                    console.error(`游戏音效文件不存在: ${key} -> ${filePath}`);
                }
                expect(exists).toBe(true);
            }
        });

        it('所有音量值应在 0 到 1 之间', () => {
            // 检查合并后的配置
            for (const [key, config] of Object.entries(MERGED_CONFIG.sounds)) {
                expect(config.volume).toBeGreaterThanOrEqual(0);
                expect(config.volume).toBeLessThanOrEqual(1);
            }
        });

        it('所有分类标签应符合规范', () => {
            const allowedGroups = ['dice', 'card', 'combat', 'token', 'status', 'ui', 'system', 'stinger', 'bgm'];

            // 检查合并后的配置
            for (const [key, config] of Object.entries(MERGED_CONFIG.sounds)) {
                expect(config.category).toBeDefined();
                expect(allowedGroups).toContain(config.category.group);
                expect(config.category.sub).toBeTruthy();
            }
        });

        it('所有技能 sfxKey 应在配置中有对应条目', () => {
            for (const ability of MONK_ABILITIES) {
                if (ability.sfxKey) {
                    const config = DICETHRONE_AUDIO_CONFIG.sounds[ability.sfxKey];
                    expect(config).toBeDefined();
                    expect(config.src).toBeTruthy();
                    expect(config.volume).toBeGreaterThanOrEqual(0);
                    expect(config.volume).toBeLessThanOrEqual(1);
                }
            }
        });
    });
});
