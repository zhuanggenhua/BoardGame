/**
 * 大杀四方 - 派系选择测试
 *
 * 覆盖 Property 1: 派系互斥选择
 * 覆盖 Property 2: 牌库构建正确性
 * 覆盖 Property 3: 选择完成后初始化
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import type { MatchState } from '../../../engine/types';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, STARTING_HAND_SIZE } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities } from '../abilities';
import smashUpEnglishMap from '../data/englishAtlasMap.json';
import {
    getAllBaseDefs,
    getBaseDef,
    getBaseDefIdsForFactions,
    getBasePodFactionIds,
    getBasePodVariantId,
    getFactionTitans,
} from '../data/cards';
import { getSmashUpPodAtlasImagePath } from '../ui/cardAtlas';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createRunner(playerIds: string[] = PLAYER_IDS) {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
        ],
        playerIds,
        silent: true,
    });
}

/** 完成全部4次派系选择的标准命令序列（蛇形选秀：P0→P1→P1→P0） */
const FULL_DRAFT_COMMANDS = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
] as const;

describe('派系选择系统', () => {
    it('fairies 会暴露对应的泰坦定义', () => {
        expect(getFactionTitans(SMASHUP_FACTION_IDS.FAIRIES).map(card => card.id)).toContain('fairies_spirit_of_the_forest');
    });

    // Property 1: 派系互斥选择
    describe('Property 1: 派系互斥选择', () => {
        it('已选派系不可被其他玩家选择', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '互斥测试',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                ],
            });
            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(true);
            expect(result.steps[2]?.success).toBe(false);
            expect(result.steps[2]?.error).toContain('已被选择');
        });

        it('普通版与 POD 版视为同一派系，其他玩家不能重复选择', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '普通版与 POD 版跨玩家互斥',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS_POD } },
                ],
            });

            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(true);
            expect(result.steps[2]?.success).toBe(false);
            expect(result.steps[2]?.error).toContain('已被选择');
        });

        it('普通版与 POD 版视为同一派系，同一玩家第二选不能重复', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '普通版与 POD 版同玩家互斥',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS_POD } },
                ],
            });

            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(true);
            expect(result.steps[2]?.success).toBe(true);
            expect(result.steps[3]?.success).toBe(false);
            expect(result.steps[3]?.error).toContain('已被选择');
        });

        it('不同派系可以被不同玩家选择', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '不同派系',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                ],
            });
            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(true);
            expect(result.steps[2]?.success).toBe(true);
        });

        it('选种族记录缺失时会重建空选种族状态，并阻止自动推进到开局', () => {
            const runner = createRunner();
            const initial = runner.run({
                name: '初始选种族状态',
                commands: [],
            }).finalState;

            const corruptedState: MatchState<SmashUpCore> = {
                ...initial,
                sys: {
                    ...initial.sys,
                    phase: 'factionSelect',
                },
                core: {
                    ...initial.core,
                    factionSelection: undefined,
                },
            };

            const normalized = SmashUpDomain.normalizeRuntimeState(corruptedState);
            expect(normalized.core.factionSelection).toEqual({
                takenFactions: [],
                playerSelections: {
                    '0': [],
                    '1': [],
                },
                completedPlayers: [],
            });

            expect(
                smashUpFlowHooks.onAutoContinueCheck({
                    state: normalized,
                    events: [],
                }),
            ).toBeUndefined();

            expect(
                SmashUpDomain.validate(normalized, {
                    type: SU_COMMANDS.SELECT_FACTION,
                    playerId: '0',
                    payload: { factionId: SMASHUP_FACTION_IDS.ALIENS },
                }).valid,
            ).toBe(true);
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
            expect(result.steps[0]?.error).toContain('player_mismatch');
        });

        it('蛇形选秀正确（2人：P0→P1→P1→P0）', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '蛇形选秀',
                commands: [...FULL_DRAFT_COMMANDS],
            });
            for (const step of result.steps) {
                expect(step.success).toBe(true);
            }
        });

        it('蛇形选秀中间步骤顺序错误被拒绝', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '蛇形顺序错误',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    // 下一手应轮到 P1 选择，但 P0 试图提前拿第二个派系
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
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
                    ...FULL_DRAFT_COMMANDS,
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

        it('当前玩家可以取消自己已选的派系，并保留当前选择权', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '取消自己已选派系',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.DESELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                ],
            });

            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(true);
            expect(result.steps[2]?.success).toBe(true);
            expect(result.finalState.core.factionSelection?.playerSelections['1']).toEqual([]);
            expect(result.finalState.core.factionSelection?.takenFactions).toEqual([SMASHUP_FACTION_IDS.ALIENS]);
            expect(result.finalState.core.turnOrder[result.finalState.core.currentPlayerIndex]).toBe('1');
        });

        it('不能取消其他玩家已选的派系', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '取消他人派系',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.DESELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                ],
            });

            expect(result.steps[0]?.success).toBe(true);
            expect(result.steps[1]?.success).toBe(false);
            expect(result.steps[1]?.error).toContain('尚未选择');
        });

        it('取消后仍可重新完成整轮选秀', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '取消后重选完成选秀',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.DESELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                ],
            });

            expect(result.steps.every((step) => step.success)).toBe(true);
            expect(result.finalState.core.players['0'].factions).toEqual([
                SMASHUP_FACTION_IDS.ALIENS,
                SMASHUP_FACTION_IDS.DINOSAURS,
            ]);
            expect(result.finalState.core.players['1'].factions).toEqual([
                SMASHUP_FACTION_IDS.NINJAS,
                SMASHUP_FACTION_IDS.PIRATES,
            ]);
            expect(result.finalState.sys.phase).toBe('playCards');
        });

    });

    // Property 2: 牌库构建正确性
    describe('Property 2: 牌库构建正确性', () => {
        it('选择完成后每位玩家牌库+手牌=40张', () => {
            const runner = createRunner();
            // 第4次选择后自动推进到 playCards，无需额外 ADVANCE_PHASE
            const result = runner.run({
                name: '牌库构建',
                commands: [...FULL_DRAFT_COMMANDS],
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
                commands: [...FULL_DRAFT_COMMANDS],
            });
            const core = result.finalState.core;

            // P0 选了 aliens + dinosaurs
            expect(core.players['0'].factions).toEqual([SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS]);
            // P1 选了 pirates + ninjas
            expect(core.players['1'].factions).toEqual([SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS]);
        });

        it('新接入派系也能正常构建 40 张牌库', () => {
            const runner = createRunner();
            const result = runner.run({
                name: 'Oops 四派系牌库构建',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.SAMURAI } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.VIKINGS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.COWBOYS } },
                ],
            });

            expect(result.steps.every(step => step.success)).toBe(true);
            for (const pid of PLAYER_IDS) {
                const player = result.finalState.core.players[pid];
                expect(player.hand.length + player.deck.length).toBe(40);
            }
        });

        it('四人蛇形选秀中末位玩家的两派系都会进入牌库', () => {
            const playerIds = ['0', '1', '2', '3'];
            const runner = createRunner(playerIds);
            const result = runner.run({
                name: '反馈 6a10f998：P4 两个派系都进入牌库',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ZOMBIES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '2', payload: { factionId: SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '3', payload: { factionId: SMASHUP_FACTION_IDS.KAIJU } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '3', payload: { factionId: SMASHUP_FACTION_IDS.GHOSTS_POD } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '2', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS_POD } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.FAIRIES } },
                ],
            });

            expect(result.steps.every(step => step.success)).toBe(true);
            const player = result.finalState.core.players['3'];
            const cards = [...player.hand, ...player.deck];
            expect(player.factions).toEqual([SMASHUP_FACTION_IDS.KAIJU, SMASHUP_FACTION_IDS.GHOSTS_POD]);
            expect(cards).toHaveLength(40);
            expect(cards.filter(card => card.defId.startsWith('kaiju_'))).toHaveLength(20);
            expect(cards.filter(card => card.defId.startsWith('ghost_'))).toHaveLength(20);
        });
    });

    // Property 3: 选择完成后初始化
    describe('Property 3: 选择完成后初始化', () => {
        it('每位玩家有5张起始手牌', () => {
            const runner = createRunner();
            // 第4次选择后自动推进，手牌在初始化时发放
            const result = runner.run({
                name: '起始手牌',
                commands: [...FULL_DRAFT_COMMANDS],
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
                commands: [...FULL_DRAFT_COMMANDS],
            });
            expect(result.finalState.core.bases.length).toBe(PLAYER_IDS.length + 1);
        });

        it('阶段推进到 playCards', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '阶段推进',
                commands: [...FULL_DRAFT_COMMANDS],
            });
            expect(result.finalState.sys.phase).toBe('playCards');
        });

        it('派系选择状态被清除', () => {
            const runner = createRunner();
            const result = runner.run({
                name: '选择状态清除',
                commands: [...FULL_DRAFT_COMMANDS],
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

        it('Oops 四派系返回对应的 8 张基地', () => {
            const baseIds = getBaseDefIdsForFactions([
                SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS,
                SMASHUP_FACTION_IDS.COWBOYS,
                SMASHUP_FACTION_IDS.SAMURAI,
                SMASHUP_FACTION_IDS.VIKINGS,
            ]);

            expect(baseIds).toEqual(expect.arrayContaining([
                'base_saloon',
                'base_so_so_corral',
                'base_pyramids',
                'base_star_portal',
                'base_shoguns_palace',
                'base_sakura_garden',
                'base_drakkar',
                'base_longhouse',
            ]));
        });

        it('Ancient Egyptians POD 可被选中并完成整轮选秀', () => {
            const runner = createRunner();
            const result = runner.run({
                name: 'Ancient Egyptians POD draft',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.COWBOYS } },
                ],
            });

            expect(result.steps.every((step) => step.success)).toBe(true);
            expect(result.finalState.core.players['0'].factions).toEqual([
                SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD,
                SMASHUP_FACTION_IDS.COWBOYS,
            ]);
        });

        it('Ancient Egyptians POD 返回 POD 基地池并复用 sphinx', () => {
            const baseIds = getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD]).sort();
            expect(baseIds).toEqual([
                'base_pyramids_pod',
                'base_star_portal_pod',
            ]);

            expect(getFactionTitans(SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS_POD).map((titan) => titan.id)).toContain('sphinx');
        });

        it('Samurai POD can complete faction draft setup', () => {
            const runner = createRunner();
            const result = runner.run({
                name: 'Samurai POD draft',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.SAMURAI_POD } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.COWBOYS } },
                ],
            });

            expect(result.steps.every((step) => step.success)).toBe(true);
            expect(result.finalState.core.players['0'].factions).toEqual([
                SMASHUP_FACTION_IDS.SAMURAI_POD,
                SMASHUP_FACTION_IDS.COWBOYS,
            ]);
        });

        it('Samurai POD returns the POD base pool variant', () => {
            const baseIds = getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.SAMURAI_POD]).sort();
            expect(baseIds).toEqual([
                'base_sakura_garden_pod',
                'base_shoguns_palace_pod',
            ]);
        });

        it('Cowboys POD 可被选中并完成整轮选秀', () => {
            const runner = createRunner();
            const result = runner.run({
                name: 'Cowboys POD draft',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.COWBOYS_POD } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VIKINGS } },
                ],
            });

            expect(result.steps.every((step) => step.success)).toBe(true);
            expect(result.finalState.core.players['0'].factions).toEqual([
                SMASHUP_FACTION_IDS.COWBOYS_POD,
                SMASHUP_FACTION_IDS.VIKINGS,
            ]);
        });

        it('Cowboys POD 返回 POD 基地池并复用 pecos_bill', () => {
            const baseIds = getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.COWBOYS_POD]).sort();
            expect(baseIds).toEqual([
                'base_saloon_pod',
                'base_so_so_corral_pod',
            ]);

            expect(getFactionTitans(SMASHUP_FACTION_IDS.COWBOYS_POD).map((titan) => titan.id)).toContain('pecos_bill');
        });

        it('Vikings POD 可被选中并完成整轮选秀', () => {
            const runner = createRunner();
            const result = runner.run({
                name: 'Vikings POD draft',
                commands: [
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.VIKINGS_POD } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
                    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.COWBOYS } },
                ],
            });

            expect(result.steps.every((step) => step.success)).toBe(true);
            expect(result.finalState.core.players['0'].factions).toEqual([
                SMASHUP_FACTION_IDS.VIKINGS_POD,
                SMASHUP_FACTION_IDS.COWBOYS,
            ]);
        });

        it('Vikings POD 返回 POD 基地池变体', () => {
            const baseIds = getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.VIKINGS_POD]).sort();
            expect(baseIds).toEqual([
                'base_drakkar_pod',
                'base_longhouse_pod',
            ]);
        });

        it('POD factions return their POD base pool variants', () => {
            const baseIds = getBaseDefIdsForFactions([
                SMASHUP_FACTION_IDS.WIZARDS_POD,
                SMASHUP_FACTION_IDS.GHOSTS_POD,
            ]);

            expect(baseIds).toEqual(expect.arrayContaining([
                'base_great_library_pod',
                'base_wizard_academy_pod',
                'base_dread_lookout_pod',
                'base_haunted_house_al9000_pod',
            ]));
            expect(baseIds).not.toContain('base_the_homeworld');
        });

        it('POD 克苏鲁扩展派系返回 POD 基地 id', () => {
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD]).sort()).toEqual([
                'base_mountains_of_madness_pod',
                'base_rlyeh_pod',
            ]);
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ELDER_THINGS_POD]).sort()).toEqual([
                'base_antarctic_base_pod',
                'base_plateau_of_leng_pod',
            ]);
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.INNSMOUTH_POD]).sort()).toEqual([
                'base_innsmouth_base_pod',
                'base_ritual_site_pod',
            ]);
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD]).sort()).toEqual([
                'base_miskatonic_university_base_pod',
                'base_the_asylum_pod',
            ]);
        });

        it('保留原版克苏鲁扩展派系的基地归属', () => {
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU]).sort()).toEqual([
                'base_mountains_of_madness',
                'base_rlyeh',
            ]);
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ELDER_THINGS]).sort()).toEqual([
                'base_antarctic_base',
                'base_plateau_of_leng',
            ]);
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.INNSMOUTH]).sort()).toEqual([
                'base_innsmouth_base',
                'base_ritual_site',
            ]);
            expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY]).sort()).toEqual([
                'base_miskatonic_university_base',
                'base_the_asylum',
            ]);
        });

        it('resolves the POD locale key for reassigned cthulhu bases', () => {
            expect(getBasePodVariantId(
                getBaseDef('base_antarctic_base'),
                new Set([SMASHUP_FACTION_IDS.ELDER_THINGS_POD]),
            )).toBe('base_antarctic_base_pod');
            expect(getBasePodVariantId(
                getBaseDef('base_the_asylum'),
                new Set([SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD]),
            )).toBe('base_the_asylum_pod');
            expect(getBasePodVariantId(
                getBaseDef('base_mountains_of_madness'),
                new Set([SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD]),
            )).toBe('base_mountains_of_madness_pod');
        });

        it('all POD-enabled bases have POD atlas mappings', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;
            const supportedPodFactions = new Set(
                Object.values(SMASHUP_FACTION_IDS)
                    .filter((factionId): factionId is string => typeof factionId === 'string' && factionId.endsWith('_pod')),
            );
            const textFallbackPodBases = new Set([
                'base_pyramids_pod',
                'base_star_portal_pod',
                'base_sakura_garden_pod',
                'base_shoguns_palace_pod',
                'base_saloon_pod',
                'base_so_so_corral_pod',
                'base_drakkar_pod',
                'base_longhouse_pod',
                'base_shark_reef_pod',
                'base_trailer_park_pod',
                'base_the_deep_pod',
                'base_tornado_alley_pod',
                'base_mermaid_pool_pod',
                'base_mermaid_reef_pod',
                'base_oracle_at_delphi_pod',
                'base_wooden_horse_pod',
                'base_wyrms_desolation_pod',
                'base_dragons_lair_pod',
                'base_converted_cave_pod',
                'base_crystal_fortress_pod',
                'base_akihabara_high_pod',
                'base_q_point_pod',
                'base_moon_dumpster_pod',
                'base_juice_bar_pod',
                'base_hideout_pod',
                'base_the_mean_streets_pod',
                'base_uss_undertaking_pod',
                'base_neutral_space_pod',
                'base_ringside_pod',
                'base_the_squared_circle_pod',
                'base_anansis_web_pod',
                'base_storytellers_hut_pod',
                'base_transformation_spring_pod',
                'base_giant_turnip_pod',
                'base_ancient_temple_pod',
                'base_city_of_gold_pod',
                'base_tokyo_pod',
                'base_kaiju_island_pod',
            ]);

            const missingPodBaseMappings = getAllBaseDefs()
                .filter(base => getBasePodFactionIds(base).some(factionId => supportedPodFactions.has(factionId)))
                .map(base => `${base.id}_pod`)
                .filter(key => !englishMap[key] && !textFallbackPodBases.has(key));

            expect(missingPodBaseMappings).toEqual([]);
        });

        it('按派系查询泰坦时，基础派系与 POD 变体都能回到同一张泰坦，未接入派系返回空数组', () => {
            const pirateTitans = getFactionTitans(SMASHUP_FACTION_IDS.PIRATES);
            const piratePodTitans = getFactionTitans(SMASHUP_FACTION_IDS.PIRATES_POD);
            const alienTitans = getFactionTitans(SMASHUP_FACTION_IDS.ALIENS);

            expect(pirateTitans.map((titan) => titan.id)).toContain('pirates_the_kraken');
            expect(piratePodTitans.map((titan) => titan.id)).toContain('pirates_the_kraken');
            expect(alienTitans).toEqual([]);
        });

        it('uses the corrected POD base atlas for the bear cavalry / ghosts / killer plants / steampunks base set', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                base_tsars_palace_pod: { atlasId: 'tts_atlas_0a564692f2', index: 0 },
                base_the_field_of_honor_pod: { atlasId: 'tts_atlas_0a564692f2', index: 1 },
                base_haunted_house_al9000_pod: { atlasId: 'tts_atlas_0a564692f2', index: 2 },
                base_dread_lookout_pod: { atlasId: 'tts_atlas_0a564692f2', index: 3 },
                base_greenhouse_pod: { atlasId: 'tts_atlas_0a564692f2', index: 4 },
                base_secret_garden_pod: { atlasId: 'tts_atlas_0a564692f2', index: 5 },
                base_inventors_salon_pod: { atlasId: 'tts_atlas_0a564692f2', index: 6 },
                base_the_workshop_pod: { atlasId: 'tts_atlas_0a564692f2', index: 7 },
            }));
        });

        it('uses the provided English titan atlas for supported titans, including sphinx and pecos bill', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                pirates_the_kraken: { atlasId: 'tts_atlas_8789f47742', index: 2 },
                bear_cavalry_major_ursa: { atlasId: 'tts_atlas_8789f47742', index: 5 },
                super_spies_moon_zero_three: { atlasId: 'tts_atlas_8789f47742', index: 10 },
                ignobles_the_hill_that_strolls: { atlasId: 'tts_atlas_8789f47742', index: 21 },
                sphinx: { atlasId: 'tts_atlas_8789f47742', index: 29 },
                pecos_bill: { atlasId: 'tts_atlas_8789f47742', index: 30 },
                penguins_emperor_penguin: { atlasId: 'tts_atlas_8789f47742', index: 31 },
            }));
        });

        it('prewires the provided English titan atlas for future titan defIds and faction-specific aliases', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                dinosaurs_fort_titanosaurus: { atlasId: 'tts_atlas_8789f47742', index: 0 },
                ninjas_invisible_ninja: { atlasId: 'tts_atlas_8789f47742', index: 1 },
                killer_plants_killer_kudzu: { atlasId: 'tts_atlas_8789f47742', index: 7 },
                frankenstein_the_bride: { atlasId: 'tts_atlas_8789f47742', index: 13 },
                fairies_spirit_of_the_forest: { atlasId: 'tts_atlas_8789f47742', index: 16 },
                sharks_helicoprion: { atlasId: 'tts_atlas_8789f47742', index: 17 },
                superheroes_the_everything_glove: { atlasId: 'tts_atlas_8789f47742', index: 18 },
                tornados_category_5: { atlasId: 'tts_atlas_8789f47742', index: 19 },
                grannies_great_grandma: { atlasId: 'tts_atlas_8789f47742', index: 23 },
                kung_fu_fighters_sifu: { atlasId: 'tts_atlas_8789f47742', index: 28 },
                ancient_egyptians_sphinx: { atlasId: 'tts_atlas_8789f47742', index: 29 },
                cowboys_pecos_bill: { atlasId: 'tts_atlas_8789f47742', index: 30 },
            }));
        });

        it('uses the provided English POD card atlases for Ancient Egyptians, Samurai, Cowboys, and Vikings', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                ancient_egyptians_tomb_trap_pod: { atlasId: 'tts_atlas_79', index: 0 },
                ancient_egyptians_mummy_pod: { atlasId: 'tts_atlas_79', index: 10 },
                ancient_egyptians_pharaoh_pod: { atlasId: 'tts_atlas_79', index: 19 },
                samurai_final_haiku_pod: { atlasId: 'tts_atlas_55', index: 0 },
                samurai_samurai_chan_pod: { atlasId: 'tts_atlas_55', index: 10 },
                samurai_shogun_pod: { atlasId: 'tts_atlas_55', index: 19 },
                cowboys_gold_strike_pod: { atlasId: 'tts_atlas_54', index: 0 },
                cowboys_deputy_pod: { atlasId: 'tts_atlas_54', index: 10 },
                cowboys_sheriff_pod: { atlasId: 'tts_atlas_54', index: 19 },
                vikings_pillage_pod: { atlasId: 'tts_atlas_56', index: 0 },
                vikings_huscarl_pod: { atlasId: 'tts_atlas_56', index: 10 },
                vikings_valkyrie_pod: { atlasId: 'tts_atlas_56', index: 19 },
            }));
        });

        it('uses the provided English POD base atlas for Ancient Egyptians, Samurai, Cowboys, and Vikings', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                base_pyramids_pod: { atlasId: 'tts_atlas_78', index: 0 },
                base_star_portal_pod: { atlasId: 'tts_atlas_78', index: 1 },
                base_so_so_corral_pod: { atlasId: 'tts_atlas_78', index: 2 },
                base_saloon_pod: { atlasId: 'tts_atlas_78', index: 3 },
                base_shoguns_palace_pod: { atlasId: 'tts_atlas_78', index: 4 },
                base_sakura_garden_pod: { atlasId: 'tts_atlas_78', index: 5 },
                base_longhouse_pod: { atlasId: 'tts_atlas_78', index: 6 },
                base_drakkar_pod: { atlasId: 'tts_atlas_78', index: 7 },
            }));
        });

        it('uses the corrected POD base atlas for base game factions', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                base_the_homeworld_pod: { atlasId: 'tts_atlas_1', index: 0 },
                base_the_mothership_pod: { atlasId: 'tts_atlas_1', index: 1 },
                base_the_jungle_pod: { atlasId: 'tts_atlas_1', index: 2 },
                base_tar_pits_pod: { atlasId: 'tts_atlas_1', index: 3 },
                base_ninja_dojo_pod: { atlasId: 'tts_atlas_1', index: 4 },
                base_temple_of_goju_pod: { atlasId: 'tts_atlas_1', index: 5 },
                base_tortuga_pod: { atlasId: 'tts_atlas_1', index: 6 },
                base_pirate_cove_pod: { atlasId: 'tts_atlas_1', index: 7 },
                base_the_factory_pod: { atlasId: 'tts_atlas_1', index: 8 },
                base_central_brain_pod: { atlasId: 'tts_atlas_1', index: 9 },
                base_mushroom_kingdom_pod: { atlasId: 'tts_atlas_1', index: 10 },
                base_cave_of_shinies_pod: { atlasId: 'tts_atlas_1', index: 11 },
                base_wizard_academy_pod: { atlasId: 'tts_atlas_1', index: 12 },
                base_great_library_pod: { atlasId: 'tts_atlas_1', index: 13 },
                base_haunted_house_pod: { atlasId: 'tts_atlas_1', index: 14 },
                base_rhodes_plaza_pod: { atlasId: 'tts_atlas_1', index: 15 },
            }));
        });

        it('uses the corrected POD base atlas for cthulhu expansion bases', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                base_antarctic_base_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 0 },
                base_plateau_of_leng_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 1 },
                base_innsmouth_base_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 2 },
                base_ritual_site_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 3 },
                base_rlyeh_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 4 },
                base_mountains_of_madness_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 5 },
                base_the_asylum_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 6 },
                base_miskatonic_university_base_pod: { atlasId: 'tts_atlas_0b888d02fd', index: 7 },
            }));
        });

        it('南极基地不再误用本地 base4 的更衣室槽位', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(getBaseDef('base_antarctic_base')?.previewRef).toEqual({
                type: 'atlas',
                atlasId: 'tts_atlas_0b888d02fd',
                index: 0,
            });
            expect(englishMap.base_antarctic_base).toEqual({
                atlasId: 'tts_atlas_0b888d02fd',
                index: 0,
            });
        });

        it('uses the corrected POD base atlas for monster smash bases', () => {
            const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

            expect(englishMap).toEqual(expect.objectContaining({
                base_the_hill_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 0 },
                base_egg_chamber_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 1 },
                base_laboratorium_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 2 },
                base_golem_schloss_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 3 },
                base_castle_blood_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 4 },
                base_crypt_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 5 },
                base_moot_site_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 6 },
                base_standing_stones_pod: { atlasId: 'tts_atlas_9aed5872d2', index: 7 },
            }));
        });

        it('loads the corrected POD base atlas from local assets without affecting other atlas paths', () => {
            expect(getSmashUpPodAtlasImagePath('tts_atlas_1')).toBe(
                'smashup/cards/tts_atlas_1',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_0a564692f2')).toBe(
                'smashup/cards/tts_atlas_0a564692f2',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_0b888d02fd')).toBe(
                'smashup/cards/tts_atlas_0b888d02fd',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_54')).toBe(
                'smashup/cards/tts_atlas_54',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_55')).toBe(
                'smashup/cards/tts_atlas_55',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_56')).toBe(
                'smashup/cards/tts_atlas_56',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_78')).toBe(
                'smashup/cards/tts_atlas_78',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_79')).toBe(
                'smashup/cards/tts_atlas_79',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_9aed5872d2')).toBe(
                'smashup/cards/tts_atlas_9aed5872d2',
            );
            expect(getSmashUpPodAtlasImagePath('tts_atlas_8310911466')).toBe(
                'smashup/pod-assets/tts_atlas_8310911466',
            );
        });
    });
});
