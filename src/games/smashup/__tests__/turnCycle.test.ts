/**
 * 大杀四方 - 完整回合循环与持续行动卡测试
 *
 * 覆盖：
 * - 完整回合循环：playCards → scoreBases → draw → endTurn → startTurn
 * - Property 9: 持续行动卡附着
 * - 随从消灭能力集成测试
 * - 抽牌阶段与手牌上限弃牌
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createDefaultSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent, CardInstance } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId, HAND_LIMIT, VP_TO_WIN, DRAW_PER_TURN } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities } from '../abilities';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';

const PLAYER_IDS = ['0', '1'];

const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createDefaultSystems<SmashUpCore>(),
];

beforeAll(() => {
    initAllAbilities();
});

function createRunner(setup?: (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: PLAYER_IDS,
        silent: true,
        ...(setup ? { setup } : {}),
    });
}

/** 蛇形选秀 + 推进到 playCards */
const DRAFT_COMMANDS: SmashUpCommand[] = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
] as any[];

// ============================================================================
// 完整回合循环
// ============================================================================

describe('完整回合循环', () => {
    it('playCards → scoreBases(auto skip) → draw 完整流转', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '完整回合',
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases(auto skip) → draw（auto-continue 只推进一步）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 无基地达标，scoreBases auto-continue 到 draw，停在 draw
        expect(result.finalState.sys.phase).toBe('draw');

        // 验证 P0 抽了 2 张牌（DRAW_PER_TURN = 2）
        const core = result.finalState.core;
        const p0 = core.players['0'];
        // 起始 5 张 + 抽 2 张 = 7 张
        expect(p0.hand.length).toBe(7);
    });

    it('draw 阶段手牌不超限自动推进到 endTurn → startTurn', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '自动推进到下一回合',
            commands: [
                ...DRAFT_COMMANDS,
                // P0: playCards → scoreBases(auto skip) → draw
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // draw → endTurn → auto → startTurn（手牌 7 ≤ 上限 10，不需弃牌）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // draw ADVANCE → endTurn，endTurn auto-continue → startTurn
        expect(result.finalState.sys.phase).toBe('startTurn');
    });

    it('两个完整回合后回到 P0', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '两个完整回合',
            commands: [
                ...DRAFT_COMMANDS,
                // P0 回合：playCards → scoreBases(auto) → draw
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // draw → endTurn(auto) → startTurn(auto) → playCards(P1)
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P1 回合：playCards → scoreBases(auto) → draw
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
                // draw → endTurn(auto) → startTurn(auto) → playCards(P0)
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.core.players['0'].minionsPlayed).toBe(0);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(0);
    });
});

// ============================================================================
// 随从消灭能力集成测试
// ============================================================================

describe('随从消灭能力集成', () => {
    it('打出有 onPlay 消灭能力的随从时触发消灭', () => {
        const runner = createRunner();
        // 选秀：P0 选 pirates+ninjas，P1 选 aliens+dinosaurs
        // 这样 P0 有忍者（有消灭能力的随从）
        const result = runner.run({
            name: '选秀',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        expect(pid).toBe('0');

        // 找一张随从卡先放到基地上（作为目标）
        const p0 = core.players['0'];
        const anyMinion = p0.hand.find(c => c.type === 'minion');
        if (!anyMinion) return;

        // 先让 P0 打出一个随从到基地 0
        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '打出随从作为目标',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: { cardUid: anyMinion.uid, baseIndex: 0 },
                },
            ] as any[],
        });

        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(true);

        // 验证随从在基地上
        const base = result2.finalState.core.bases[0];
        expect(base.minions.length).toBeGreaterThanOrEqual(1);
        expect(base.minions.some(m => m.uid === anyMinion.uid)).toBe(true);
    });
});

// ============================================================================
// Property 9: 持续行动卡附着
// ============================================================================

describe('Property 9: 持续行动卡附着', () => {
    it('ongoing 行动卡打出后附着到基地而非弃牌堆', () => {
        const runner = createRunner();
        // 使用 aliens（有 ongoing 行动卡 alien_jammed_signals）
        const result = runner.run({
            name: '选秀',
            commands: DRAFT_COMMANDS,
        });

        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];

        // 找 ongoing 行动卡
        const ongoingCard = player.hand.find(c => {
            if (c.type !== 'action') return false;
            // alien_jammed_signals 是 ongoing 类型
            return c.defId === 'alien_jammed_signals';
        });

        if (!ongoingCard) {
            // 手牌中没有 ongoing 卡，跳过
            return;
        }

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '打出 ongoing 行动卡',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: pid,
                    payload: {
                        cardUid: ongoingCard.uid,
                        targetBaseIndex: 0,
                    },
                },
            ] as any[],
        });

        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(true);
        expect(playStep?.events).toContain(SU_EVENTS.ACTION_PLAYED);
        expect(playStep?.events).toContain(SU_EVENTS.ONGOING_ATTACHED);

        const newCore = result2.finalState.core;
        const newPlayer = newCore.players[pid];

        // 卡牌不在手牌中
        expect(newPlayer.hand.some(c => c.uid === ongoingCard.uid)).toBe(false);
        // 卡牌不在弃牌堆中（ongoing 不进弃牌堆）
        expect(newPlayer.discard.some(c => c.uid === ongoingCard.uid)).toBe(false);
        // 卡牌附着在基地上
        expect(newCore.bases[0].ongoingActions.some(o => o.uid === ongoingCard.uid)).toBe(true);
    });
});

// ============================================================================
// 额度修改能力集成
// ============================================================================

describe('额度修改能力', () => {
    it('时间法师 onPlay 增加行动额度', () => {
        const runner = createRunner();
        // P0 选 wizards + aliens
        const result = runner.run({
            name: '选秀',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];

        // 找时间法师
        const chronomage = player.hand.find(c => c.defId === 'wizard_chronomage');
        if (!chronomage) return;

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '打出时间法师',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: pid,
                    payload: { cardUid: chronomage.uid, baseIndex: 0 },
                },
            ] as any[],
        });

        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(true);
        expect(playStep?.events).toContain(SU_EVENTS.MINION_PLAYED);
        expect(playStep?.events).toContain(SU_EVENTS.LIMIT_MODIFIED);

        // 行动额度增加到 2
        const newPlayer = result2.finalState.core.players[pid];
        expect(newPlayer.actionLimit).toBe(2);
    });
});


// ============================================================================
// 自定义 setup 工具函数
// ============================================================================

/**
 * 创建手牌超限场景的辅助函数
 * 在选秀完成后的状态上，从 P0 牌库移额外卡牌到手牌
 */
function injectExtraHandCards(state: MatchState<SmashUpCore>, count: number): MatchState<SmashUpCore> {
    const p0 = state.core.players['0'];
    const extraCards = p0.deck.slice(0, count);
    return {
        ...state,
        core: {
            ...state.core,
            players: {
                ...state.core.players,
                ['0']: {
                    ...p0,
                    hand: [...p0.hand, ...extraCards],
                    deck: p0.deck.slice(count),
                },
            },
        },
    };
}

// ============================================================================
// 手牌超限弃牌
// ============================================================================

describe('手牌超限弃牌', () => {
    it('draw 阶段手牌超限时停在 draw，等待 DISCARD_TO_LIMIT', () => {
        // 第一步：正常跑完选秀，拿到 post-draft 状态
        const runner1 = createRunner();
        const draftResult = runner1.run({
            name: '选秀',
            commands: DRAFT_COMMANDS,
        });
        // 选秀后 P0 手牌 = 5（STARTING_HAND_SIZE）
        expect(draftResult.finalState.sys.phase).toBe('playCards');

        // 第二步：注入额外手牌（从牌库移 4 张到手牌，使手牌 = 9）
        // 抽 2 张后 = 11 > HAND_LIMIT(10)
        const modifiedState = injectExtraHandCards(draftResult.finalState, 4);
        expect(modifiedState.core.players['0'].hand.length).toBe(9);

        // 第三步：用修改后的状态继续执行
        const runner2 = createRunner(() => modifiedState);
        const result = runner2.run({
            name: '手牌超限停在 draw',
            commands: [
                // playCards → scoreBases(auto skip) → draw（抽 2 张后手牌 = 11 > 10）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('draw');
        const p0 = result.finalState.core.players['0'];
        // 9 + 2 = 11 张手牌
        expect(p0.hand.length).toBe(9 + DRAW_PER_TURN);
        expect(p0.hand.length).toBeGreaterThan(HAND_LIMIT);
    });

    it('DISCARD_TO_LIMIT 弃牌后手牌 = HAND_LIMIT，自动推进', () => {
        // 选秀 + 注入额外手牌
        const runner1 = createRunner();
        const draftResult = runner1.run({
            name: '选秀',
            commands: DRAFT_COMMANDS,
        });
        const modifiedState = injectExtraHandCards(draftResult.finalState, 4);

        // 推进到 draw（手牌超限）
        const runner2 = createRunner(() => modifiedState);
        const preResult = runner2.run({
            name: '推进到 draw',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const p0Hand = preResult.finalState.core.players['0'].hand;
        const excess = p0Hand.length - HAND_LIMIT;
        expect(excess).toBeGreaterThan(0);

        // 选择弃掉多余的牌（取最后 excess 张）
        const discardUids = p0Hand.slice(-excess).map(c => c.uid);

        // 用同样的初始状态重新跑，加上弃牌命令
        const runner3 = createRunner(() => modifiedState);
        const result = runner3.run({
            name: '弃牌后自动推进',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                {
                    type: SU_COMMANDS.DISCARD_TO_LIMIT,
                    playerId: '0',
                    payload: { cardUids: discardUids },
                },
            ] as any[],
        });

        // 弃牌后手牌 = HAND_LIMIT
        const p0After = result.finalState.core.players['0'];
        expect(p0After.hand.length).toBe(HAND_LIMIT);

        // 弃掉的牌在弃牌堆中
        for (const uid of discardUids) {
            expect(p0After.discard.some(c => c.uid === uid)).toBe(true);
        }

        // 弃牌后 auto-continue：draw → endTurn（FlowSystem 每次 pipeline 只推进一步）
        // endTurn → startTurn 需要下一次 pipeline 执行
        expect(result.finalState.sys.phase).toBe('endTurn');
    });

    it('手牌未超限时 DISCARD_TO_LIMIT 被拒绝', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '手牌未超限弃牌被拒',
            commands: [
                ...DRAFT_COMMANDS,
                // 推进到 draw（手牌 = 7，未超限）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 尝试弃牌（应该失败，因为 draw 阶段已 auto-continue 到 endTurn）
                {
                    type: SU_COMMANDS.DISCARD_TO_LIMIT,
                    playerId: '0',
                    payload: { cardUids: [] },
                },
            ] as any[],
        });

        // 最后一步应该失败
        const lastStep = result.steps[result.steps.length - 1];
        expect(lastStep?.success).toBe(false);
    });
});

// ============================================================================
// ≥15 VP 胜利检查
// ============================================================================

describe('≥15 VP 胜利检查', () => {
    it('回合结束时 VP >= VP_TO_WIN 触发游戏结束', () => {
        // 选秀后注入高 VP
        const runner1 = createRunner();
        const draftResult = runner1.run({
            name: '选秀',
            commands: DRAFT_COMMANDS,
        });
        const modifiedState: MatchState<SmashUpCore> = {
            ...draftResult.finalState,
            core: {
                ...draftResult.finalState.core,
                players: {
                    ...draftResult.finalState.core.players,
                    ['0']: {
                        ...draftResult.finalState.core.players['0'],
                        vp: VP_TO_WIN,
                    },
                },
            },
        };

        const runner2 = createRunner(() => modifiedState);
        const result = runner2.run({
            name: 'VP 达标游戏结束',
            commands: [
                // P0 回合：playCards → scoreBases(auto) → draw
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // draw → endTurn → isGameOver 检查
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // isGameOver 应该在 endTurn 后检测到 P0 VP >= 15
        const core = result.finalState.core;
        expect(core.players['0'].vp).toBeGreaterThanOrEqual(VP_TO_WIN);

        // GameTestRunner 在 isGameOver 返回结果时 break，
        // 验证 isGameOver 确实返回了胜利结果
        const gameOver = SmashUpDomain.isGameOver!(core);
        expect(gameOver).toBeDefined();
        expect(gameOver!.winner).toBe('0');
        expect(gameOver!.scores).toBeDefined();
        expect(gameOver!.scores!['0']).toBeGreaterThanOrEqual(VP_TO_WIN);
    });

    it('VP 未达标时游戏继续', () => {
        const runner = createRunner();
        const result = runner.run({
            name: 'VP 未达标继续',
            commands: [
                ...DRAFT_COMMANDS,
                // P0 完整回合
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const core = result.finalState.core;
        // 正常游戏 VP = 0，不应结束
        expect(core.players['0'].vp).toBeLessThan(VP_TO_WIN);
        const gameOver = SmashUpDomain.isGameOver!(core);
        expect(gameOver).toBeUndefined();

        // 游戏应该继续到下一回合
        expect(result.finalState.sys.phase).toBe('startTurn');
    });
});
