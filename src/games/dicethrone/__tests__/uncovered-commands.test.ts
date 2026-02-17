/**
 * DiceThrone 未覆盖命令测试
 *
 * 覆盖以下命令：
 * 1. UNDO_SELL_CARD - 撤回售卖（CP 返还、卡牌回手牌）
 * 2. REORDER_CARD_TO_END - 重排卡牌到末尾
 * 3. CANCEL_INTERACTION - 取消交互（卡牌回手牌、CP 返还）
 * 4. TRANSFER_STATUS - 转移状态/Token
 * 5. USE_TOKEN - 伤害响应窗口使用 Token
 * 6. 牌库耗尽洗牌 - 抽牌时牌库为空触发弃牌堆洗回
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, PendingInteraction, PendingDamage } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { executePipeline } from '../../../engine/pipeline';
import {
    fixedRandom,
    createInitializedState,
    testSystems,
    cmd,
    injectPendingInteraction,
    type CommandInput,
} from './test-utils';

// ============================================================================
// 辅助函数
// ============================================================================

const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

/** 直接执行命令并返回新状态 */
function execCmd(
    state: MatchState<DiceThroneCore>,
    command: CommandInput,
    random: RandomFn = fixedRandom,
): MatchState<DiceThroneCore> {
    const result = executePipeline(
        pipelineConfig,
        state,
        { type: command.type, playerId: command.playerId, payload: command.payload, timestamp: Date.now() },
        random,
        ['0', '1']
    );
    if (!result.success) {
        throw new Error(`命令执行失败: ${command.type} - ${result.error}`);
    }
    return result.state as MatchState<DiceThroneCore>;
}

/** 执行命令并返回 pipeline 结果（用于验证失败场景） */
function tryCmd(
    state: MatchState<DiceThroneCore>,
    command: CommandInput,
    random: RandomFn = fixedRandom,
) {
    return executePipeline(
        pipelineConfig,
        state,
        { type: command.type, playerId: command.playerId, payload: command.payload, timestamp: Date.now() },
        random,
        ['0', '1']
    );
}

/** 创建已推进到 main1 的状态 */
function setupToMain1(random: RandomFn = fixedRandom): MatchState<DiceThroneCore> {
    return createInitializedState(['0', '1'], random);
}

// ============================================================================
// 1. UNDO_SELL_CARD
// ============================================================================

describe('UNDO_SELL_CARD 撤回售卖', () => {
    it('卖牌后撤回：卡牌回手牌、CP -1', () => {
        let state = setupToMain1();
        const p0 = state.core.players['0'];
        const cpBefore = p0.resources[RESOURCE_IDS.CP];
        const handSizeBefore = p0.hand.length;
        const firstCardId = p0.hand[0].id;

        // 卖牌
        state = execCmd(state, cmd('SELL_CARD', '0', { cardId: firstCardId }));
        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBefore + 1);
        expect(state.core.players['0'].hand.length).toBe(handSizeBefore - 1);
        expect(state.core.lastSoldCardId).toBe(firstCardId);

        // 撤回售卖
        state = execCmd(state, cmd('UNDO_SELL_CARD', '0'));
        const p0After = state.core.players['0'];
        expect(p0After.resources[RESOURCE_IDS.CP]).toBe(cpBefore);
        expect(p0After.hand.length).toBe(handSizeBefore);
        expect(p0After.hand.some(c => c.id === firstCardId)).toBe(true);
        expect(state.core.lastSoldCardId).toBeUndefined();
    });

    it('没有上次售卖时撤回失败', () => {
        const state = setupToMain1();
        const result = tryCmd(state, cmd('UNDO_SELL_CARD', '0'));
        expect(result.success).toBe(false);
    });

    it('非当前玩家无法撤回', () => {
        let state = setupToMain1();
        const cardId = state.core.players['0'].hand[0].id;
        state = execCmd(state, cmd('SELL_CARD', '0', { cardId }));

        const result = tryCmd(state, cmd('UNDO_SELL_CARD', '1'));
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// 2. REORDER_CARD_TO_END
// ============================================================================

describe('REORDER_CARD_TO_END 重排卡牌到末尾', () => {
    it('将第一张卡牌移到手牌末尾', () => {
        let state = setupToMain1();
        const hand = state.core.players['0'].hand;
        expect(hand.length).toBeGreaterThanOrEqual(2);

        const firstCardId = hand[0].id;
        const secondCardId = hand[1].id;

        state = execCmd(state, cmd('REORDER_CARD_TO_END', '0', { cardId: firstCardId }));

        const newHand = state.core.players['0'].hand;
        expect(newHand[newHand.length - 1].id).toBe(firstCardId);
        expect(newHand[0].id).toBe(secondCardId);
        expect(newHand.length).toBe(hand.length);
    });

    it('最后一张卡牌重排顺序不变', () => {
        let state = setupToMain1();
        const hand = state.core.players['0'].hand;
        const lastCardId = hand[hand.length - 1].id;
        const handIds = hand.map(c => c.id);

        state = execCmd(state, cmd('REORDER_CARD_TO_END', '0', { cardId: lastCardId }));

        const newHandIds = state.core.players['0'].hand.map(c => c.id);
        expect(newHandIds).toEqual(handIds);
    });

    it('非当前玩家无法重排', () => {
        const state = setupToMain1();
        const cardId = state.core.players['1'].hand[0].id;

        const result = tryCmd(state, cmd('REORDER_CARD_TO_END', '1', { cardId }));
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// 3. CANCEL_INTERACTION
// ============================================================================

// @deprecated - CANCEL_INTERACTION 命令已废弃，使用 InteractionSystem 的 CANCEL 命令
describe.skip('CANCEL_INTERACTION 取消交互', () => {
    it('取消交互后卡牌回手牌、CP 返还、pendingInteraction 清除', () => {
        let state = setupToMain1();
        const player0 = state.core.players['0'];
        const testCard = { ...player0.hand[0], cpCost: 3 }; // 模拟 cpCost=3 的卡牌
        const cpBefore = player0.resources[RESOURCE_IDS.CP];

        // 手动注入 pendingInteraction 状态（模拟打出卡牌后触发交互）
        player0.hand = player0.hand.filter(c => c.id !== testCard.id);
        player0.discard.push(testCard);
        player0.resources[RESOURCE_IDS.CP] = cpBefore - 3;

        const interaction: PendingInteraction = {
            id: 'test-interaction-1',
            playerId: '0',
            sourceCardId: testCard.id,
            type: 'modifyDie',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
        };
        injectPendingInteraction(state, interaction);

        // 取消交互
        state = execCmd(state, cmd('CANCEL_INTERACTION', '0'));

        const p0After = state.core.players['0'];
        expect(p0After.hand.some(c => c.id === testCard.id)).toBe(true);
        expect(p0After.discard.some(c => c.id === testCard.id)).toBe(false);
        // CP 返还：execute 从 discard 中找到 card.cpCost=3，reducer 返还 3
        expect(p0After.resources[RESOURCE_IDS.CP]).toBe(cpBefore);
        // sys.interaction 应已解除
        expect(state.sys.interaction.current).toBeFalsy();
    });

    it('没有 pendingInteraction 时取消失败', () => {
        const state = setupToMain1();
        const result = tryCmd(state, cmd('CANCEL_INTERACTION', '0'));
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// 4. TRANSFER_STATUS
// ============================================================================

describe('TRANSFER_STATUS 转移状态', () => {
    it('转移 statusEffect：源玩家移除、目标玩家获得', () => {
        let state = setupToMain1();

        // 注入状态
        state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
        state.core.players['1'].statusEffects[STATUS_IDS.KNOCKDOWN] = 0;

        // 注入 pendingInteraction 到 sys.interaction（转移需要交互上下文）
        injectPendingInteraction(state, {
            id: 'transfer-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'selectTargetStatus',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
            transferConfig: {},
        });

        state = execCmd(state, cmd('TRANSFER_STATUS', '0', {
            fromPlayerId: '0',
            toPlayerId: '1',
            statusId: STATUS_IDS.KNOCKDOWN,
        }));

        expect(state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0).toBe(0);
        expect(state.core.players['1'].statusEffects[STATUS_IDS.KNOCKDOWN]).toBe(1);
    });

    it('转移 Token：源玩家消耗、目标玩家获得', () => {
        let state = setupToMain1();

        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;
        state.core.players['1'].tokens[TOKEN_IDS.TAIJI] = 1;

        injectPendingInteraction(state, {
            id: 'transfer-token-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'selectTargetStatus',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
            transferConfig: {},
        });

        state = execCmd(state, cmd('TRANSFER_STATUS', '0', {
            fromPlayerId: '0',
            toPlayerId: '1',
            statusId: TOKEN_IDS.TAIJI,
        }));

        expect(state.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(0);
        expect(state.core.players['1'].tokens[TOKEN_IDS.TAIJI]).toBe(4);
    });

    it('没有 pendingInteraction 时转移失败', () => {
        const state = setupToMain1();
        const result = tryCmd(state, cmd('TRANSFER_STATUS', '0', {
            fromPlayerId: '0',
            toPlayerId: '1',
            statusId: STATUS_IDS.KNOCKDOWN,
        }));
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// 5. USE_TOKEN（伤害响应窗口）
// ============================================================================

describe('USE_TOKEN 伤害响应窗口使用 Token', () => {
    /** 创建带 pendingDamage 的状态 */
    function setupWithPendingDamage(
        responderId: PlayerId,
        responseType: 'beforeDamageDealt' | 'beforeDamageReceived',
        damage = 6,
    ): MatchState<DiceThroneCore> {
        const state = setupToMain1();
        state.core.pendingDamage = {
            id: 'pd-test',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: damage,
            currentDamage: damage,
            sourceAbilityId: 'test-ability',
            responseType,
            responderId,
        };
        return state;
    }

    it('防御方使用太极减伤', () => {
        let state = setupWithPendingDamage('1', 'beforeDamageReceived');
        state.core.players['1'].tokens[TOKEN_IDS.TAIJI] = 4;

        state = execCmd(state, cmd('USE_TOKEN', '1', {
            tokenId: TOKEN_IDS.TAIJI,
            amount: 3,
        }));

        // 太极消耗 3 个
        expect(state.core.players['1'].tokens[TOKEN_IDS.TAIJI]).toBe(1);
        // 太极 value=-1，消耗 3 个 → damageModifier = -3 → currentDamage = 6 - 3 = 3
        if (state.core.pendingDamage) {
            expect(state.core.pendingDamage.currentDamage).toBe(3);
        }
    });

    it('攻击方使用太极（damageBoost 阶段，modifier 正确反转为正数）', () => {
        // 太极的 effect.value = -1，但攻击方使用时 tokenResponse 会反转符号
        // 攻击方阶段 responseType=beforeDamageDealt，modifier = abs(-1) * 2 = +2
        let state = setupWithPendingDamage('0', 'beforeDamageDealt');
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;

        state = execCmd(state, cmd('USE_TOKEN', '0', {
            tokenId: TOKEN_IDS.TAIJI,
            amount: 2,
        }));

        expect(state.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(1);
        // modifier = abs(-1) * 2 = +2 → currentDamage = 6 + 2 = 8
        if (state.core.pendingDamage) {
            expect(state.core.pendingDamage.currentDamage).toBe(8);
        }
    });

    it('没有 pendingDamage 时使用 Token 失败', () => {
        const state = setupToMain1();
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;

        const result = tryCmd(state, cmd('USE_TOKEN', '0', {
            tokenId: TOKEN_IDS.TAIJI,
            amount: 1,
        }));
        expect(result.success).toBe(false);
    });

    it('Token 不足时使用失败', () => {
        const state = setupWithPendingDamage('0', 'beforeDamageDealt');
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 0;

        const result = tryCmd(state, cmd('USE_TOKEN', '0', {
            tokenId: TOKEN_IDS.TAIJI,
            amount: 1,
        }));
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// 6. 牌库耗尽洗牌
// ============================================================================

describe('牌库耗尽洗牌', () => {
    it('牌库为空时抽牌触发弃牌堆洗回', () => {
        let state = setupToMain1();
        const player0 = state.core.players['0'];

        // 将牌库清空，把卡牌放入弃牌堆
        const deckCards = [...player0.deck];
        player0.discard.push(...deckCards);
        player0.deck = [];

        expect(player0.deck.length).toBe(0);
        const discardSize = player0.discard.length;
        expect(discardSize).toBeGreaterThan(0);
        const handSizeBefore = player0.hand.length;

        // 抽牌 → 应触发洗牌
        state = execCmd(state, cmd('DRAW_CARD', '0'));

        const p0After = state.core.players['0'];
        expect(p0After.hand.length).toBe(handSizeBefore + 1);
        expect(p0After.discard.length).toBe(0);
        expect(p0After.deck.length).toBe(discardSize - 1);
    });

    it('牌库和弃牌堆都为空时抽牌失败', () => {
        const state = setupToMain1();
        state.core.players['0'].deck = [];
        state.core.players['0'].discard = [];

        const result = tryCmd(state, cmd('DRAW_CARD', '0'));
        expect(result.success).toBe(false);
    });
});
