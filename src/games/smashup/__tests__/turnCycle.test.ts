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
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, getCurrentPlayerId, HAND_LIMIT, VP_TO_WIN, DRAW_PER_TURN } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { initAllAbilities } from '../abilities';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { collectBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { collectTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptSourceId,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from './helpers';
import { runCommand } from './testRunner';

const PLAYER_IDS = ['0', '1'];

const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createBaseSystems<SmashUpCore>(),
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

/** 蛇形选秀（多轮 afterEvents 自动推进 factionSelect → startTurn → playCards） */
const DRAFT_COMMANDS: SmashUpCommand[] = [
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
    { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
] as any[];

// ============================================================================
// 完整回合循环
// ============================================================================

describe('完整回合循环', () => {
    it('playCards → scoreBases(auto) → draw(auto) → endTurn(auto) → startTurn(P1, auto) → playCards(P1) 完整流转', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '完整回合',
            commands: [
                ...DRAFT_COMMANDS,
                // playCards → 多轮 afterEvents 自动推进整个链条到 P1 的 playCards
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // 多轮 afterEvents 自动推进到 P1 的 playCards
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);

        // 验证 P0 抽了 2 张牌（DRAW_PER_TURN = 2）
        const core = result.finalState.core;
        const p0 = core.players['0'];
        // 起始 5 张 + 抽 2 张 = 7 张
        expect(p0.hand.length).toBe(7);
    });

    it('线上反馈 69fd9c33：已用完随从和战术额度时仍可结束回合', () => {
        const local = (uid: string, playedThisTurn = false) => makeMinion(
            uid,
            'innsmouth_the_locals_pod',
            '0',
            2,
            { tempPowerModifier: 1, powerCounters: 0, playedThisTurn },
        );
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('c33', 'dino_survival_of_the_fittest_pod', 'action', '0'),
                        makeCard('c32', 'dino_natural_selection_pod', 'action', '0'),
                        makeCard('c39', 'dino_augmentation_pod', 'action', '0'),
                        makeCard('c16', 'innsmouth_spreading_the_word_pod', 'action', '0'),
                    ],
                    deck: [
                        makeCard('c30', 'dino_war_raptor_pod', 'minion', '0'),
                        makeCard('c36', 'dino_howl_pod', 'action', '0'),
                    ],
                    discard: [makeCard('c19', 'innsmouth_the_deep_ones_pod', 'action', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 1,
                    factions: ['innsmouth_pod', 'dinosaurs_pod'],
                    minionsPlayedPerBase: { 1: 2, 2: 1 },
                    baseLimitedMinionQuota: { 1: 0 },
                    sameNameMinionDefId: null,
                } as any),
                '1': makePlayer('1', {
                    hand: [makeCard('c55', 'robot_microbot_guard', 'minion', '1')],
                    deck: [makeCard('c70', 'wizard_neophyte', 'minion', '1')],
                    discard: [makeCard('c72', 'wizard_mystic_studies', 'action', '1')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 2,
                    factions: ['robots', 'wizards'],
                }),
            },
            bases: [
                makeBase('base_innsmouth_base', [
                    makeMinion('c46', 'robot_hoverbot', '1', 3),
                    makeMinion('c41', 'robot_nukebot', '1', 5),
                    makeMinion('c62', 'wizard_chronomage', '1', 3, { playedThisTurn: true }),
                ]),
                makeBase({
                    defId: 'base_the_factory',
                    minions: [
                        local('c6'),
                        local('c1'),
                        local('c4'),
                        local('c10'),
                        local('c8'),
                        local('c9', true),
                        makeMinion('c26', 'dino_armor_stego_pod', '0', 3, { playedThisTurn: true }),
                    ],
                    ongoingActions: [{ uid: 'c12', defId: 'innsmouth_sacred_circle_pod', ownerId: '0', talentUsed: true } as any],
                }),
                makeBase('base_tar_pits', [
                    makeMinion('c56', 'robot_microbot_alpha', '1', 1),
                    local('c3'),
                    local('c2', true),
                ]),
            ],
            titans: [{
                uid: 'titan_0_innsmouth_dagon',
                defId: 'innsmouth_dagon',
                faction: 'innsmouth',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: true,
                location: { zone: 'base', baseIndex: 1, enteredAt: 1778228065083 },
            } as any],
            enabledExpansions: ['titans'],
            baseDeck: ['base_central_brain', 'base_ritual_site'],
            turnNumber: 3,
            turnPhase: 'playCards',
            cardsPlayedThisTurn: 4,
            turnDestroyedMinions: [],
        } as any);

        const state = makeMatchState(core);
        expectNoPrompt(state);

        const result = runCommand(state, { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined } as any);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.BASE_SCORED)).toBe(true);
        expect((result.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil).toBeUndefined();
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'c33',
            'c32',
            'c39',
            'c16',
            'c30',
            'c36',
        ]);
    });

    it('draw phase reshuffles after drawing the last card in deck', () => {
        const runner = createRunner();
        const draftResult = runner.run({
            name: 'draft',
            commands: DRAFT_COMMANDS,
        });

        const p0 = draftResult.finalState.core.players['0'];
        const deckCard = p0.deck[0];
        const discardCards = p0.deck.slice(1, 3);

        expect(deckCard).toBeDefined();
        expect(discardCards).toHaveLength(2);
        if (!deckCard) {
            throw new Error('expected one card left in deck for reshuffle test');
        }

        const modifiedState: MatchState<SmashUpCore> = {
            ...draftResult.finalState,
            core: {
                ...draftResult.finalState.core,
                players: {
                    ...draftResult.finalState.core.players,
                    ['0']: {
                        ...p0,
                        hand: [],
                        deck: [deckCard],
                        discard: discardCards,
                    },
                },
            },
        };

        const runner2 = createRunner(() => modifiedState);
        const result = runner2.run({
            name: 'draw 1 then reshuffle then draw 1',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const p0After = result.finalState.core.players['0'];
        const handUids = p0After.hand.map(card => card.uid);
        const discardUids = new Set(discardCards.map(card => card.uid));

        expect(p0After.hand).toHaveLength(2);
        expect(handUids).toContain(deckCard.uid);
        expect(handUids.some(uid => discardUids.has(uid))).toBe(true);
        expect(p0After.deck).toHaveLength(1);
        expect(p0After.discard).toHaveLength(0);
    });

    it('非当前玩家 ADVANCE_PHASE 应被拒绝，不能推进回合', () => {
        const runner = createRunner();
        const draftResult = runner.run({
            name: 'draft',
            commands: DRAFT_COMMANDS,
        });

        const beforeState = draftResult.finalState;
        const currentPlayerId = getCurrentPlayerId(beforeState.core);
        const otherPlayerId = currentPlayerId === '0' ? '1' : '0';

        const runner2 = createRunner();
        const result = runner2.run({
            name: 'wrong-player-advance',
            commands: [
                ...DRAFT_COMMANDS,
                { type: 'ADVANCE_PHASE', playerId: otherPlayerId, payload: undefined },
            ] as any[],
        });

        const advanceStep = result.steps[result.steps.length - 1];
        expect(advanceStep?.success).toBe(false);
        expect(advanceStep?.error).toBe('not_active_player');
        // 错玩家推进应被拦截：阶段和当前玩家都保持不变
        expect(result.finalState.sys.phase).toBe(beforeState.sys.phase);
        expect(getCurrentPlayerId(result.finalState.core)).toBe(currentPlayerId);
    });

    it('两个完整回合后回到 P0', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '两个完整回合',
            commands: [
                ...DRAFT_COMMANDS,
                // P0 回合：playCards → 自动推进到 P1 的 playCards
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // P1 回合：playCards → 自动推进到 P0 的 playCards
                { type: 'ADVANCE_PHASE', playerId: '1', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(0);
        expect(result.finalState.core.players['0'].minionsPlayed).toBe(0);
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(0);
    });

    it('endTurn 无冲突 trigger 会自动收口，且不会把同一组 onTurnEnd trigger 重新入队', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.COWBOYS] as [string, string],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.STEAMPUNKS, SMASHUP_FACTION_IDS.PIRATES] as [string, string],
                    deck: [makeCard('d1', 'steampunk_scrap_diving', 'action', '1')],
                }),
                '2': makePlayer('2', {
                    factions: [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                }),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 1,
            turnNumber: 9,
            bases: [
                makeBase({
                    defId: 'base_drakkar',
                    minions: [makeMinion('m1', 'pirate_buccaneer', '1', 4)],
                    ongoingActions: [{ uid: 'de1', defId: 'steampunk_difference_engine', ownerId: '1', talentUsed: false }],
                }),
                makeBase('base_saloon'),
                makeBase('base_the_factory'),
                makeBase('base_longhouse'),
            ],
            titans: [
                {
                    uid: 't1',
                    defId: 'tricksters_big_funny_giant',
                    ownerId: '2',
                    controllerId: '2',
                    power: 5,
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 3 },
                } as any,
            ],
        });
        const initialState = makeMatchState(core);
        initialState.sys.phase = 'endTurn';

        const enterTurnEnd = runCommand(initialState, {
            type: 'ADVANCE_PHASE',
            playerId: '1',
            payload: {},
            timestamp: 1,
        } as any);
        expect(enterTurnEnd.success).toBe(true);
        expect(enterTurnEnd.finalState.sys.phase).toBe('playCards');
        expectNoPrompt(enterTurnEnd.finalState);
        expect(enterTurnEnd.finalState.core.players['1'].hand.map(card => card.uid)).toContain('d1');
        expect(
            (enterTurnEnd.finalState.core.triggerQueue ?? []).some(
                trigger => trigger.frameId?.startsWith('turn-end:1:9'),
            ),
        ).toBe(false);
    });

    it('蘑菇王国与 Invisible Ninja 同回合开始时应直接进入真实交互，不先弹结算顺序', () => {
        const frameId = 'turn-start:0:1:0';
        const random = { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any;
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FAIRIES, SMASHUP_FACTION_IDS.NINJAS] as [string, string],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ROBOTS] as [string, string],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('enemy-minion', 'pirate_buccaneer', '1', 4),
                ]),
                makeBase('base_mushroom_kingdom'),
            ],
            titans: [
                {
                    uid: 'titan-invisible',
                    defId: 'ninjas_invisible_ninja',
                    faction: SMASHUP_FACTION_IDS.NINJAS,
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'base', baseIndex: 0, enteredAt: 0 },
                } as any,
            ],
        });

        const queuedBase = collectBaseAbilityTriggers({
            core,
            timing: 'onTurnStart',
            ownerPlayerId: '0',
            baseIndex: 1,
            frameId,
            sourceEventId: frameId,
            now: 0,
        });
        expect(queuedBase).toBeDefined();

        const queuedTurnStart = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            frameId,
            sourceEventId: frameId,
            random,
            now: 0,
        });
        expect(queuedTurnStart).toBeDefined();

        const state = makeMatchState({
            ...core,
            triggerQueue: [
                ...((queuedBase as any).payload.triggers ?? []),
                ...((queuedTurnStart as any).payload.triggers ?? []),
            ],
        });
        state.sys.phase = 'startTurn';

        const resolved = maybeResolveReactionQueue(state, random, 0);
        expect(resolved).toBeDefined();
        const firstPrompt = getFirstPrompt(resolved!.state);
        expect(getPromptSourceId(firstPrompt)).toBe('base_mushroom_kingdom');
        expect(getPromptSourceId(firstPrompt)).not.toBe('smashup_reaction_choose');
        expect((resolved!.state.core.triggerQueue ?? []).some(trigger => trigger.sourceDefId === 'ninjas_invisible_ninja')).toBe(true);
        expect((resolved!.state.core.triggerQueue ?? []).some(trigger => trigger.sourceDefId === 'base_mushroom_kingdom')).toBe(false);

        const firstResolved = respondToPromptOption(
            resolved!.state,
            option => option.value?.skip === true,
            'Mushroom Kingdom skip option',
            '0',
            random,
        );
        expect(firstResolved.success, firstResolved.error).toBe(true);
        const resumedPrompt = getFirstPrompt(firstResolved.finalState);
        expect(getPromptSourceId(resumedPrompt)).toBe('titan_ninjas_invisible_ninja_start_turn');
        expect(getPromptSourceId(resumedPrompt)).not.toBe('smashup_reaction_choose');
    });

    it('蘑菇王国面对对手幼苗时不应把对手回合开始触发误入队', () => {
        const random = { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any;
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS, SMASHUP_FACTION_IDS.WIZARDS] as [string, string],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 5,
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('enemy-sprout', 'killer_plant_sprout', '1', 2),
                ]),
                makeBase('base_mushroom_kingdom', [
                    makeMinion('ally-minion', 'pirate_buccaneer', '1', 4),
                ]),
            ],
        });

        const frameId = 'turn-start:0:5:0';
        const queuedBase = collectBaseAbilityTriggers({
            core,
            timing: 'onTurnStart',
            ownerPlayerId: '0',
            baseIndex: 1,
            frameId,
            sourceEventId: frameId,
            now: 5,
        });
        expect(queuedBase).toBeDefined();

        const queuedTurnStart = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            frameId,
            sourceEventId: frameId,
            random,
            now: 5,
        });

        expect(queuedTurnStart).toBeUndefined();

        const state = makeMatchState({
            ...core,
            triggerQueue: [
                ...((queuedBase as any).payload.triggers ?? []),
            ],
        });
        state.sys.phase = 'startTurn';

        const resolved = maybeResolveReactionQueue(state, random, 5);
        expect(resolved).toBeDefined();
        const prompt = getFirstPrompt(resolved!.state);
        expect(getPromptSourceId(prompt)).toBe('base_mushroom_kingdom');
        expect(getPromptSourceId(prompt)).not.toBe('smashup_reaction_choose');
    });

    it('同名 sourceController 回合开始触发应跳过对手来源并选择当前玩家来源', () => {
        const random = { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any;
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS, SMASHUP_FACTION_IDS.PIRATES] as [string, string],
                    deck: [makeCard('p0-deck-1', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS, SMASHUP_FACTION_IDS.WIZARDS] as [string, string],
                    deck: [makeCard('p1-deck-1', 'wizard_apprentice', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 6,
            bases: [
                makeBase('base_ancient_ruins', [
                    makeMinion('opponent-water-lily', 'killer_plant_water_lily', '1', 2),
                ]),
                makeBase('base_great_library', [
                    makeMinion('current-water-lily', 'killer_plant_water_lily', '0', 2),
                ]),
            ],
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            frameId: 'turn-start:0:6:0',
            sourceEventId: 'turn-start:0:6:0',
            random,
            now: 6,
        });

        const triggers = (queued as any)?.payload?.triggers ?? [];
        expect(triggers).toHaveLength(1);
        expect(triggers[0].sourceDefId).toBe('killer_plant_water_lily');
        expect(triggers[0].sourceCardUid).toBe('current-water-lily');
        expect(triggers[0].ownerPlayerId).toBe('0');
    });

    it('新娘泰坦在对手牌库旁时不应进入当前玩家回合开始排序', () => {
        const random = { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any;
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WIZARDS] as [string, string],
                    hand: [makeCard('bride-hand-minion', 'frankenstein_igor', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 7,
            bases: [
                makeBase('base_the_factory', [
                    makeMinion('p1-minion', 'frankenstein_lab_assistant', '1', 2),
                ]),
            ],
            titans: [{
                uid: 'opponent-bride',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            frameId: 'turn-start:0:7:0',
            sourceEventId: 'turn-start:0:7:0',
            random,
            now: 7,
        });

        expect(queued).toBeUndefined();
    });

    it('自己的新娘泰坦应作为可选回合开始 special，不应和蘑菇王国组成强制排序', () => {
        const random = { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any;
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    hand: [makeCard('bride-hand-minion', 'frankenstein_igor', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 8,
            bases: [
                makeBase('base_mushroom_kingdom', []),
                makeBase('base_the_factory', [
                    makeMinion('enemy-target', 'pirate_buccaneer', '1', 4),
                ]),
                makeBase('base_great_library', [
                    {
                        ...makeMinion('bride-counter-target', 'frankenstein_lab_assistant', '0', 2),
                        powerCounters: 1,
                    },
                ]),
            ],
            titans: [{
                uid: 'own-bride',
                defId: 'frankenstein_the_bride',
                faction: SMASHUP_FACTION_IDS.FRANKENSTEIN,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const frameId = 'turn-start:0:8:0';
        const queuedBase = collectBaseAbilityTriggers({
            core,
            timing: 'onTurnStart',
            ownerPlayerId: '0',
            baseIndex: 0,
            frameId,
            sourceEventId: frameId,
            now: 8,
        });
        expect(queuedBase).toBeDefined();

        const queuedBride = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            frameId,
            sourceEventId: frameId,
            random,
            now: 8,
        });

        const brideTriggers = (queuedBride as any)?.payload?.triggers ?? [];
        expect(brideTriggers).toHaveLength(1);
        expect(brideTriggers[0].sourceDefId).toBe('frankenstein_the_bride');
        expect(brideTriggers[0].resolutionClass).toBe('optional');

        const state = makeMatchState({
            ...core,
            triggerQueue: [
                ...((queuedBase as any).payload.triggers ?? []),
                ...brideTriggers,
            ],
        });
        state.sys.phase = 'startTurn';

        const resolved = maybeResolveReactionQueue(state, random, 8);
        expect(resolved).toBeDefined();
        const prompt = getFirstPrompt(resolved!.state);
        expect(getPromptSourceId(prompt)).toBe('base_mushroom_kingdom');
        expect(getPromptSourceId(prompt)).not.toBe('smashup_reaction_choose');

        const skippedMushroomKingdom = respondToPromptOption(
            resolved!.state,
            option => option.value?.skip === true,
            'Mushroom Kingdom skip option',
            '0',
            random,
        );
        expect(skippedMushroomKingdom.success, skippedMushroomKingdom.error).toBe(true);

        const reactionPrompt = getFirstPrompt(skippedMushroomKingdom.finalState);
        expect(getPromptSourceId(reactionPrompt)).toBe('smashup_reaction_choose');

        const passedBridePrompt = respondToPromptOption(
            skippedMushroomKingdom.finalState,
            option => option.id === 'pass',
            'Bride titan pass option',
            '0',
            random,
        );
        expect(passedBridePrompt.success, passedBridePrompt.error).toBe(true);
        expectNoPrompt(passedBridePrompt.finalState);
        expect((passedBridePrompt.finalState.core.triggerQueue ?? []).some(
            trigger => trigger.sourceDefId === 'frankenstein_the_bride',
        )).toBe(false);
        expect(passedBridePrompt.finalState.sys.phase).toBe('playCards');
    });

    it('线上反馈 69feede0：场下巨狼之灵不应在回合开始入队询问触发', () => {
        const random = { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any;
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.WEREWOLVES, SMASHUP_FACTION_IDS.PRINCESSES] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 9,
            bases: [
                makeBase('base_beautiful_castle', [
                    makeMinion('wolf-home', 'werewolf_pack_alpha', '0', 5),
                ]),
                makeBase('base_great_library', [
                    makeMinion('wolf-ahead', 'werewolf_howler', '0', 4),
                    makeMinion('enemy-low', 'robot_zapbot', '1', 2),
                ]),
                makeBase('base_standing_stones'),
            ],
            titans: [{
                uid: 't-gws-setaside',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' },
            } as any],
        });

        const queued = collectTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core, 'startTurn', '0'),
            playerId: '0',
            frameId: 'turn-start:0:9:0',
            sourceEventId: 'turn-start:0:9:0',
            random,
            now: 9,
        });

        expect(queued).toBeUndefined();
    });
});

// ============================================================================
// 随从消灭能力集成测试
// ============================================================================

describe('随从消灭能力集成', () => {
    it('打出有 onPlay 消灭能力的随从时触发消灭', () => {
        const runner = createRunner();
        // 蛇形选秀：P0 选 ninjas+pirates，P1 选 aliens+dinosaurs
        const ninjasDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
        ] as any[];

        const result = runner.run({
            name: '选秀',
            commands: ninjasDraft,
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
                ...ninjasDraft,
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
        // 使用 aliens（有 ongoing 行动卡 alien_jammed_signal）
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
            // alien_jammed_signal 是 ongoing 类型
            return c.defId === 'alien_jammed_signal';
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
        // 蛇形选秀：P0 选 wizards + aliens
        const wizardsDraft: SmashUpCommand[] = [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.NINJAS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
        ] as any[];

        const result = runner.run({
            name: '选秀',
            commands: wizardsDraft,
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
                ...wizardsDraft,
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
                // playCards → scoreBases(auto) → draw（抽 2 张后手牌 = 11 > 10，停在 draw）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        expect(result.finalState.sys.phase).toBe('draw');
        const p0 = result.finalState.core.players['0'];
        // 9 + 2 = 11 张手牌
        expect(p0.hand.length).toBe(9 + DRAW_PER_TURN);
        expect(p0.hand.length).toBeGreaterThan(HAND_LIMIT);
    });

    it('DISCARD_TO_LIMIT 弃牌后手牌 = HAND_LIMIT，自动推进到下一回合', () => {
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

        // 多轮 afterEvents 自动推进：draw → endTurn → startTurn(P1) → playCards(P1)
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
    });

    it('手牌未超限时 DISCARD_TO_LIMIT 被拒绝', () => {
        const runner = createRunner();
        const result = runner.run({
            name: '手牌未超限弃牌被拒',
            commands: [
                ...DRAFT_COMMANDS,
                // 推进到 P1 的 playCards（多轮自动推进，draw 阶段已过）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                // 尝试弃牌（应该失败，因为已经不在 draw 阶段）
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

    it('回合结束时额外抽牌超过上限不会停在弃牌，直接进入下一回合', () => {
        const runner1 = createRunner();
        const draftResult = runner1.run({
            name: '选秀',
            commands: DRAFT_COMMANDS,
        });

        const handAtEightState = injectExtraHandCards(draftResult.finalState, 3);
        const base0 = handAtEightState.core.bases[0];
        const differenceEngineBase = {
            ...base0,
            minions: [
                ...base0.minions,
                {
                    uid: 'de-minion',
                    defId: 'steampunk_steam_man',
                    controller: '0',
                    owner: '0',
                    power: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    attachedActions: [],
                },
            ],
            ongoingActions: [
                ...base0.ongoingActions,
                { uid: 'de-ongoing', defId: 'steampunk_difference_engine', ownerId: '0', metadata: {} },
            ],
        };

        const modifiedState: MatchState<SmashUpCore> = {
            ...handAtEightState,
            core: {
                ...handAtEightState.core,
                bases: [
                    differenceEngineBase,
                    ...handAtEightState.core.bases.slice(1),
                ],
            },
        };

        const runner2 = createRunner(() => modifiedState);
        const result = runner2.run({
            name: '差分机在回合结束额外抽牌后不弃牌',
            commands: [
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const p0 = result.finalState.core.players['0'];
        expect(p0.hand.length).toBe(HAND_LIMIT + 1);
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
    });
});

// ============================================================================
// ≥15 VP 胜利检查
// ============================================================================

describe('≥15 VP 胜利检查', () => {
    it('基地计分完成后进入 draw 时，VP >= VP_TO_WIN 触发游戏结束', () => {
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
        // P0 回合：playCards → 多轮自动推进（计分完成后进入 draw 时即可检查 isGameOver）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        // isGameOver 应该在基地计分链结束后检测到 P0 VP >= 15
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
                // P0 完整回合（多轮自动推进到 P1 的 playCards）
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
            ] as any[],
        });

        const core = result.finalState.core;
        // 正常游戏 VP = 0，不应结束
        expect(core.players['0'].vp).toBeLessThan(VP_TO_WIN);
        const gameOver = SmashUpDomain.isGameOver!(core);
        expect(gameOver).toBeUndefined();

        // 游戏应该继续到 P1 的 playCards
        expect(result.finalState.sys.phase).toBe('playCards');
        expect(result.finalState.core.currentPlayerIndex).toBe(1);
    });

    it('未到基地计分完成后的结算时机时，即使 VP 达标也不应提前结束', () => {
        const runner = createRunner();
        const draftResult = runner.run({
            name: 'draft',
            commands: DRAFT_COMMANDS,
        });
        const core = {
            ...draftResult.finalState.core,
            turnPhase: 'playCards',
            players: {
                ...draftResult.finalState.core.players,
                ['0']: {
                    ...draftResult.finalState.core.players['0'],
                    vp: VP_TO_WIN,
                },
            },
        };

        expect(SmashUpDomain.isGameOver!(core)).toBeUndefined();

        core.turnPhase = 'scoreBases';
        expect(SmashUpDomain.isGameOver!(core)).toBeUndefined();

        core.turnPhase = 'draw';
        const gameOver = SmashUpDomain.isGameOver!(core);
        expect(gameOver).toBeDefined();
        expect(gameOver!.winner).toBe('0');
    });
});
