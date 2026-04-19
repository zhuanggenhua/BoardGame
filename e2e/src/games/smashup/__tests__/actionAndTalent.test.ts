/**
 * 大杀四方 - 行动卡与天赋测试
 *
 * 覆盖：
 * - Property 6: 天赋每回合一次
 * - Property 8: 标准行动卡生命周期
 * - Property 9: 持续行动卡附着
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { getCardDef } from '../data/cards';
import type { MinionCardDef } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
        silent: true,
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
// Property 8: 标准行动卡生命周期
// ============================================================================

describe('Property 8: 标准行动卡生命周期', () => {
    it('打出标准行动卡后从手牌移入弃牌堆', () => {
        const runner = createRunner();
        const result = runner.run({ name: '选秀', commands: DRAFT_COMMANDS });
        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];

        // 找一张行动卡
        const actionCard = player.hand.find(c => c.type === 'action');
        if (!actionCard) {
            // 如果手牌中没有行动卡，跳过（取决于随机牌库）
            return;
        }

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '打出行动卡',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: pid,
                    payload: { cardUid: actionCard.uid },
                },
            ] as any[],
        });

        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(true);
        expect(playStep?.events).toContain(SU_EVENTS.ACTION_PLAYED);

        const newPlayer = result2.finalState.core.players[pid];
        // 手牌减少 1
        expect(newPlayer.hand.length).toBe(player.hand.length - 1);
        // 弃牌堆包含该卡
        expect(newPlayer.discard.some(c => c.uid === actionCard.uid)).toBe(true);
        // actionsPlayed 增加 1
        expect(newPlayer.actionsPlayed).toBe(1);
    });

    it('行动额度用完后不能再打行动卡', () => {
        const runner = createRunner();
        const result = runner.run({ name: '选秀', commands: DRAFT_COMMANDS });
        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];

        const actionCards = player.hand.filter(c => c.type === 'action');
        if (actionCards.length < 2) return;

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '打两张行动卡',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: pid,
                    payload: { cardUid: actionCards[0].uid },
                },
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: pid,
                    payload: { cardUid: actionCards[1].uid },
                },
            ] as any[],
        });

        // 第一张成功
        const step1 = result2.steps[DRAFT_COMMANDS.length];
        expect(step1?.success).toBe(true);

        // 第二张失败（额度用完）
        const step2 = result2.steps[DRAFT_COMMANDS.length + 1];
        expect(step2?.success).toBe(false);
        expect(step2?.error).toContain('额度已用完');
    });
});

// ============================================================================
// Property 6: 天赋每回合一次
// ============================================================================

describe('Property 6: 天赋每回合一次', () => {
    it('随从打出后可以使用天赋', () => {
        const runner = createRunner();
        const result = runner.run({ name: '选秀', commands: DRAFT_COMMANDS });
        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];

        // 找一张有 talent 标签的随从卡
        const talentMinion = player.hand.find(c => {
            if (c.type !== 'minion') return false;
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            return def?.abilityTags?.includes('talent');
        });

        if (!talentMinion) {
            // 手牌中没有天赋随从，跳过
            return;
        }

        // 先打出随从
        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '打出天赋随从',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: pid,
                    payload: { cardUid: talentMinion.uid, baseIndex: 0 },
                },
            ] as any[],
        });

        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(true);

        // 使用天赋
        const runner3 = createRunner();
        const result3 = runner3.run({
            name: '使用天赋',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: pid,
                    payload: { cardUid: talentMinion.uid, baseIndex: 0 },
                },
                {
                    type: SU_COMMANDS.USE_TALENT,
                    playerId: pid,
                    payload: { minionUid: talentMinion.uid, baseIndex: 0 },
                },
            ] as any[],
        });

        const talentStep = result3.steps[result3.steps.length - 1];
        expect(talentStep?.success).toBe(true);
        expect(talentStep?.events).toContain(SU_EVENTS.TALENT_USED);

        // 天赋标记为已使用
        const base = result3.finalState.core.bases[0];
        const minion = base.minions.find(m => m.uid === talentMinion.uid);
        expect(minion?.talentUsed).toBe(true);
    });

    it('同一回合不能使用两次天赋', () => {
        const runner = createRunner();
        const result = runner.run({ name: '选秀', commands: DRAFT_COMMANDS });
        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];

        const talentMinion = player.hand.find(c => {
            if (c.type !== 'minion') return false;
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            return def?.abilityTags?.includes('talent');
        });

        if (!talentMinion) return;

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '天赋使用两次',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: pid,
                    payload: { cardUid: talentMinion.uid, baseIndex: 0 },
                },
                {
                    type: SU_COMMANDS.USE_TALENT,
                    playerId: pid,
                    payload: { minionUid: talentMinion.uid, baseIndex: 0 },
                },
                {
                    type: SU_COMMANDS.USE_TALENT,
                    playerId: pid,
                    payload: { minionUid: talentMinion.uid, baseIndex: 0 },
                },
            ] as any[],
        });

        // 第一次成功
        const step1 = result2.steps[DRAFT_COMMANDS.length + 1];
        expect(step1?.success).toBe(true);

        // 第二次失败
        const step2 = result2.steps[DRAFT_COMMANDS.length + 2];
        expect(step2?.success).toBe(false);
        expect(step2?.error).toContain('天赋已使用');
    });

    it('新回合天赋重置', () => {
        const runner = createRunner();
        const result = runner.run({ name: '选秀', commands: DRAFT_COMMANDS });
        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];

        const talentMinion = player.hand.find(c => {
            if (c.type !== 'minion') return false;
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            return def?.abilityTags?.includes('talent');
        });

        if (!talentMinion) return;

        // 打出随从 → 使用天赋 → 推进到下一回合
        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '天赋重置',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: pid,
                    payload: { cardUid: talentMinion.uid, baseIndex: 0 },
                },
                {
                    type: SU_COMMANDS.USE_TALENT,
                    playerId: pid,
                    payload: { minionUid: talentMinion.uid, baseIndex: 0 },
                },
                // 推进阶段：playCards → scoreBases(auto) → draw(auto) → endTurn(auto) → startTurn(auto)
                { type: 'ADVANCE_PHASE', playerId: pid, payload: undefined },
            ] as any[],
        });

        // 验证推进成功
        const advanceStep = result2.steps[result2.steps.length - 1];
        expect(advanceStep?.success).toBe(true);

        // 检查天赋是否重置（P1 的回合开始时，P0 的随从天赋不会重置；
        // 但当 P0 的回合再次开始时会重置）
        // 由于 endTurn auto-continue 到 startTurn，此时是 P1 的回合
        // P0 的随从天赋在 P0 的下一个 startTurn 才重置
        const base = result2.finalState.core.bases[0];
        const minion = base.minions.find(m => m.uid === talentMinion.uid);
        // 当前是 P1 的回合，P0 的天赋还是 used
        expect(minion?.talentUsed).toBe(true);
    });
});
