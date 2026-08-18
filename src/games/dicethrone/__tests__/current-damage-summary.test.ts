import { describe, expect, it } from 'vitest';
import type { DiceThroneCore, PendingBonusDiceSettlement } from '../domain/types';
import { getCurrentDamageSummary } from '../domain/damageSummary';
import { createHeroMatchup, createQueuedRandom } from './test-utils';
import { RESOURCE_IDS } from '../domain/resources';

const baseCore = (patch: Partial<DiceThroneCore> = {}): DiceThroneCore => ({
    pendingAttack: {
        attackerId: '0',
        defenderId: '1',
        sourceAbilityId: 'test-attack',
        damage: 5,
        bonusDamage: 0,
    },
    pendingDamage: undefined,
    pendingBonusDiceSettlement: undefined,
    ...patch,
} as DiceThroneCore);

const attackSettlement = (patch: Partial<PendingBonusDiceSettlement>): PendingBonusDiceSettlement => ({
    id: 'pending-bonus',
    sourceAbilityId: 'test-attack',
    attackerId: '0',
    targetId: '1',
    dice: [],
    rerollCostTokenId: '',
    rerollCostAmount: 0,
    rerollCount: 0,
    readyToSettle: false,
    allowDiceModification: true,
    continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
    ...patch,
});

describe('DiceThrone 当前总伤害摘要', () => {
    it('没有临时改动时显示当前攻击基础伤害', () => {
        expect(getCurrentDamageSummary(baseCore())).toEqual({
            currentDamage: 5,
            originalDamage: 5,
        });
    });

    it('Token 响应改伤害后读取 pendingDamage 的当前账本', () => {
        expect(getCurrentDamageSummary(baseCore({
            pendingDamage: {
                source: { playerId: '0', abilityId: 'test-attack' },
                target: { playerId: '1' },
                originalDamage: 5,
                currentDamage: 4,
                timing: 'beforeDamageDealt',
                resolved: false,
                usedTokens: [],
            } as DiceThroneCore['pendingDamage'],
        }))).toEqual({
            currentDamage: 4,
            originalDamage: 5,
        });
    });

    it('攻击加伤奖励骰改骰后按最终骰面实时改变总伤害', () => {
        const withSix = getCurrentDamageSummary(baseCore({
            pendingBonusDiceSettlement: attackSettlement({
                dice: [{ index: 0, value: 6, face: 'bullet', effectParams: { value: 6, bonusDamage: 3 } }],
                resolutionMode: 'attackBonus',
                attackBonusScale: 'halfUp',
            }),
        }));
        const withFour = getCurrentDamageSummary(baseCore({
            pendingBonusDiceSettlement: attackSettlement({
                dice: [{ index: 0, value: 4, face: 'bullet', effectParams: { value: 4, bonusDamage: 2 } }],
                resolutionMode: 'attackBonus',
                attackBonusScale: 'halfUp',
            }),
        }));

        expect(withSix).toEqual({ currentDamage: 8, originalDamage: 5 });
        expect(withFour).toEqual({ currentDamage: 7, originalDamage: 5 });
    });

    it('summary 型奖励骰按 summaryEffectParams 实时计入当前攻击总伤害', () => {
        expect(getCurrentDamageSummary(baseCore({
            pendingBonusDiceSettlement: attackSettlement({
                dice: [
                    { index: 0, value: 1, face: 'bow' },
                    { index: 1, value: 2, face: 'bow' },
                    { index: 2, value: 3, face: 'moon' },
                ],
                displayOnly: true,
                summaryEffectKey: 'bonusDie.effect.volley.result',
                summaryEffectParams: { bowCount: 2, bonusDamage: 2 },
            }),
        }))).toEqual({
            currentDamage: 7,
            originalDamage: 5,
        });
    });

    it('直接骰面总和伤害型临时骰用骰面总和替换当前总伤害', () => {
        expect(getCurrentDamageSummary(baseCore({
            pendingBonusDiceSettlement: attackSettlement({
                dice: [
                    { index: 0, value: 4, face: 'chi' },
                    { index: 1, value: 5, face: 'fist' },
                    { index: 2, value: 6, face: 'lotus' },
                ],
                resolutionMode: 'damage',
                displayOnly: false,
                showTotal: true,
            }),
        }))).toEqual({
            currentDamage: 15,
            originalDamage: 5,
        });
    });

    it('展示型骰面总和伤害临时骰也按骰面总和实时替换当前总伤害', () => {
        const withSix = getCurrentDamageSummary(baseCore({
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'thunder-strike',
                damage: 0,
                bonusDamage: 0,
            },
            pendingBonusDiceSettlement: attackSettlement({
                sourceAbilityId: 'thunder-strike',
                dice: [
                    { index: 0, value: 4, face: 'taiji' },
                    { index: 1, value: 5, face: 'taiji' },
                    { index: 2, value: 6, face: 'lotus' },
                ],
                resolutionMode: 'damage',
                displayOnly: true,
                showTotal: true,
            }),
        }));
        const withFive = getCurrentDamageSummary(baseCore({
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'thunder-strike',
                damage: 0,
                bonusDamage: 0,
            },
            pendingBonusDiceSettlement: attackSettlement({
                sourceAbilityId: 'thunder-strike',
                dice: [
                    { index: 0, value: 4, face: 'taiji' },
                    { index: 1, value: 5, face: 'taiji' },
                    { index: 2, value: 5, face: 'taiji' },
                ],
                resolutionMode: 'damage',
                displayOnly: true,
                showTotal: true,
            }),
        }));

        expect(withSix).toEqual({ currentDamage: 15, originalDamage: 0 });
        expect(withFive).toEqual({ currentDamage: 14, originalDamage: 0 });
    });

    it('明确不显示总伤害的展示型临时骰不抢当前攻击总伤害', () => {
        expect(getCurrentDamageSummary(baseCore({
            pendingBonusDiceSettlement: attackSettlement({
                dice: [
                    { index: 0, value: 4, face: 'taiji' },
                    { index: 1, value: 5, face: 'taiji' },
                    { index: 2, value: 6, face: 'lotus' },
                ],
                resolutionMode: 'damage',
                displayOnly: true,
                showTotal: false,
            }),
        }))).toEqual({
            currentDamage: 5,
            originalDamage: 5,
        });
    });

    it('自定义动作的动态伤害估算不得作为玩家可见当前伤害摘要', () => {
        const state = createHeroMatchup('shadow_thief', 'paladin')(['0', '1'], createQueuedRandom([]));
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: 'kidney-shot',
            isDefendable: true,
        };

        expect(getCurrentDamageSummary(state.core)).toBeUndefined();
    });
});
