/**
 * DiceThrone 音效配置单元测试
 * 验证 CP 音效和 Monk 技能音效配置的正确性
 */
import { describe, it, expect } from 'vitest';
import { DICETHRONE_AUDIO_CONFIG } from '../audio.config';
import { MONK_ABILITIES } from '../monk/abilities';
import type { AudioEvent } from '../../../lib/audio/types';

const CP_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const CP_SPEND_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';

const ABILITY_SFX_KEYS = {
    transcendence: 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_02_krst',
    thunderStrike: 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst',
    taijiCombo: 'combat.general.mini_games_sound_effects_and_music_pack.kick_punch.sfx_fight_kick_swoosh_1',
} as const;

describe('DiceThrone 音效配置', () => {
    describe('CP 音效配置', () => {
        it('eventSoundResolver 应根据 delta 正负值返回正确的 CP 音效键', () => {
            const resolver = DICETHRONE_AUDIO_CONFIG.eventSoundResolver;
            if (!resolver) {
                throw new Error('eventSoundResolver 未定义');
            }

            // 测试 CP 增加
            const gainEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 2 } };
            const gainResult = resolver(gainEvent, { G: {}, ctx: {}, meta: {} } as any);
            expect(gainResult).toBe(CP_GAIN_KEY);

            // 测试 CP 减少
            const spendEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: -3 } };
            const spendResult = resolver(spendEvent, { G: {}, ctx: {}, meta: {} } as any);
            expect(spendResult).toBe(CP_SPEND_KEY);

            // 测试 delta 为 0（边界情况）
            const zeroEvent: AudioEvent = { type: 'CP_CHANGED', payload: { delta: 0 } };
            const zeroResult = resolver(zeroEvent, { G: {}, ctx: {}, meta: {} } as any);
            expect(zeroResult).toBe(CP_GAIN_KEY); // delta >= 0 返回 cp_gain
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

        it('没有 sfxKey 的技能不播放技能音效', () => {
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
            expect(result).toBeNull();
        });
    });
});
