/**
 * DiceThrone 音效配置单元测试
 * 验证 CP 音效和 Monk 技能音效配置的正确性
 */
import { describe, it, expect } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { COMMON_AUDIO_CONFIG } from '../../../lib/audio/common.config';
import { MONK_ABILITIES } from '../monk/abilities';
import type { AudioEvent } from '../../../lib/audio/types';

describe('DiceThrone 音效配置', () => {
    describe('CP 音效配置', () => {
        it('cp_gain 应使用能量充能音效', () => {
            // CP 音效现在在通用配置中定义
            const cpGainConfig = COMMON_AUDIO_CONFIG.sounds.cp_gain;
            expect(cpGainConfig).toBeDefined();
            expect(cpGainConfig.src).toBe('status/compressed/Charged_A.ogg');
            expect(cpGainConfig.volume).toBe(0.6);
            expect(cpGainConfig.category).toEqual({ group: 'system', sub: 'cp_gain' });
        });

        it('cp_spend 应使用能量释放音效', () => {
            // CP 音效现在在通用配置中定义
            const cpSpendConfig = COMMON_AUDIO_CONFIG.sounds.cp_spend;
            expect(cpSpendConfig).toBeDefined();
            expect(cpSpendConfig.src).toBe('status/compressed/Purged_A.ogg');
            expect(cpSpendConfig.volume).toBe(0.5);
            expect(cpSpendConfig.category).toEqual({ group: 'system', sub: 'cp_spend' });
        });

        it('eventSoundResolver 应根据 delta 正负值返回正确的 CP 音效键', () => {
            const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
            if (!resolver) {
                throw new Error('eventSoundResolver 未定义');
            }

            // 测试 CP 增加
            const gainEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 2 } };
            const gainResult = resolver(gainEvent, { G: {}, ctx: {}, meta: {} } as any);
            expect(gainResult).toBe('cp_gain');

            // 测试 CP 减少
            const spendEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: -3 } };
            const spendResult = resolver(spendEvent, { G: {}, ctx: {}, meta: {} } as any);
            expect(spendResult).toBe('cp_spend');

            // 测试 delta 为 0（边界情况）
            const zeroEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 0 } };
            const zeroResult = resolver(zeroEvent, { G: {}, ctx: {}, meta: {} } as any);
            expect(zeroResult).toBe('cp_gain'); // delta >= 0 返回 cp_gain
        });
    });

    describe('Monk 技能音效配置', () => {
        it('超凡入圣技能应配置正确的 sfxKey 和音效资源', () => {
            const transcendence = MONK_ABILITIES.find(a => a.id === 'transcendence');
            expect(transcendence).toBeDefined();
            expect(transcendence?.sfxKey).toBe('transcendence_ultimate');

            const sfxConfig = DICETHRONE_AUDIO_CONFIG.sounds.transcendence_ultimate;
            expect(sfxConfig).toBeDefined();
            expect(sfxConfig.src).toBe('fight/compressed/FGHTImpt_Special_Hit_02.ogg');
            expect(sfxConfig.volume).toBe(1.0);
            expect(sfxConfig.category).toEqual({ group: 'combat', sub: 'ultimate' });
        });

        it('雷霆一击技能应配置正确的 sfxKey 和音效资源', () => {
            const thunderStrike = MONK_ABILITIES.find(a => a.id === 'thunder-strike');
            expect(thunderStrike).toBeDefined();
            expect(thunderStrike?.sfxKey).toBe('thunder_strike');

            const sfxConfig = DICETHRONE_AUDIO_CONFIG.sounds.thunder_strike;
            expect(sfxConfig).toBeDefined();
            expect(sfxConfig.src).toBe('fight/compressed/FGHTImpt_Versatile_Punch_Hit_01.ogg');
            expect(sfxConfig.volume).toBe(0.9);
            expect(sfxConfig.category).toEqual({ group: 'combat', sub: 'heavy_attack' });
        });

        it('太极连击技能应配置正确的 sfxKey 和音效资源', () => {
            const taijiCombo = MONK_ABILITIES.find(a => a.id === 'taiji-combo');
            expect(taijiCombo).toBeDefined();
            expect(taijiCombo?.sfxKey).toBe('taiji_combo');

            const sfxConfig = DICETHRONE_AUDIO_CONFIG.sounds.taiji_combo;
            expect(sfxConfig).toBeDefined();
            expect(sfxConfig.src).toBe('fight/compressed/SFX_Fight_Kick_Swoosh_1.ogg');
            expect(sfxConfig.volume).toBe(0.85);
            expect(sfxConfig.category).toEqual({ group: 'combat', sub: 'combo' });
        });

        it('没有 sfxKey 的技能应使用默认音效', () => {
            const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
            if (!resolver) {
                throw new Error('eventSoundResolver 未定义');
            }

            // 测试没有 sfxKey 的技能（如 fist-technique）
            const fistTechnique = MONK_ABILITIES.find(a => a.id === 'fist-technique');
            expect(fistTechnique).toBeDefined();
            expect(fistTechnique?.sfxKey).toBeUndefined();

            // 模拟技能激活事件
            const event: AudioEvent = {
                type: 'ABILITY_ACTIVATED',
                payload: { playerId: 'player1', abilityId: 'fist-technique' },
            };

            // 创建模拟的游戏状态
            const mockContext = {
                G: {
                    players: {
                        player1: {
                            heroId: 'monk',
                            abilities: [{ id: 'fist-technique', name: '拳法', type: 'offensive' }],
                        },
                    },
                },
                ctx: {},
                meta: {},
            } as any;

            const result = resolver(event, mockContext);
            expect(result).toBe('ability_activate'); // 默认音效
        });
    });
});
