/**
 * 大杀四方 - 扩展派系能力测试
 *
 * 覆盖：
 * - 幽灵派系：ghost_ghost, ghost_seance, ghost_shady_deal, ghost_ghostly_arrival
 * - 黑熊骑兵：bear_cavalry_bear_hug, bear_cavalry_commission
 * - 蒸汽朋克：steampunk_scrap_diving
 * - 食人花：killer_plant_insta_grow, killer_plant_weed_eater
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { reduce } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry, resolveAbility } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { fireTriggers } from '../domain/ongoingEffects';
import { uncoverBuriedCard } from '../domain/bury';
import { applyEvents, makeMatchState as makeMatchStateFromHelpers, resolveInteractionChain } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('bear cavalry interaction regressions', () => {
    it('bear_cavalry_bear_hug resolves tied weakest choice', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m1', 'test', '1', 2),
                    makeMinion('m2', 'test', '1', 2),
                ], ongoingActions: [],
            }],
        });

        const playResult = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1' },
        } as any, defaultRandom);

        const prompt = playResult.finalState.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('bear_cavalry_bear_hug');
        expect(prompt?.data?.options?.some((option: any) => option?.id === '__cancel__')).toBe(false);

        const targetOption = prompt?.data?.options?.find((option: any) => option?.value?.minionUid === 'm1');
        expect(targetOption).toBeDefined();

        const respondResult = runCommand(playResult.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: targetOption.id },
        } as any, defaultRandom);

        const destroyEvent = respondResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvent).toBeDefined();
        expect((destroyEvent as any).payload.minionUid).toBe('m1');
        expect(respondResult.finalState.core.bases[0].minions.some(m => m.uid === 'm1')).toBe(false);
    });
});

describe('ancient egyptians interaction regressions', () => {
    it('ancient_egyptians_pyramid_engineer talent 埋葬 borrowed 手牌时应保留真实 owner', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('borrowed-hand-a', 'robot_microbot_alpha', 'minion', '1')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_pyramid',
                minions: [makeMinion('engineer-1', 'ancient_egyptians_pyramid_engineer', '0', 2)],
                ongoingActions: [],
            }],
        });

        const talent = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'engineer-1', baseIndex: 0 },
        } as any, defaultRandom);
        expect(talent.success).toBe(true);

        const prompt = talent.finalState.sys.interaction?.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_pyramid_engineer_talent');
        const option = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'borrowed-hand-a');
        expect(option).toBeDefined();

        const resolved = runCommand(talent.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any, defaultRandom);

        const buried = (resolved.finalState.core.bases[0].buriedCards ?? []).find(card => card.uid === 'borrowed-hand-a');
        expect(buried).toEqual(expect.objectContaining({
            uid: 'borrowed-hand-a',
            trueOwnerId: '1',
            controllerId: '0',
            buriedFrom: 'hand',
        }));
    });

    it('ancient_egyptians_lost_knowledge 埋葬 borrowed 手牌时应保留真实 owner', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('lost-knowledge-a', 'ancient_egyptians_lost_knowledge', 'action', '0'),
                        makeCard('borrowed-lost-hand', 'robot_microbot_alpha', 'minion', '1'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_lost_test', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'lost-knowledge-a' },
        } as any, defaultRandom);
        expect(played.success).toBe(true);

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'ancient_egyptians_lost_knowledge_mode') {
                const bury = prompt.data.options.find((entry: any) => entry.value?.mode === 'bury');
                expect(bury).toBeDefined();
                return { optionId: bury.id };
            }
            if (prompt?.data?.sourceId === 'ancient_egyptians_lost_knowledge_bury') {
                const borrowed = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'borrowed-lost-hand');
                expect(borrowed).toBeDefined();
                return { optionId: borrowed.id };
            }
            if (prompt?.data?.sourceId === 'ancient_egyptians_lost_knowledge_bury_base') {
                const base = prompt.data.options.find((entry: any) => entry.value?.baseIndex === 0);
                expect(base).toBeDefined();
                return { optionId: base.id };
            }
            throw new Error(`未处理的失落知识交互 sourceId: ${prompt?.data?.sourceId ?? 'unknown'}`);
        }, defaultRandom);

        const buried = (resolved.finalState.core.bases[0].buriedCards ?? []).find(card => card.uid === 'borrowed-lost-hand');
        expect(buried).toEqual(expect.objectContaining({
            uid: 'borrowed-lost-hand',
            trueOwnerId: '1',
            controllerId: '0',
            buriedFrom: 'hand',
        }));
    });

    it('ancient_egyptians_seal_the_tomb 埋葬 borrowed 手牌时应保留真实 owner', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('seal-bury-a', 'ancient_egyptians_seal_the_tomb', 'action', '0'),
                        makeCard('borrowed-seal-hand', 'robot_microbot_alpha', 'minion', '1'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_seal_bury_test', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'seal-bury-a', targetBaseIndex: 0 },
        } as any, defaultRandom);
        expect(played.success).toBe(true);

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'ancient_egyptians_seal_the_tomb_mode') {
                const bury = prompt.data.options.find((entry: any) => entry.value?.mode === 'bury');
                expect(bury).toBeDefined();
                return { optionId: bury.id };
            }
            if (prompt?.data?.sourceId === 'ancient_egyptians_seal_the_tomb_bury') {
                const borrowed = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'borrowed-seal-hand');
                expect(borrowed).toBeDefined();
                return { optionIds: [borrowed.id] };
            }
            throw new Error(`未处理的封印墓穴埋葬交互 sourceId: ${prompt?.data?.sourceId ?? 'unknown'}`);
        }, defaultRandom);

        const buried = (resolved.finalState.core.bases[0].buriedCards ?? []).find(card => card.uid === 'borrowed-seal-hand');
        expect(buried).toEqual(expect.objectContaining({
            uid: 'borrowed-seal-hand',
            trueOwnerId: '1',
            controllerId: '0',
            buriedFrom: 'hand',
        }));
    });

    it('ancient_egyptians_you_can_take_it_with_you 自埋 borrowed 行动时应保留真实 owner', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('borrowed-self-bury', 'ancient_egyptians_you_can_take_it_with_you', 'action', '1')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_self_bury_test', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'borrowed-self-bury', targetBaseIndex: 0 },
        } as any, defaultRandom);

        const buried = (played.finalState.core.bases[0].buriedCards ?? []).find(card => card.uid === 'borrowed-self-bury');
        expect(played.success).toBe(true);
        expect(buried).toEqual(expect.objectContaining({
            uid: 'borrowed-self-bury',
            trueOwnerId: '1',
            controllerId: '0',
            buriedFrom: 'play',
        }));
    });

    it('ancient_egyptians_mummy 计分后埋葬 borrowed 随从时应保留真实 owner', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_mummy_source',
                    minions: [makeMinion('borrowed-mummy', 'ancient_egyptians_mummy', '0', 2, '1')],
                    ongoingActions: [],
                },
                { defId: 'base_mummy_target', minions: [], ongoingActions: [] },
            ],
        });

        const triggered = fireTriggers(state, 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 2, vp: 3 }],
            sourceCardUid: 'borrowed-mummy',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: defaultRandom,
            now: 1001,
        });
        const promptState = triggered.matchState ?? makeMatchState(state);
        const prompt = promptState.sys.interaction.current as any;
        expect(prompt?.data?.sourceId).toBe('ancient_egyptians_mummy_after_scoring');
        const option = prompt.data.options.find((entry: any) => entry.value?.baseIndex === 1);
        expect(option).toBeDefined();

        const resolved = runCommand(promptState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any, defaultRandom);

        const buried = resolved.finalState.core.bases[1].buriedCards?.find(card => card.uid === 'borrowed-mummy');
        expect(buried).toEqual(expect.objectContaining({
            uid: 'borrowed-mummy',
            trueOwnerId: '1',
            controllerId: '0',
            buriedFrom: 'play',
        }));
    });

    it('ancient_egyptians_seal_the_tomb 真实 uncover 多选若先翻开随从再翻开 Blessing of Anubis，后者也应看到新翻开的随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('seal-1', 'ancient_egyptians_seal_the_tomb', 'action', '0')],
                    factions: ['ancient_egyptians', 'wizards'] as any,
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_seal_test',
                minions: [],
                ongoingActions: [],
                buriedCards: [
                    {
                        uid: 'buried-mummy',
                        defId: 'ancient_egyptians_mummy',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    } as any,
                    {
                        uid: 'buried-blessing',
                        defId: 'ancient_egyptians_blessing_of_anubis',
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    } as any,
                ],
            }],
        });

        const played = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'seal-1', targetBaseIndex: 0 },
        } as any, defaultRandom);
        expect(played.success).toBe(true);

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'ancient_egyptians_seal_the_tomb_mode') {
                const uncover = prompt.data.options.find((entry: any) => entry.value?.mode === 'uncover');
                expect(uncover).toBeDefined();
                return { optionId: uncover.id };
            }
            if (prompt?.data?.sourceId === 'ancient_egyptians_seal_the_tomb_uncover') {
                const uncoverMummy = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'buried-mummy');
                const uncoverBlessing = prompt.data.options.find((entry: any) => entry.value?.cardUid === 'buried-blessing');
                expect(uncoverMummy).toBeDefined();
                expect(uncoverBlessing).toBeDefined();
                return { optionIds: [uncoverMummy.id, uncoverBlessing.id] };
            }
            throw new Error(`未处理的封印墓穴交互 sourceId: ${prompt?.data?.sourceId ?? 'unknown'}`);
        }, defaultRandom);

        const base = resolved.finalState.core.bases[0];
        const mummy = base.minions.find((minion) => minion.uid === 'buried-mummy');

        expect(base.buriedCards ?? []).toHaveLength(0);
        expect(mummy).toBeDefined();
        expect(mummy?.tempPowerModifier).toBe(2);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAYED,
            payload: expect.objectContaining({
                cardUid: 'buried-mummy',
                fromBuried: true,
            }),
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'buried-mummy',
                amount: 2,
                reason: 'ancient_egyptians_blessing_of_anubis',
            }),
        }));
    });

    it('bury.uncoverBuriedCard 翻开 fairies_enchantment 后响应 minus 时，应在 prompt state 上看到已附着的 ongoing 并写入 metadata', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_bury_enchantment',
                minions: [makeMinion('ally-1', 'robot_microbot_alpha', '0', 3)],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'buried-enchantment',
                    defId: 'fairies_enchantment',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                } as any],
            }],
        });

        const uncovered = uncoverBuriedCard({
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'buried-enchantment',
            baseIndex: 0,
            random: defaultRandom,
            now: 301,
            reason: 'test_uncover_fairies_enchantment',
        });

        const prompt = (uncovered.state.sys.interaction?.current
            ?? uncovered.state.sys.interaction?.queue?.[0]) as any;
        expect(prompt?.data?.sourceId).toBe('fairies_enchantment');
        const minusOption = prompt?.data?.options?.find((entry: any) => entry.value?.branchId === 'minus');
        expect(minusOption).toBeDefined();

        const resolved = runCommand(uncovered.state, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: minusOption.id },
        } as any, defaultRandom);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'buried-enchantment',
                defId: 'fairies_enchantment',
                ownerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
                metadata: expect.objectContaining({
                    fairiesEnchantmentMode: 'minus',
                }),
            }),
        }));

        const enchantment = resolved.finalState.core.bases[0].ongoingActions
            .find(action => action.uid === 'buried-enchantment');
        expect(enchantment?.metadata?.fairiesEnchantmentMode).toBe('minus');
    });
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid, defId, controller, owner: owner ?? controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return makeMatchStateFromHelpers(core);
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

/** 保存最近一次 execute 调用的 matchState 引用，用于检查 interaction */
let lastMatchState: MatchState<SmashUpCore> | null = null;

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, random ?? defaultRandom);
    lastMatchState = result.finalState;
    return result.events as SmashUpEvent[];
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn): SmashUpEvent[] {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    lastMatchState = result.finalState;
    return result.events as SmashUpEvent[];
}

/** 从最近一次 execute 的 matchState 中获取 interactions */
function getLastInteractions(): any[] {
    if (!lastMatchState) return [];
    const interaction = (lastMatchState.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 幽灵派系
// ============================================================================

describe('幽灵派系能力', () => {
    describe('ghost_ghost（幽灵：弃一张手牌）', () => {
        it('多张手牌时创建 Prompt 选择弃牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('m1', 'ghost_ghost', 'minion', '0'),
                            makeCard('h1', 'test_card', 'action', '0'),
                            makeCard('h2', 'test_card2', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            // 多张可弃手牌时应创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('ghost_ghost');
        });

        it('单张手牌时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('m1', 'ghost_ghost', 'minion', '0'),
                            makeCard('h1', 'test_card', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            // 单张手牌时创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
        });

        it('无其他手牌时不弃牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'ghost_ghost', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
            expect(discardEvents.length).toBe(0);
        });

        it('单张手牌时 Prompt 待决（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('m1', 'ghost_ghost', 'minion', '0'),
                            makeCard('h1', 'test_card', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const newState = applyEvents(state, events);
            // Interaction 已创建（Prompt 待决），h1 仍在手牌
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(newState.players['0'].hand.some(c => c.uid === 'h1')).toBe(true);
            // m1 应在基地上
            expect(newState.bases[0].minions.some(m => m.uid === 'm1')).toBe(true);
        });
    });

    describe('ghost_seance（招魂：手牌≤2时抽到5张）', () => {
        it('手牌少时抽到5张', () => {
            const deckCards = Array.from({ length: 10 }, (_, i) =>
                makeCard(`d${i}`, 'test_card', 'minion', '0')
            );
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_seance', 'action', '0'),
                            makeCard('h1', 'test', 'minion', '0'),
                        ],
                        deck: deckCards,
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出 a1 后手牌剩 h1（1张），≤2 → 抽到5张 = 抽4张
            const events = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(1);
            expect((drawEvents[0] as any).payload.count).toBe(4);
        });

        it('手牌多时不抽牌', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_seance', 'action', '0'),
                            makeCard('h1', 'test', 'minion', '0'),
                            makeCard('h2', 'test', 'minion', '0'),
                            makeCard('h3', 'test', 'minion', '0'),
                        ],
                        deck: [makeCard('d1', 'test', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出后手牌剩3张 > 2 → 不抽
            const events = execPlayAction(state, '0', 'a1');
            const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
            expect(drawEvents.length).toBe(0);
        });
    });

    describe('ghost_shady_deal（阴暗交易：手牌≤2时获得1VP）', () => {
        it('手牌少时获得1VP', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_shady_deal', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出后手牌0张 ≤ 2 → 获得1VP
            const events = execPlayAction(state, '0', 'a1');
            const vpEvents = events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
            expect(vpEvents.length).toBe(1);
            expect((vpEvents[0] as any).payload.amount).toBe(1);
            expect((vpEvents[0] as any).payload.playerId).toBe('0');
        });

        it('手牌多时不获得VP', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'ghost_shady_deal', 'action', '0'),
                            makeCard('h1', 'test', 'minion', '0'),
                            makeCard('h2', 'test', 'minion', '0'),
                            makeCard('h3', 'test', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            // 打出后手牌3张 > 2 → 不获得VP
            const events = execPlayAction(state, '0', 'a1');
            const vpEvents = events.filter(e => e.type === SU_EVENTS.VP_AWARDED);
            expect(vpEvents.length).toBe(0);
        });

        it('VP 正确累加（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        vp: 3,
                        hand: [makeCard('a1', 'ghost_shady_deal', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].vp).toBe(4);
        });
    });

    describe('ghost_ghostly_arrival（悄然而至：额外随从+行动）', () => {
        it('给予额外随从和行动额度', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_ghostly_arrival', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(2);
            const types = limitEvents.map(e => (e as any).payload.limitType);
            expect(types).toContain('minion');
            expect(types).toContain('action');
        });

        it('额度正确累加（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'ghost_ghostly_arrival', 'action', '0')],
                        minionLimit: 1,
                        actionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].minionLimit).toBe(2);
            // actionLimit: 原1 + 1(额外) = 2
            expect(newState.players['0'].actionLimit).toBe(2);
        });
    });
});


// ============================================================================
// 黑熊骑兵派系
// ============================================================================

describe('黑熊骑兵派系能力', () => {
    describe('bear_cavalry_bear_hug（黑熊擒抱：每位对手消灭最弱随从）', () => {
        it('每位对手消灭自己最弱随从', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    {
                        defId: 'b1', minions: [
                            makeMinion('m0', 'test', '0', 5),
                            makeMinion('m1', 'test', '1', 3),
                            makeMinion('m2', 'test', '1', 6),
                        ], ongoingActions: [],
                    },
                    {
                        defId: 'b2', minions: [
                            makeMinion('m3', 'test', '1', 1), // 最弱
                        ], ongoingActions: [],
                    },
                ],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            // P1 最弱随从是 m3（力量1）
            expect(destroyEvents.length).toBe(1);
            expect((destroyEvents[0] as any).payload.minionUid).toBe('m3');
            expect((destroyEvents[0] as any).payload.destroyerId).toBe('0');
        });

        it('多个对手各消灭一个', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                },
                turnOrder: ['0', '1', '2'],
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m2', 'test', '2', 4),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(2);
            const destroyedUids = destroyEvents.map(e => (e as any).payload.minionUid);
            expect(destroyedUids).toContain('m1');
            expect(destroyedUids).toContain('m2');
            expect(destroyEvents.every(e => (e as any).payload.destroyerId === '0')).toBe(true);
        });

        it('对手无随从时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m0', 'test', '0', 5),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(0);
        });

        it('消灭后状态正确（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m1', 'test', '1', 2),
                        makeMinion('m2', 'test', '1', 5),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // m1（力量2）被消灭，m2 存活
            expect(newState.bases[0].minions.length).toBe(1);
            expect(newState.bases[0].minions[0].uid).toBe('m2');
            expect(newState.players['1'].discard.some(c => c.uid === 'm1')).toBe(true);
        });

        it('不消灭己方随从', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_bear_hug', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{
                    defId: 'b1', minions: [
                        makeMinion('m0', 'test', '0', 1), // 己方力量1，不应被消灭
                        makeMinion('m1', 'test', '1', 3),
                    ], ongoingActions: [],
                }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvents.length).toBe(1);
            expect((destroyEvents[0] as any).payload.minionUid).toBe('m1');
        });
    });

    describe('bear_cavalry_commission（委任：额外随从）', () => {
        it('立即创建额外随从选择交互，而不是留下可暂存额度', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'bear_cavalry_commission', 'action', '0'),
                            makeCard('m1', 'robot_microbot_guard', 'minion', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);

            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('bear_cavalry_commission_choose_minion');
        });

        it('手上没有随从时仍应给予额外随从额度（不强制创建交互）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'bear_cavalry_commission', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayAction(state, '0', 'a1');
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);

            const interactions = getLastInteractions();
            expect(interactions.length).toBe(0);
        });

        it('选择手牌 borrowed 随从打出时，应保留真实 owner', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('a1', 'bear_cavalry_commission', 'action', '0'),
                            makeCard('borrowed-minion', 'robot_microbot_guard', 'minion', '1'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const playResult = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, defaultRandom);

            expect(playResult.success).toBe(true);
            const prompt = playResult.finalState.sys.interaction?.current as any;
            expect(prompt?.data?.sourceId).toBe('bear_cavalry_commission_choose_minion');

            const borrowedOption = prompt.data.options.find((option: any) => option?.value?.cardUid === 'borrowed-minion');
            expect(borrowedOption).toBeDefined();

            const respondResult = runCommand(playResult.finalState, {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: '0',
                payload: { optionId: borrowedOption.id },
            } as any, defaultRandom);

            expect(respondResult.success).toBe(true);
            const borrowed = respondResult.finalState.core.bases[0].minions.find(m => m.uid === 'borrowed-minion');
            expect(borrowed?.controller).toBe('0');
            expect(borrowed?.owner).toBe('1');
            expect(respondResult.finalState.core.players['0'].hand.some(card => card.uid === 'borrowed-minion')).toBe(false);
        });
    });
});

// ============================================================================
// 蒸汽朋克派系
// ============================================================================

describe('蒸汽朋克派系能力', () => {
    describe('steampunk_scrap_diving（废物利用：从弃牌堆取回行动卡）', () => {
        it('多张行动卡时创建 Prompt 选择取回', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [
                            makeCard('d1', 'test_minion', 'minion', '0'),
                            makeCard('d2', 'test_action', 'action', '0'),
                            makeCard('d3', 'test_action2', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            // 多张行动卡时应创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(interactions[0].data.sourceId).toBe('steampunk_scrap_diving');
        });

        it('单张行动卡时创建 Prompt', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [
                            makeCard('d1', 'test_minion', 'minion', '0'),
                            makeCard('d2', 'test_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            // 单张行动卡时创建 Interaction
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
        });

        it('弃牌堆无行动卡时不产生事件', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [makeCard('d1', 'test_minion', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const recoverEvents = events.filter(e => e.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD);
            expect(recoverEvents.length).toBe(0);
        });

        it('单张行动卡时 Prompt 待决（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'steampunk_scrap_diving', 'action', '0')],
                        discard: [
                            makeCard('d1', 'test_action', 'action', '0'),
                        ],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            // Interaction 已创建（Prompt 待决），d1 仍在弃牌堆
            const interactions = getLastInteractions();
            expect(interactions.length).toBe(1);
            expect(newState.players['0'].discard.some(c => c.uid === 'a1')).toBe(true);
            expect(newState.players['0'].discard.some(c => c.uid === 'd1')).toBe(true);
        });
    });
});

// ============================================================================
// 食人花派系
// ============================================================================

describe('食人花派系能力', () => {
    describe('killer_plant_insta_grow（急速生长：额外随从）', () => {
        it('给予额外随从额度', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents.length).toBe(1);
            expect((limitEvents[0] as any).payload.limitType).toBe('minion');
            expect((limitEvents[0] as any).payload.delta).toBe(1);
        });

        it('off-phase 额外随从应标记为 immediate', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const matchState = makeMatchState(state);
            matchState.sys.phase = 'startTurn';

            const executor = resolveAbility('killer_plant_insta_grow', 'onPlay');
            expect(executor).toBeDefined();

            const result = executor!({
                state,
                matchState,
                playerId: '0',
                cardUid: 'a1',
                defId: 'killer_plant_insta_grow',
                baseIndex: 0,
                random: defaultRandom,
                now: 1000,
            });

            const limitEvents = result.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvents).toHaveLength(1);
            expect((limitEvents[0] as any).payload.playTiming).toBe('immediate');
        });

        it('额度正确累加（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const events = execPlayAction(state, '0', 'a1');
            const newState = applyEvents(state, events);
            expect(newState.players['0'].minionLimit).toBe(2);
        });
    });

    describe('killer_plant_weed_eater（野生食人花：打出回合-2力量）', () => {
        it('打出时获得-2力量修正', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'killer_plant_weed_eater', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const powerEvents = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);
            expect(powerEvents.length).toBe(1);
            expect((powerEvents[0] as any).payload.minionUid).toBe('m1');
            expect((powerEvents[0] as any).payload.amount).toBe(-2);
        });

        it('力量修正正确应用（reduce 验证）', () => {
            const state = makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('m1', 'killer_plant_weed_eater', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
            });

            const events = execPlayMinion(state, '0', 'm1', 0);
            const newState = applyEvents(state, events);
            const minion = newState.bases[0].minions.find(m => m.uid === 'm1');
            expect(minion).toBeDefined();
            // TEMP_POWER_ADDED amount=-2 → tempPowerModifier = -2
            expect(minion!.tempPowerModifier).toBe(-2);
        });
    });
});

// ============================================================================
// 完成仪式 (Complete the Ritual) - playConstraint: requireOwnMinion
// ============================================================================

describe('cthulhu_complete_the_ritual 打出约束', () => {
    it('目标基地有自己随从时可以打出', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })],
                ongoingActions: [],
            }],
            baseDeck: ['b2'],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1', targetBaseIndex: 0 },
        } as any);
        expect(result.success).toBe(true);
    });

    it('目标基地没有自己随从时被拒绝', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [makeMinion('m1', 'test_minion', '1', 3, { powerModifier: 0 })], // 对手的随从
                ongoingActions: [],
            }],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1', targetBaseIndex: 0 },
        } as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('随从');
    });

    it('目标基地无随从时被拒绝', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'cthulhu_complete_the_ritual', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [],
            }],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a1', targetBaseIndex: 0 },
        } as any);
        expect(result.success).toBe(false);
        expect(result.error).toContain('随从');
    });
});
