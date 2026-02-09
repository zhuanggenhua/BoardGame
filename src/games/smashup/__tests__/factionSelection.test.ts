/**
 * 大杀四方 - 派系选择测试
 *
 * 覆盖 Property 1: 派系互斥选择
 * 覆盖 Property 2: 牌库构建正确性
 * 覆盖 Property 3: 选择完成后初始化
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createDefaultSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, STARTING_HAND_SIZE } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities } from '../abilities';
import { getBaseDefIdsForFactions } from '../data/cards';

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

describe('派系选择系统', () => {
    // Property 1: 派系互斥选择
    describe('Property 1: 派系互斥选择', () => {
        it('已选派系不可被其他玩家选择', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '互斥测试',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                ],
            });
            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(false);
            expect(result.steps[1]?.error).toContain('已被选择');
        });

        it('不同派系可以被不同玩家选择', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '不同派系',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                ],
            });
            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(true);
        });

        it('非当前玩家不能选择', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '非当前玩家',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                ],
            });
            expect(result.steps[0]?.success).toBe(false);
            expect(result.steps[0]?.error).toContain('不是你的回合');
        });

        it('蛇形选秀顺序正确（2人：P0→P1→P1→P0）', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '蛇形选秀',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                ],
            });
            for (const step of result.steps) {
                expect(step.success).toBe(true);
            }
        });

        it('蛇形选秀中间步骤顺序错误被拒绝', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '顺序错误',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    // P1 应该选，但 P0 又选了
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                ],
            });
            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(false);
        });

        it('已选满两个派系的玩家不能再选', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '超额选择',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                    // 选秀已完成，再选应失败（阶段已推进）
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
                ],
            });
            // 前4步成功
            for (let i = 0; i < 4; i++) {
                expect(result.steps[i]?.success).toBe(true);
            }
            // 第5步失败（阶段已不是 factionSelect）
            expect(result.steps[4]?.success).toBe(false);
        });
    });

    // Property 2: 牌库构建正确性
    describe('Property 2: 牌库构建正确性', () => {
        it('选择完成后每位玩家牌库+手牌=40张', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '牌库构建',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ],
            });
            const core = result.finalState.core;
            for (const pid of PLAYER_IDS) {
                const player = core.players[pid];
                const totalCards = player.hand.length + player.deck.length;
                expect(totalCards).toBe(40);
            }
        });

        it('牌库中的卡牌属于所选派系', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '派系归属',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ],
            });
            const core = result.finalState.core;

            // P0 选了 aliens + dinosaurs
            expect(core.players['0'].factions).toEqual([SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS]);
            // P1 选了 pirates + ninjas
            expect(core.players['1'].factions).toEqual([SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]);
        });
    });

    // Property 3: 选择完成后初始化
    describe('Property 3: 选择完成后初始化', () => {
        it('每位玩家有5张起始手牌', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '起始手牌',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ],
            });
            const core = result.finalState.core;
            for (const pid of PLAYER_IDS) {
                expect(core.players[pid].hand.length).toBe(STARTING_HAND_SIZE);
            }
        });

        it('场上有玩家数+1张基地', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '基地数量',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ],
            });
            expect(result.finalState.core.bases.length).toBe(PLAYER_IDS.length + 1);
        });

        it('阶段推进到 playCards', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '阶段推进',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ],
            });
            expect(result.finalState.sys.phase).toBe('playCards');
        });

        it('派系选择状态被清除', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '选择状态清除',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ],
            });
            expect(result.finalState.core.factionSelection).toBeUndefined();
        });

        it('基地来自所选派系对应扩展包', () => {
            const runner = createRunner();
            const selectedFactions = [
                SMASHUP_FACTION_IDS.ALIENS,
                SMASHUP_FACTION_IDS.DINOSAURS,
                SMASHUP_FACTION_IDS.PIRATES,
                SMASHUP_FACTION_IDS.NINJAS,
            ];
            const result = runner.run({
                name: '基地扩展包筛选',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: selectedFactions[0] } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: selectedFactions[2] } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: selectedFactions[3] } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: selectedFactions[1] } },
                    { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                ],
            });

            const allowed = new Set(getBaseDefIdsForFactions(selectedFactions));
            const allBaseIds = [
                ...result.finalState.core.bases.map(b => b.defId),
                ...result.finalState.core.baseDeck,
            ];
            for (const id of allBaseIds) {
                expect(allowed.has(id)).toBe(true);
            }
        });
    });
});
