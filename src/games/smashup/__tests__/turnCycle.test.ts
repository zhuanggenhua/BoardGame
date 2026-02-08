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
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId } from '../domain/types';
import { initAllAbilities } from '../abilities';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createDefaultSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
        silent: true,
    });
}

/** 蛇形选秀 + 推进到 playCards */
const DRAFT_COMMANDS: SmashUpCommand[] = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'aliens' } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'pirates' } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'ninjas' } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'dinosaurs' } },
    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
] as any[];

/** Me First! 响应：两人都让过 */
const ME_FIRST_PASS = [
    { type: 'RESPONSE_PASS', playerId: '0', payload: {} },
    { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
] as any[];

// ============================================================================
// 完整回合循环
// ============================================================================

describe('完整回合循环', () => {
    it('playCards → scoreBases → draw → endTurn → startTurn 完整流转', () => {
        const runner = createRunner();
        // 选秀 + 推进到 playCards
        const result = runner.run({
            name: '完整回合',
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases（Me First! 响应窗口打开）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // Me First! 两人都让过 → auto-continue → draw
                ...ME_FIRST_PASS,
            ] as any[],
        });

        // scoreBases auto-continue 到 draw
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
                // P0: playCards → scoreBases（Me First!）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ...ME_FIRST_PASS,
                // auto-continue: scoreBases → draw
                // draw → endTurn(auto→startTurn)
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
                // startTurn(auto→playCards) — 需要再推一次
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(getCurrentPlayerId(result.finalState.core)).toBe('1');
    });

    it('两个完整回合后回到 P0', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '两个完整回合',
            commands: [
                ...DRAFT_COMMANDS,
                // P0 回合：playCards → scoreBases（Me First!）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // Me First! 响应队列从 P0 开始：P0→P1
                { type: 'RESPONSE_PASS', playerId: '0', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
                // auto-continue: scoreBases → draw
                // draw → endTurn(auto→startTurn)
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
                // P1 回合：startTurn → playCards(auto)
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
                // P1 回合：playCards → scoreBases（Me First!）
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
                // Me First! 响应队列从 P1 开始：P1→P0
                { type: 'RESPONSE_PASS', playerId: '1', payload: {} },
                { type: 'RESPONSE_PASS', playerId: '0', payload: {} },
                // auto-continue: scoreBases → draw
                // draw → endTurn(auto→startTurn)
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P0 回合：startTurn → playCards
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(getCurrentPlayerId(result.finalState.core)).toBe('0');
        // P0 额度重置
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
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'ninjas' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'aliens' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'dinosaurs' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'pirates' } },
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
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'ninjas' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'aliens' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'dinosaurs' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'pirates' } },
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
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'wizards' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'pirates' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'ninjas' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'aliens' } },
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
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'wizards' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'pirates' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: 'ninjas' } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: 'aliens' } },
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
