/**
 * 大杀四方 (Smash Up) - 冒烟测试
 *
 * 覆盖：setup、派系选择、出牌、阶段推进
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createDefaultSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
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

/** 蛇形选秀命令序列 + ADVANCE_PHASE 推进到 playCards */
const DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
    // auto-continue 到 startTurn，再 ADVANCE_PHASE 推进到 playCards
    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
];

describe('smashup', () => {
    it('setup 初始化正确（派系选择阶段）', () => {
        const runner = createRunner();
        const result = runner.run({ name: 'setup 验证', commands: [] });
        const core = result.finalState.core;

        expect(core.turnOrder).toEqual(PLAYER_IDS);
        expect(core.currentPlayerIndex).toBe(0);
        expect(core.turnNumber).toBe(1);
        expect(result.finalState.sys.phase).toBe('factionSelect');
        expect(core.factionSelection).toBeDefined();
        for (const pid of PLAYER_IDS) {
            expect(core.players[pid].hand.length).toBe(0);
            expect(core.players[pid].vp).toBe(0);
        }
        expect(core.bases.length).toBe(PLAYER_IDS.length + 1);
    });

    it('派系选择完成后初始化正确', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '派系选择 + 开始',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;

        for (const step of result.steps) {
            expect(step.success).toBe(true);
        }

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(core.factionSelection).toBeUndefined();

        for (const pid of PLAYER_IDS) {
            expect(core.players[pid].hand.length).toBe(5);
        }

        expect(core.players['0'].factions).toEqual([SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS]);
        expect(core.players['1'].factions).toEqual([SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]);
    });

    it('派系互斥选择', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '派系互斥',
            commands: [
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            ],
        });
        expect(result.steps[0]?.success).toBe(true);
        expect(result.steps[1]?.success).toBe(false);
        expect(result.steps[1]?.error).toContain('已被选择');
    });

    it('出牌阶段可以打出随从', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '选秀+出牌',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;
        const pid = getCurrentPlayerId(core);
        const player = core.players[pid];
        const minionCard = player.hand.find(c => c.type === 'minion');
        if (!minionCard) return;

        expect(result.finalState.sys.phase).toBe('playCards');

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '选秀+出牌执行',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: pid,
                    payload: { cardUid: minionCard.uid, baseIndex: 0 },
                },
            ],
        });

        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(true);
        expect(playStep?.events).toContain(SU_EVENTS.MINION_PLAYED);

        const newPlayer = result2.finalState.core.players[pid];
        expect(newPlayer.hand.length).toBe(4);
        expect(newPlayer.minionsPlayed).toBe(1);
        const base = result2.finalState.core.bases[0];
        expect(base.minions.length).toBe(1);
        expect(base.minions[0].uid).toBe(minionCard.uid);
    });

    it('非当前玩家不能出牌', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '选秀',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;
        const otherPid = PLAYER_IDS.find(p => p !== getCurrentPlayerId(core))!;
        const otherPlayer = core.players[otherPid];
        const card = otherPlayer.hand[0];
        if (!card) return;

        const runner2 = createRunner();
        const result2 = runner2.run({
            name: '非当前玩家出牌',
            commands: [
                ...DRAFT_COMMANDS,
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: otherPid,
                    payload: { cardUid: card.uid, baseIndex: 0 },
                },
            ],
        });
        const playStep = result2.steps[result2.steps.length - 1];
        expect(playStep?.success).toBe(false);
    });

    it('ADVANCE_PHASE 推进阶段', () => {
        const runner = createRunner();
        const pid = PLAYER_IDS[0];

        const result = runner.run({
            name: '阶段推进',
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → scoreBases(auto skip, 无基地达标) → draw
                { type: 'ADVANCE_PHASE', playerId: pid, payload: undefined },
            ],
        });

        // 无基地达标，scoreBases auto-continue 到 draw
        expect(result.finalState.sys.phase).toBe('draw');
        // ADVANCE_PHASE 步骤成功
        const advanceStep = result.steps[DRAFT_COMMANDS.length];
        expect(advanceStep?.success).toBe(true);
    });

    it('domain 注册表加载正确', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '注册表验证',
            commands: DRAFT_COMMANDS,
        });
        const core = result.finalState.core;
        for (const pid of PLAYER_IDS) {
            for (const card of core.players[pid].hand) {
                expect(card.defId).toBeTruthy();
                expect(card.uid).toBeTruthy();
                expect(card.owner).toBe(pid);
            }
        }
    });
});
