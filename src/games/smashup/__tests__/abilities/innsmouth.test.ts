import { beforeAll, describe, expect, test } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { grantExtraMinion } from '../../domain/abilityHelpers';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { validate } from '../../domain/commands';
import { clearOngoingEffectRegistry, collectTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { reduce } from '../../domain/reducer';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../../domain/scoringSession';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import type { BaseInPlay, CardInstance, FactionId, MinionOnBase, PlayerState, SmashUpCore, SmashUpEvent } from '../../domain/types';
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeMatchState,
    makePlayer,
    respondToPromptOption,
    respondToPromptOptions,
    withOnlyCurrentPrompt,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
        ...overrides,
    };
}

function makeBase(overrides: Partial<BaseInPlay> = {}): BaseInPlay {
    return {
        defId: 'test_base',
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

type TestCardInstance = CardInstance & { faction: FactionId };

function makeCard(
    uid: string,
    defId: string,
    type: 'minion' | 'action',
    owner: string,
    faction: FactionId,
): TestCardInstance {
    return { uid, defId, type, owner, faction };
}

function makeState(bases: BaseInPlay[], overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [
                    makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('h2', 'test_action_a', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                ],
                deck: [
                    makeCard('d1', 'deck_minion_1', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('d2', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('d3', 'deck_minion_2', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                ],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [
                    makeCard('oh1', 'opp_card_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh2', 'opp_card_2', 'action', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                deck: [makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS)],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 300,
        ...overrides,
    };
}

const dummyRandom = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]): T[] => [...arr],
} as any;

function makeInnsmouthActionMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: owner ?? controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

function makeInnsmouthActionCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makeInnsmouthActionPlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeInnsmouthActionState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makeInnsmouthActionPlayer('0'), '1': makeInnsmouthActionPlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function execInnsmouthActionPlay(state: SmashUpCore, playerId: string, cardUid: string) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function applyInnsmouthActionEvents(state: SmashUpCore, events: SmashUpEvent[]) {
    return events.reduce((core, event) => reduce(core, event as any), state);
}

function attachAfterScoringWindow(core: SmashUpCore, sourceBaseIndex = 0, activePlayerId = '0') {
    const initialState = makeMatchState(core);
    const baseRef = createScoringBaseRef(initialState.core, sourceBaseIndex);
    if (!baseRef) {
        throw new Error(`无法构造 afterScoring 测试用 scoring base ref: ${sourceBaseIndex}`);
    }
    const scoringState = setScoringSession(initialState as any, {
        ...createScoringSession(initialState.core, [sourceBaseIndex]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    const nextState = startSmashUpReactionSession(scoringState, {
        frameId: `score-after:${sourceBaseIndex}:test`,
        frameKind: 'score-after',
        phase: 'optional',
        activePlayerId,
        currentPlayerId: activePlayerId,
        consecutivePasses: 0,
        responseWindowType: 'afterScoring',
    });
    return {
        core: nextState.core,
        sys: nextState.sys,
    } as any;
}

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('印斯茅斯 ongoing 能力', () => {

    describe('innsmouth_in_plain_sight: 众目睽睽', () => {
        test('力量≤2的己方随从不受对手影响', () => {
            const weakMinion = makeMinion({ defId: 'inn_a', uid: 'ia-1', controller: '0', basePower: 2 });
            const base = makeBase({
                minions: [weakMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, weakMinion, 0, '1', 'affect')).toBe(true);
        });

        test('POD 版 in_plain_sight 也会保护力量≤2的己方随从', () => {
            const weakMinion = makeMinion({ defId: 'inn_a', uid: 'ia-pod-1', controller: '0', basePower: 2 });
            const base = makeBase({
                minions: [weakMinion],
                ongoingActions: [{ uid: 'ips-pod-1', defId: 'innsmouth_in_plain_sight_pod', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, weakMinion, 0, '1', 'affect')).toBe(true);
        });

        test('力量>2的随从不受保护', () => {
            const strongMinion = makeMinion({ defId: 'inn_b', uid: 'ib-1', controller: '0', basePower: 4 });
            const base = makeBase({
                minions: [strongMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, strongMinion, 0, '1', 'affect')).toBe(false);
        });

        test('对手随从不受保护', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', basePower: 1 });
            const base = makeBase({
                minions: [oppMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, oppMinion, 0, '0', 'affect')).toBe(false);
        });

        test('borrowed in_plain_sight 应按控制者而不是真实 owner 保护控制者的低力量随从不受其他玩家影响', () => {
            const weakMinion = makeMinion({ defId: 'inn-borrowed-a', uid: 'iba-1', controller: '0', owner: '0', basePower: 2 });
            const base = makeBase({
                minions: [weakMinion],
                ongoingActions: [{
                    uid: 'ips-borrowed-1',
                    defId: 'innsmouth_in_plain_sight',
                    ownerId: '1',
                    metadata: {
                        sourcePlayerId: '0',
                        sourceControllerId: '0',
                    },
                }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, weakMinion, 0, '1', 'affect')).toBe(true);
            expect(isMinionProtected(state, weakMinion, 0, '0', 'affect')).toBe(false);
        });

        test('同一基地上若同时有两张不同控制者的 in_plain_sight，不应因第一张同名来源而放行对手影响', () => {
            const controllerWeakMinion = makeMinion({
                defId: 'inn-controller-weak',
                uid: 'ips-controller-weak',
                controller: '0',
                owner: '0',
                basePower: 2,
            });
            const ownerWeakMinion = makeMinion({
                defId: 'inn-owner-weak',
                uid: 'ips-owner-weak',
                controller: '1',
                owner: '1',
                basePower: 2,
            });
            const base = makeBase({
                minions: [controllerWeakMinion, ownerWeakMinion],
                ongoingActions: [
                    { uid: 'ips-owner', defId: 'innsmouth_in_plain_sight', ownerId: '1' },
                    {
                        uid: 'ips-borrowed',
                        defId: 'innsmouth_in_plain_sight',
                        ownerId: '1',
                        metadata: {
                            sourcePlayerId: '0',
                            sourceControllerId: '0',
                        },
                    },
                ],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, controllerWeakMinion, 0, '1', 'affect')).toBe(true);
            expect(isMinionProtected(state, controllerWeakMinion, 0, '0', 'affect')).toBe(false);
            expect(isMinionProtected(state, ownerWeakMinion, 0, '0', 'affect')).toBe(true);
            expect(isMinionProtected(state, ownerWeakMinion, 0, '1', 'affect')).toBe(false);
        });
    });

    describe('innsmouth_return_to_the_sea: 回归大海', () => {
        test('交互响应会保留原基地索引，且目标失效时不再重复回手', () => {
            const triggerMinion = makeMinion({
                uid: 'inn-1',
                defId: 'innsmouth_the_locals',
                controller: '0',
                owner: '0',
            });
            const sameNameMinion = makeMinion({
                uid: 'inn-2',
                defId: 'innsmouth_the_locals',
                controller: '0',
                owner: '0',
            });
            const otherMinion = makeMinion({
                uid: 'other-1',
                defId: 'wizard_neophyte',
                controller: '1',
                owner: '1',
            });
            const state = makeState([makeBase({
                defId: 'base_the_mothership',
                minions: [triggerMinion, sameNameMinion, otherMinion],
            })], {
                scoringEligibleBaseIndices: [0],
                players: {
                    ...makeState([makeBase()]).players,
                    '0': {
                        ...makeState([makeBase()]).players['0'],
                        hand: [makeCard('sea-1', 'innsmouth_return_to_the_sea', 'action', '0', SMASHUP_FACTION_IDS.INNSMOUTH)],
                        discard: [],
                    },
                    '1': {
                        ...makeState([makeBase()]).players['1'],
                        hand: [],
                    },
                },
            });
            const ms = attachAfterScoringWindow(state, 0, '0');
            const result = runCommand(ms, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'sea-1', targetBaseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const interaction = getSimpleChoicePrompt(result.finalState, 'innsmouth_return_to_the_sea');
            expect(getPromptSourceId(interaction)).toBe('innsmouth_return_to_the_sea');
            const firstOption = getPromptOption(
                interaction,
                (entry: any) => entry.value?.minionUid === 'inn-1',
                'Return to the Sea self-return option',
            );
            expect(firstOption?.value?.baseIndex).toBe(0);

            const liveResult = respondToPromptOptions(result.finalState, [firstOption.id], '0', dummyRandom);
            expect(liveResult.success, liveResult.error).toBe(true);
            const liveEvents = liveResult.events;
            const returnedEvents = liveEvents.filter(event => event.type === SU_EVENTS.MINION_RETURNED);
            expect(returnedEvents).toHaveLength(1);
            expect((returnedEvents[0] as any).payload.fromBaseIndex).toBe(0);

            const staleState = makeState([makeBase({ minions: [otherMinion] })], {
                players: {
                    ...state.players,
                    '0': {
                        ...state.players['0'],
                        discard: [
                            ...state.players['0'].discard,
                            makeCard('inn-1', 'innsmouth_the_locals', 'minion', '0', SMASHUP_FACTION_IDS.INNSMOUTH),
                        ],
                    },
                },
            });
            const staleMs = attachAfterScoringWindow(staleState, 0, '0');
            const staleResult = respondToPromptOptions(
                withOnlyCurrentPrompt(staleMs, interaction),
                [firstOption.id],
                '0',
                dummyRandom,
            );
            expect(staleResult.success, staleResult.error).toBe(true);
            expect(staleResult.events).toHaveLength(0);
        });

        test('innsmouth_return_to_the_sea 在对手计分后仍应把 queued afterScoring 选择权交给 special 拥有者', () => {
            const seaMinion = makeMinion({
                uid: 'sea-minion-1',
                defId: 'innsmouth_the_locals',
                controller: '1',
                owner: '1',
            });
            const core = makeState([
                makeBase({
                    defId: 'base_the_mothership',
                    minions: [seaMinion],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_the_factory',
                    minions: [],
                    ongoingActions: [],
                }),
            ], {
                players: {
                    '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                    '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
                },
                pendingAfterScoringSpecials: [{
                    sourceDefId: 'innsmouth_return_to_the_sea',
                    playerId: '1',
                    baseIndex: 0,
                    cardUid: 'sea-armed-1',
                }],
            });

            const queued = collectTriggers(core, 'afterScoring', {
                state: core,
                matchState: makeMatchState(core),
                playerId: '0',
                baseIndex: 0,
                rankings: [{ playerId: '0', power: 10, vp: 1 }],
                random: defaultTestRandom,
                now: 4301,
            });

            expect(queued).toBeDefined();
            const seaTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'sea-armed-1');
            expect(seaTrigger).toBeDefined();
            expect(seaTrigger.ownerPlayerId).toBe('1');

            const queuedState = maybeResolveReactionQueue(
                makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
                defaultTestRandom,
                4301,
            );
            expect(queuedState).toBeDefined();
            expect(getSimpleChoicePrompt(queuedState!.state, 'innsmouth_return_to_the_sea')?.playerId).toBe('1');
        });
    });

    describe('innsmouth_sacred_circle（宗教圆环 ongoing talent）', () => {
        test('基地有随从且手牌有同名随从时给额外随从额度', () => {
            const core = makeState([
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion({ uid: 'm1', defId: 'innsmouth_deep_one', controller: '0', owner: '0', basePower: 2 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'innsmouth_sacred_circle', ownerId: '0', talentUsed: false } as any],
                }),
            ], {
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'innsmouth_deep_one', 'minion', '0', SMASHUP_FACTION_IDS.INNSMOUTH)],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const result = runCommand(makeMatchState(core), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);
            const eventTypes = result.events.map(event => event.type);
            expect(eventTypes).toContain(SU_EVENTS.TALENT_USED);
            expect(eventTypes).toContain(SU_EVENTS.LIMIT_MODIFIED);

            const limitEvt = result.events.find(event => event.type === SU_EVENTS.LIMIT_MODIFIED) as any;
            expect(limitEvt.payload.sameNameOnly).toBe(true);
            expect(limitEvt.payload.restrictToBase).toBe(0);
        });

        test('手牌无同名随从时公开命令入口直接拒绝', () => {
            const core = makeState([
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion({ uid: 'm1', defId: 'innsmouth_deep_one', controller: '0', owner: '0', basePower: 2 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'innsmouth_sacred_circle', ownerId: '0', talentUsed: false } as any],
                }),
            ], {
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'pirate_first_mate', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const result = runCommand(makeMatchState(core), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success).toBe(false);
            expect(result.error).toContain('当前没有可选择的目标');
        });

        test('只有宗教圆环额度时，非同名随从不能使用该基地限定额度', () => {
            const core = makeState([
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion({ uid: 'm1', defId: 'innsmouth_deep_one', controller: '0', owner: '0', basePower: 2 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'innsmouth_sacred_circle', ownerId: '0', talentUsed: false } as any],
                }),
            ], {
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'pirate_first_mate', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        minionsPlayed: 1,
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
            });

            const granted = [grantExtraMinion('0', 'innsmouth_sacred_circle', 1, 0, { sameNameOnly: true })].reduce(reduce, core);
            const validation = validate(makeMatchState(granted), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'h1', baseIndex: 0 },
            } as any);

            expect(validation.valid).toBe(false);
            expect(validation.error).toContain('同名');
        });

        test('宗教圆环额度被消费后，不应继续把后续大衮额度误判成同名限定', () => {
            const core = makeState([
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion({ uid: 'm1', defId: 'innsmouth_the_locals', controller: '0', owner: '0', basePower: 2 })],
                    ongoingActions: [{ uid: 'oa1', defId: 'innsmouth_sacred_circle', ownerId: '0', talentUsed: false } as any],
                }),
            ], {
                players: {
                    '0': makePlayer('0', {
                        hand: [
                            makeCard('h-locals', 'innsmouth_the_locals', 'minion', '0', SMASHUP_FACTION_IDS.INNSMOUTH),
                            makeCard('h-zap', 'robot_zapbot_pod', 'minion', '0', SMASHUP_FACTION_IDS.ROBOTS),
                        ],
                        minionsPlayed: 0,
                        minionLimit: 1,
                        factions: ['innsmouth_pod', 'robots_pod'] as [string, string],
                    }),
                    '1': makePlayer('1'),
                },
            });

            const afterSacredCircleGrant = [grantExtraMinion('0', 'innsmouth_sacred_circle', 1, 0, { sameNameOnly: true })].reduce(reduce, core);
            const afterSacredCirclePlay = reduce(afterSacredCircleGrant, {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: '0',
                    cardUid: 'h-locals',
                    defId: 'innsmouth_the_locals',
                    baseIndex: 0,
                    power: 2,
                    consumesNormalLimit: true,
                },
                timestamp: 2,
            } as any);

            expect(afterSacredCirclePlay.players['0'].baseLimitedSameNameRequired?.[0]).toBeUndefined();

            const afterDagonGrant = [grantExtraMinion('0', 'innsmouth_dagon', 3, 0)].reduce(reduce, afterSacredCirclePlay);
            const validation = validate(makeMatchState(afterDagonGrant), {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'h-zap', baseIndex: 0 },
            } as any);

            expect(afterDagonGrant.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
            expect(validation.valid).toBe(true);
        });
    });
});

describe('印斯茅斯疯狂卡行动', () => {
    describe('innsmouth_spreading_the_word（散播谣言）', () => {
        test('只有一个匹配随从名时仍应等待玩家确认', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [
                            makeInnsmouthActionCard('a1', 'innsmouth_spreading_the_word', 'action', '0'),
                            makeInnsmouthActionCard('h1', 'innsmouth_the_locals', 'minion', '0'),
                            makeInnsmouthActionCard('h2', 'innsmouth_the_locals', 'minion', '0'),
                        ],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                bases: [
                    makeBase({
                        minions: [makeInnsmouthActionMinion('m1', 'innsmouth_the_locals', '0', 2)],
                    }),
                ],
            });

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, defaultTestRandom);
            expect(played.success, played.error).toBe(true);
            expect(played.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);

            const prompt = getSimpleChoicePrompt(played.finalState, 'innsmouth_spreading_the_word');
            expect(getPromptSourceId(prompt)).toBe('innsmouth_spreading_the_word');
            expect(getPromptOptions(prompt)).toHaveLength(1);

            const resolved = respondToPromptOption(
                played.finalState,
                option => option.value?.defId === 'innsmouth_the_locals',
                'innsmouth spreading the word locals option',
                '0',
                defaultTestRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const limits = resolved.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limits).toHaveLength(2);
            expect(limits.every(event => (event as any).payload.sameNameDefId === 'innsmouth_the_locals')).toBe(true);
        });
    });

    describe('innsmouth_recruitment（招募）', () => {
        test('选择抽 3 张疯狂卡时获得 3 个额外随从', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, defaultTestRandom);
            expect(played.success, played.error).toBe(true);

            const prompt = getSimpleChoicePrompt(played.finalState, 'innsmouth_recruitment');
            expect(getPromptSourceId(prompt)).toBe('innsmouth_recruitment');
            const resolved = respondToPromptOption(
                played.finalState,
                option => option.value?.count === 3,
                'innsmouth recruitment draw 3 option',
                '0',
                defaultTestRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const madnessEvents = resolved.events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents).toHaveLength(1);
            expect((madnessEvents[0] as any).payload.count).toBe(3);
            expect(
                resolved.events.filter(
                    event => event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'minion',
                ),
            ).toHaveLength(3);
        });

        test('疯狂牌库不足 3 张时不暴露 count=3 选项，并按可用数量结算', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, defaultTestRandom);
            expect(played.success, played.error).toBe(true);

            const prompt = getSimpleChoicePrompt(played.finalState, 'innsmouth_recruitment');
            expect(getPromptOptions(prompt).some(option => option.value?.count === 3)).toBe(false);
            const resolved = respondToPromptOption(
                played.finalState,
                option => option.value?.count === 2,
                'innsmouth recruitment draw 2 option',
                '0',
                defaultTestRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const madnessEvents = resolved.events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN);
            expect(madnessEvents).toHaveLength(1);
            expect((madnessEvents[0] as any).payload.count).toBe(2);
            expect(
                resolved.events.filter(
                    event => event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'minion',
                ),
            ).toHaveLength(2);
        });

        test('疯狂牌库为空时无效果且不创建 prompt', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_recruitment', 'action', '0')],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                madnessDeck: [],
            });

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, defaultTestRandom);
            expect(played.success, played.error).toBe(true);
            expect(played.events.filter(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toHaveLength(0);
            expect(played.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(0);
            expectNoPrompt(played.finalState);
        });

        test('最终状态应反映疯狂卡入手和额外随从额度', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_recruitment', 'action', '0')],
                        minionLimit: 1,
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });

            const played = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any, defaultTestRandom);
            expect(played.success, played.error).toBe(true);

            const resolved = respondToPromptOption(
                played.finalState,
                option => option.value?.count === 3,
                'innsmouth recruitment reduce draw 3 option',
                '0',
                defaultTestRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            expect(resolved.finalState.core.players['0'].hand.filter(card => card.defId === MADNESS_CARD_DEF_ID)).toHaveLength(3);
            expect(resolved.finalState.core.players['0'].minionLimit).toBe(4);
        });
    });
});

describe('印斯茅斯普通行为', () => {
    describe('innsmouth_the_deep_ones（深潜者：力量≤2随从+1力量）', () => {
        test('所有己方力量≤2随从获得+1力量', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_the_deep_ones', 'action', '0')],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                bases: [
                    {
                        defId: 'b1',
                        minions: [
                            makeInnsmouthActionMinion('m1', 'test', '0', 2),
                            makeInnsmouthActionMinion('m2', 'test', '0', 1),
                            makeInnsmouthActionMinion('m3', 'test', '0', 3),
                        ],
                        ongoingActions: [],
                    },
                    {
                        defId: 'b2',
                        minions: [
                            makeInnsmouthActionMinion('m4', 'test', '0', 2),
                            makeInnsmouthActionMinion('m5', 'test', '1', 1),
                        ],
                        ongoingActions: [],
                    },
                ],
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            const powerEvents = events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED);
            expect(powerEvents).toHaveLength(3);
            const uids = powerEvents.map((event: any) => event.payload.minionUid);
            expect(uids).toContain('m1');
            expect(uids).toContain('m2');
            expect(uids).toContain('m4');
            for (const event of powerEvents) {
                expect((event as any).payload.amount).toBe(1);
            }
        });

        test('无符合条件随从时不产生事件', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_the_deep_ones', 'action', '0')],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [makeInnsmouthActionMinion('m1', 'test', '0', 5)],
                    ongoingActions: [],
                }],
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toHaveLength(0);
        });

        test('力量修正正确应用（reduce 验证）', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_the_deep_ones', 'action', '0')],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [makeInnsmouthActionMinion('m1', 'test', '0', 2)],
                    ongoingActions: [],
                }],
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            const newState = applyInnsmouthActionEvents(state, events);
            const minion = newState.bases[0].minions.find(current => current.uid === 'm1');
            expect(minion?.tempPowerModifier).toBe(1);
        });
    });

    describe('innsmouth_new_acolytes（新人：所有玩家弃牌堆随从洗回牌库）', () => {
        test('所有玩家弃牌堆随从洗回牌库', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_new_acolytes', 'action', '0')],
                        deck: [makeInnsmouthActionCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeInnsmouthActionCard('dis1', 'test_m', 'minion', '0'),
                            makeInnsmouthActionCard('dis2', 'test_a', 'action', '0'),
                        ],
                    }),
                    '1': makeInnsmouthActionPlayer('1', {
                        deck: [makeInnsmouthActionCard('d2', 'test', 'minion', '1')],
                        discard: [
                            makeInnsmouthActionCard('dis3', 'test_m', 'minion', '1'),
                            makeInnsmouthActionCard('dis4', 'test_m2', 'minion', '1'),
                        ],
                    }),
                },
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            expect(events.filter(event => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(2);
        });

        test('弃牌堆无随从的玩家不受影响', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_new_acolytes', 'action', '0')],
                        discard: [makeInnsmouthActionCard('dis1', 'test_m', 'minion', '0')],
                    }),
                    '1': makeInnsmouthActionPlayer('1', {
                        discard: [makeInnsmouthActionCard('dis2', 'test_a', 'action', '1')],
                    }),
                },
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            const reorderEvents = events.filter(event => event.type === SU_EVENTS.DECK_REORDERED);
            expect(reorderEvents).toHaveLength(1);
            expect((reorderEvents[0] as any).payload.playerId).toBe('0');
        });

        test('洗回后状态正确（reduce 验证）', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_new_acolytes', 'action', '0')],
                        deck: [makeInnsmouthActionCard('d1', 'test', 'action', '0')],
                        discard: [
                            makeInnsmouthActionCard('dis1', 'test_m', 'minion', '0'),
                            makeInnsmouthActionCard('dis2', 'test_a', 'action', '0'),
                        ],
                    }),
                    '1': makeInnsmouthActionPlayer('1', {
                        deck: [],
                        discard: [makeInnsmouthActionCard('dis3', 'test_m', 'minion', '1')],
                    }),
                },
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            const newState = applyInnsmouthActionEvents(state, events);
            expect(newState.players['0'].deck).toHaveLength(2);
            expect(newState.players['0'].deck.some(card => card.uid === 'dis1')).toBe(true);
            expect(newState.players['0'].deck.some(card => card.uid === 'd1')).toBe(true);
            expect(newState.players['0'].discard).toHaveLength(2);
            expect(newState.players['0'].discard.some(card => card.uid === 'dis2')).toBe(true);
            expect(newState.players['0'].discard.some(card => card.uid === 'a1')).toBe(true);
            expect(newState.players['1'].discard).toHaveLength(0);
            expect(newState.players['1'].deck).toHaveLength(1);
            expect(newState.players['1'].deck[0].uid).toBe('dis3');
        });

        test('被他人拥有的弃牌随从仍应洗回其拥有者牌库', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_new_acolytes', 'action', '0')],
                        deck: [makeInnsmouthActionCard('p0-deck-a', 'test_m0', 'minion', '0')],
                        discard: [
                            makeInnsmouthActionCard('own-minion', 'test_m1', 'minion', '0'),
                            makeInnsmouthActionCard('borrowed-minion', 'test_m2', 'minion', '1'),
                        ],
                    }),
                    '1': makeInnsmouthActionPlayer('1', {
                        deck: [makeInnsmouthActionCard('p1-deck-a', 'test_m3', 'minion', '1')],
                    }),
                },
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            expect(events).toContainEqual(expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({
                    playerId: '1',
                    sourcePlayerId: '0',
                }),
            }));

            const newState = applyInnsmouthActionEvents(state, events);
            expect(newState.players['0'].discard.some(card => card.uid === 'borrowed-minion')).toBe(false);
            expect(newState.players['0'].deck.some(card => card.uid === 'borrowed-minion')).toBe(false);
            expect(newState.players['1'].deck.some(card => card.uid === 'borrowed-minion')).toBe(true);
        });
    });

    describe('innsmouth_mysteries_of_the_deep（深潜者的秘密：3+同名随从抽3张）', () => {
        test('POD 与基础版同名随从应共同计数触发抽3', () => {
            const state = makeInnsmouthActionState({
                players: {
                    '0': makeInnsmouthActionPlayer('0', {
                        hand: [makeInnsmouthActionCard('a1', 'innsmouth_mysteries_of_the_deep', 'action', '0')],
                        deck: [
                            makeInnsmouthActionCard('d1', 'test_a', 'action', '0'),
                            makeInnsmouthActionCard('d2', 'test_b', 'action', '0'),
                            makeInnsmouthActionCard('d3', 'test_c', 'action', '0'),
                        ],
                    }),
                    '1': makeInnsmouthActionPlayer('1'),
                },
                bases: [{
                    defId: 'b1',
                    minions: [
                        makeInnsmouthActionMinion('m1', 'innsmouth_the_locals', '0', 2),
                        makeInnsmouthActionMinion('m2', 'innsmouth_the_locals', '0', 2),
                        makeInnsmouthActionMinion('m3', 'innsmouth_the_locals_pod', '0', 2),
                    ],
                    ongoingActions: [],
                }],
            });

            const { events } = execInnsmouthActionPlay(state, '0', 'a1');
            const drawEvent = events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
            expect(drawEvent).toBeDefined();
            expect(drawEvent.payload.count).toBe(3);
        });
    });
});
