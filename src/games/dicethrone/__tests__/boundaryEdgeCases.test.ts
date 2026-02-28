/**
 * DiceThrone - 边界条件测试
 *
 * 覆盖：
 * 1. HP 溢出/下溢（治疗超上限、伤害超当前 HP）
 * 2. CP 溢出/下溢（卖牌超上限、支付超当前 CP）
 * 3. 状态效果移除下溢（移除层数 > 当前层数）
 * 4. Token 消耗下溢（消耗 > 持有）
 * 5. 伤害护盾边界（护盾 > 伤害、护盾 < 伤害、护盾 = 伤害）
 * 6. 牌库耗尽抽牌（触发洗牌）
 * 7. 手牌恰好等于上限时弃牌阶段可推进
 * 8. 骰子锁定边界（不存在的 dieId）
 * 9. 掷骰次数达到上限时不可再掷
 * 10. 胜负判定边界（双方 HP=0 平局、HP 恰好 =0）
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { reduce } from '../domain/reducer';
import { INITIAL_HEALTH, INITIAL_CP, CP_MAX, HAND_LIMIT } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { DiceThroneCore, DiceThroneEvent } from '../domain/types';
import {
    createRunner, createInitializedState, createSetupWithHand,
    fixedRandom, cmd, advanceTo,
} from './test-utils';

// ============================================================================
// 辅助：直接构造事件并 reduce
// ============================================================================

function getInitCore(): DiceThroneCore {
    const state = createInitializedState(['0', '1'], fixedRandom);
    return state.core;
}

function ev(type: string, payload: Record<string, unknown>): DiceThroneEvent {
    return { type, payload, timestamp: Date.now() } as unknown as DiceThroneEvent;
}

// ============================================================================
// 1. HP 溢出/下溢
// ============================================================================

describe('HP 边界', () => {
    it('治疗超过最大 HP 时被钳制到上限', () => {
        const core = getInitCore();
        // 先扣一点血
        const damaged = reduce(core, ev('DAMAGE_DEALT', { targetId: '0', actualDamage: 5 }));
        expect(damaged.players['0'].resources[RESOURCE_IDS.HP]).toBe(INITIAL_HEALTH - 5);

        // 治疗 100 点（远超上限 60）
        const healed = reduce(damaged, ev('HEAL_APPLIED', { targetId: '0', amount: 100 }));
        expect(healed.players['0'].resources[RESOURCE_IDS.HP]).toBe(60); // 钳制到上限 60
    });

    it('满血时治疗不超过上限', () => {
        const core = getInitCore();
        const healed = reduce(core, ev('HEAL_APPLIED', { targetId: '0', amount: 10 }));
        expect(healed.players['0'].resources[RESOURCE_IDS.HP]).toBe(60); // 50 + 10 = 60（上限）
    });

    it('伤害超过当前 HP 时钳制到 0', () => {
        const core = getInitCore();
        const result = reduce(core, ev('DAMAGE_DEALT', { targetId: '0', actualDamage: 999 }));
        expect(result.players['0'].resources[RESOURCE_IDS.HP]).toBe(0);
    });

    it('伤害恰好等于当前 HP 时 HP=0', () => {
        const core = getInitCore();
        const result = reduce(core, ev('DAMAGE_DEALT', { targetId: '0', actualDamage: INITIAL_HEALTH }));
        expect(result.players['0'].resources[RESOURCE_IDS.HP]).toBe(0);
    });
});

// ============================================================================
// 2. CP 溢出/下溢
// ============================================================================

describe('CP 边界', () => {
    it('CP_CHANGED 超过上限时被钳制到 CP_MAX', () => {
        const core = getInitCore();
        const result = reduce(core, ev('CP_CHANGED', { playerId: '0', newValue: 100 }));
        expect(result.players['0'].resources[RESOURCE_IDS.CP]).toBe(CP_MAX);
    });

    it('CP_CHANGED 设为负数时被钳制到 0', () => {
        const core = getInitCore();
        const result = reduce(core, ev('CP_CHANGED', { playerId: '0', newValue: -5 }));
        expect(result.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
    });

    it('卖牌使 CP 达到上限时不超过 CP_MAX', () => {
        const core = getInitCore();
        // 先把 CP 设到接近上限
        const maxed = reduce(core, ev('CP_CHANGED', { playerId: '0', newValue: CP_MAX }));
        // 卖牌 +1 CP
        const card = maxed.players['0'].hand[0];
        if (card) {
            const sold = reduce(maxed, ev('CARD_SOLD', {
                playerId: '0', cardId: card.id, cpGained: 1,
            }));
            expect(sold.players['0'].resources[RESOURCE_IDS.CP]).toBe(CP_MAX);
        }
    });

    it('CP 恰好在边界值时不变', () => {
        const core = getInitCore();
        const atZero = reduce(core, ev('CP_CHANGED', { playerId: '0', newValue: 0 }));
        expect(atZero.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);

        const atMax = reduce(core, ev('CP_CHANGED', { playerId: '0', newValue: CP_MAX }));
        expect(atMax.players['0'].resources[RESOURCE_IDS.CP]).toBe(CP_MAX);
    });
});

// ============================================================================
// 3. 状态效果移除下溢
// ============================================================================

describe('状态效果移除下溢', () => {
    it('移除层数 > 当前层数时钳制到 0', () => {
        const core = getInitCore();
        // 先施加 2 层燃烧
        const applied = reduce(core, ev('STATUS_APPLIED', {
            targetId: '0', statusId: STATUS_IDS.BURN, newTotal: 2,
        }));
        expect(applied.players['0'].statusEffects[STATUS_IDS.BURN]).toBe(2);

        // 移除 10 层（远超当前 2 层）
        const removed = reduce(applied, ev('STATUS_REMOVED', {
            targetId: '0', statusId: STATUS_IDS.BURN, stacks: 10,
        }));
        expect(removed.players['0'].statusEffects[STATUS_IDS.BURN]).toBe(0);
    });

    it('移除不存在的状态效果时保持 0', () => {
        const core = getInitCore();
        const result = reduce(core, ev('STATUS_REMOVED', {
            targetId: '0', statusId: STATUS_IDS.POISON, stacks: 5,
        }));
        expect(result.players['0'].statusEffects[STATUS_IDS.POISON] ?? 0).toBe(0);
    });

    it('移除恰好等于当前层数时归零', () => {
        const core = getInitCore();
        const applied = reduce(core, ev('STATUS_APPLIED', {
            targetId: '0', statusId: STATUS_IDS.KNOCKDOWN, newTotal: 1,
        }));
        const removed = reduce(applied, ev('STATUS_REMOVED', {
            targetId: '0', statusId: STATUS_IDS.KNOCKDOWN, stacks: 1,
        }));
        expect(removed.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN]).toBe(0);
    });
});


// ============================================================================
// 4. Token 消耗下溢
// ============================================================================

describe('Token 消耗下溢', () => {
    it('消耗 token 后 newTotal=0 时正确归零', () => {
        const core = getInitCore();
        // 先授予 2 个太极 token
        const granted = reduce(core, ev('TOKEN_GRANTED', {
            targetId: '0', tokenId: TOKEN_IDS.TAIJI, newTotal: 2,
        }));
        expect(granted.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(2);

        // 消耗到 0
        const consumed = reduce(granted, ev('TOKEN_CONSUMED', {
            playerId: '0', tokenId: TOKEN_IDS.TAIJI, newTotal: 0,
        }));
        expect(consumed.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(0);
    });

    it('TOKEN_GRANTED newTotal 直接设置值', () => {
        const core = getInitCore();
        const result = reduce(core, ev('TOKEN_GRANTED', {
            targetId: '0', tokenId: TOKEN_IDS.EVASIVE, newTotal: 1,
        }));
        expect(result.players['0'].tokens[TOKEN_IDS.EVASIVE]).toBe(1);
    });
});

// ============================================================================
// 5. 伤害护盾边界
// ============================================================================

describe('伤害护盾边界', () => {
    it('护盾值 > 伤害时完全吸收，HP 不变', () => {
        const core = getInitCore();
        const hpBefore = core.players['0'].resources[RESOURCE_IDS.HP];

        // 授予 10 点护盾
        const shielded = reduce(core, ev('DAMAGE_SHIELD_GRANTED', {
            targetId: '0', value: 10, sourceId: 'test', preventStatus: false,
        }));
        expect(shielded.players['0'].damageShields.length).toBe(1);

        // 受到 3 点伤害（护盾吸收）
        const hit = reduce(shielded, ev('DAMAGE_DEALT', {
            targetId: '0', actualDamage: 3,
        }));
        expect(hit.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
        // 护盾消耗后被清除
        expect(hit.players['0'].damageShields.length).toBe(0);
    });

    it('护盾值 < 伤害时部分吸收，剩余扣血', () => {
        const core = getInitCore();
        const hpBefore = core.players['0'].resources[RESOURCE_IDS.HP];

        const shielded = reduce(core, ev('DAMAGE_SHIELD_GRANTED', {
            targetId: '0', value: 3, sourceId: 'test', preventStatus: false,
        }));

        // 受到 10 点伤害，护盾吸收 3，剩余 7 扣血
        const hit = reduce(shielded, ev('DAMAGE_DEALT', {
            targetId: '0', actualDamage: 10,
        }));
        expect(hit.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 7);
    });

    it('护盾值 = 伤害时完全吸收', () => {
        const core = getInitCore();
        const hpBefore = core.players['0'].resources[RESOURCE_IDS.HP];

        const shielded = reduce(core, ev('DAMAGE_SHIELD_GRANTED', {
            targetId: '0', value: 5, sourceId: 'test', preventStatus: false,
        }));

        const hit = reduce(shielded, ev('DAMAGE_DEALT', {
            targetId: '0', actualDamage: 5,
        }));
        expect(hit.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore);
    });

    it('无护盾时伤害直接扣血', () => {
        const core = getInitCore();
        const hpBefore = core.players['0'].resources[RESOURCE_IDS.HP];

        const hit = reduce(core, ev('DAMAGE_DEALT', {
            targetId: '0', actualDamage: 8,
        }));
        expect(hit.players['0'].resources[RESOURCE_IDS.HP]).toBe(hpBefore - 8);
    });
});

// ============================================================================
// 6. 牌库耗尽抽牌
// ============================================================================

describe('牌库耗尽抽牌', () => {
    it('牌库为空时抽牌不崩溃（cardId 不在牌库中）', () => {
        const core = getInitCore();
        // 清空牌库
        core.players['0'].deck = [];

        // 尝试抽一张不存在的牌 → 手牌不变
        const handBefore = core.players['0'].hand.length;
        const result = reduce(core, ev('CARD_DRAWN', {
            playerId: '0', cardId: 'nonexistent',
        }));
        expect(result.players['0'].hand.length).toBe(handBefore);
    });

    it('DECK_SHUFFLED 将弃牌堆洗入牌库', () => {
        const core = getInitCore();
        const player = core.players['0'];
        // 模拟：牌库空，弃牌堆有 3 张
        const discardCards = player.hand.splice(0, 3);
        player.discard = discardCards;
        player.deck = [];

        const deckCardIds = discardCards.map(c => c.id);
        const result = reduce(core, ev('DECK_SHUFFLED', {
            playerId: '0', deckCardIds,
        }));

        expect(result.players['0'].deck.length).toBe(3);
        expect(result.players['0'].discard.length).toBe(0);
    });
});

// ============================================================================
// 7. 手牌恰好等于上限时弃牌阶段可推进
// ============================================================================

describe('手牌恰好等于上限', () => {
    it('手牌 = HAND_LIMIT 时弃牌阶段可推进', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '手牌恰好等于上限可推进',
            commands: [
                cmd('DRAW_CARD', '0'),
                cmd('DRAW_CARD', '0'), // 手牌 6 = HAND_LIMIT
                ...advanceTo('discard'),
                cmd('ADVANCE_PHASE', '0'), // discard -> 应可推进
            ],
            expect: {
                turnPhase: 'main1',
                activePlayerId: '1',
                players: {
                    '0': { handSize: HAND_LIMIT },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    it('手牌 = HAND_LIMIT + 1 时弃牌阶段不可推进', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '手牌超限不可推进',
            commands: [
                cmd('DRAW_CARD', '0'),
                cmd('DRAW_CARD', '0'),
                cmd('DRAW_CARD', '0'), // 手牌 7 > HAND_LIMIT
                ...advanceTo('discard'),
                cmd('ADVANCE_PHASE', '0'), // discard -> 被阻止
            ],
            expect: {
                expectError: { command: 'ADVANCE_PHASE', error: 'cannot_advance_phase' },
                turnPhase: 'discard',
                players: {
                    '0': { handSize: HAND_LIMIT + 1 },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

// ============================================================================
// 8. 骰子锁定边界
// ============================================================================

describe('骰子锁定边界', () => {
    it('锁定不存在的 dieId 时不产生事件', () => {
        const core = getInitCore();
        // DIE_LOCK_TOGGLED 事件中 dieId 不存在时 reducer 仍正常
        const result = reduce(core, ev('DIE_LOCK_TOGGLED', {
            dieId: 999, isKept: true,
        }));
        // 不应崩溃，骰子状态不变
        expect(result.dice.every(d => !d.isKept)).toBe(true);
    });
});

// ============================================================================
// 9. 掷骰次数达到上限
// ============================================================================

describe('掷骰次数上限', () => {
    it('rollCount >= rollLimit 时 ROLL_DICE 被拒绝', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '掷骰上限',
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),     // rollCount=1
                cmd('ROLL_DICE', '0'),     // rollCount=2
                cmd('ROLL_DICE', '0'),     // rollCount=3 = rollLimit
                cmd('ROLL_DICE', '0'),     // 应被拒绝
            ],
            expect: {
                expectError: { command: 'ROLL_DICE', error: 'roll_limit_reached' },
                turnPhase: 'offensiveRoll',
                roll: { count: 3, limit: 3 },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

// ============================================================================
// 10. 胜负判定边界
// ============================================================================

describe('胜负判定边界', () => {
    it('一方 HP=0 时对方获胜', () => {
        const core = getInitCore();
        core.players['0'].resources[RESOURCE_IDS.HP] = 0;

        const result = DiceThroneDomain.isGameOver!(core);
        expect(result).toBeDefined();
        expect(result!.winner).toBe('1');
    });

    it('双方 HP=0 时平局', () => {
        const core = getInitCore();
        core.players['0'].resources[RESOURCE_IDS.HP] = 0;
        core.players['1'].resources[RESOURCE_IDS.HP] = 0;

        const result = DiceThroneDomain.isGameOver!(core);
        expect(result).toBeDefined();
        expect(result!.draw).toBe(true);
    });

    it('双方 HP > 0 时游戏继续', () => {
        const core = getInitCore();
        const result = DiceThroneDomain.isGameOver!(core);
        expect(result).toBeUndefined();
    });

    it('HP 恰好 =1 时游戏继续', () => {
        const core = getInitCore();
        core.players['0'].resources[RESOURCE_IDS.HP] = 1;

        const result = DiceThroneDomain.isGameOver!(core);
        expect(result).toBeUndefined();
    });

    it('setup 阶段不判定胜负（即使 HP=0）', () => {
        const core = getInitCore();
        core.hostStarted = false;
        core.players['0'].resources[RESOURCE_IDS.HP] = 0;

        const result = DiceThroneDomain.isGameOver!(core);
        expect(result).toBeUndefined();
    });
});
