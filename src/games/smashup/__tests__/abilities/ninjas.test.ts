import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers, isMinionProtected, registerPodOngoingAliases } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { registerCowboysAbilities, registerCowboysInteractionHandlers } from '../../abilities/cowboys';
import { registerNinjaInteractionHandlers } from '../../abilities/ninjas';
import { getCardDef, getMinionDef } from '../../data/cards';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { reduce } from '../../domain/reduce';
import type { BaseInPlay, MinionOnBase, SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

describe('忍者派系能力', () => {
    it('ninja_seeing_stars: 单个力量≤3对手随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_seeing_stars', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 5, { powerModifier: 0 })], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [makeMinion('m2', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'ninja_seeing_stars');
    });

    it('ninja_way_of_deception: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5, { powerModifier: 0 }), makeMinion('m1', 'test', '0', 2, { powerModifier: 0 })], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'ninja_way_of_deception_choose_minion');
    });

    it('ninja_way_of_deception: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('ninja_way_of_deception: 只有一个基地时无法移动', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5)], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('ninja_disguise: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const basePrompt = getSimpleChoicePrompt(matchState, 'ninja_disguise_choose_base');
        expect(basePrompt.autoResolveIfSingle).toBe(false);
        const choseBase = respondToPrompt(
            matchState,
            getPromptOption(basePrompt, option => option.value?.baseIndex === 0, 'disguise single base').id,
            '0',
            defaultTestRandom,
        );
        getSimpleChoicePrompt(choseBase.finalState, 'ninja_disguise_choose_minions');
    });

    it('ninja_disguise: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        expect(returnEvents).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('ninja_disguise: 有己方随从但手牌无随从时不创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_disguise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expectNoPrompt(matchState);
        expect(events.filter(e => e.type === SU_EVENTS.MINION_RETURNED)).toHaveLength(0);
    });

    it('ninja_disguise: 打出 borrowed 手牌随从时，返回事件仍应保留行动玩家 sourcePlayerId', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('borrowed-hand-minion', 'ninja_master', 'minion', '1'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('return-me', 'test', '0', 2)], ongoingActions: [] }),
            ],
        });

        const played = execPlayAction(state, '0', 'a1');
        const chooseBase = respondToPrompt(
            played.matchState,
            getPromptOption(
                getSimpleChoicePrompt(played.matchState, 'ninja_disguise_choose_base'),
                option => option.value?.baseIndex === 0,
                'disguise borrowed base',
            ).id,
            '0',
            defaultTestRandom,
        );
        const chooseReturn = respondToPrompt(
            chooseBase.finalState,
            getPromptOption(
                getSimpleChoicePrompt(chooseBase.finalState, 'ninja_disguise_choose_minions'),
                option => option.value?.minionUid === 'return-me',
                'disguise return target',
            ).id,
            '0',
            defaultTestRandom,
        );
        const resolved = respondToPrompt(
            chooseReturn.finalState,
            getPromptOption(
                getSimpleChoicePrompt(chooseReturn.finalState, 'ninja_disguise_choose_play1'),
                option => option.value?.cardUid === 'borrowed-hand-minion',
                'disguise borrowed hand minion',
            ).id,
            '0',
            defaultTestRandom,
        );

        const returnedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_RETURNED) as any;
        expect(returnedEvent).toBeDefined();
        expect(returnedEvent.payload).toMatchObject({
            minionUid: 'return-me',
            toPlayerId: '0',
            sourcePlayerId: '0',
            reason: 'ninja_disguise',
        });

        const playedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
        expect(playedEvent).toBeDefined();
        expect(playedEvent.payload).toMatchObject({
            cardUid: 'borrowed-hand-minion',
            ownerId: '1',
            playerId: '0',
            baseIndex: 0,
        });
    });
});

function makeNinjaOngoingMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
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

function makeNinjaOngoingState(
    bases: BaseInPlay[],
    extraPlayers?: Partial<SmashUpCore['players']>,
): SmashUpCore {
    return {
        players: {
            '0': makePlayer('0', {
                hand: [
                    makeCard('h1', 'ninja_shinobi', 'minion', '0'),
                    makeCard('h2', 'test_action', 'action', '0'),
                    makeCard('h3', 'test_minion_b', 'minion', '0'),
                ],
                deck: [
                    makeCard('d1', 'deck_card_1', 'minion', '0'),
                    makeCard('d2', 'deck_card_2', 'action', '0'),
                ],
                factions: [SMASHUP_FACTION_IDS.NINJAS, 'test_b'],
            }),
            '1': makePlayer('1', {
                hand: [
                    makeCard('oh1', 'opp_card_1', 'minion', '1'),
                    makeCard('oh2', 'opp_card_2', 'action', '1'),
                    makeCard('oh3', 'opp_card_3', 'minion', '1'),
                ],
                deck: [makeCard('od1', 'opp_deck_1', 'minion', '1')],
                factions: [SMASHUP_FACTION_IDS.ROBOTS, 'test_d'],
            }),
            ...extraPlayers,
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 200,
    };
}

describe('忍者 ongoing/special 能力', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearPowerModifierRegistry();
        clearOngoingEffectRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
        registerPodOngoingAliases();
    });

    describe('ninja_smoke_bomb: 烟雾弹保护', () => {
        it('保护被附着的随从不受对手行动卡影响', () => {
            const myMinion = makeNinjaOngoingMinion({
                defId: 'ninja_a', uid: 'n-1', controller: '0',
                attachedActions: [{ uid: 'sb-1', defId: 'ninja_smoke_bomb', ownerId: '0' }],
            });
            const state = makeNinjaOngoingState([makeBase({ minions: [myMinion] })]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });

        it('同一宿主上若同时有两张不同控制者的 Smoke Bomb，不应因第一张同名来源而放行对手行动', () => {
            const protectedMinion = makeNinjaOngoingMinion({
                defId: 'ninja_a',
                uid: 'n-smoke-host',
                controller: '0',
                owner: '0',
                attachedActions: [
                    { uid: 'sb-owner', defId: 'ninja_smoke_bomb', ownerId: '1' } as any,
                    {
                        uid: 'sb-borrowed',
                        defId: 'ninja_smoke_bomb',
                        ownerId: '1',
                        metadata: { sourcePlayerId: '0', sourceControllerId: '0' },
                    } as any,
                ],
            });
            const state = makeNinjaOngoingState([makeBase({ minions: [protectedMinion] })]);

            expect(isMinionProtected(state, protectedMinion, 0, '1', 'action')).toBe(true);
            expect(isMinionProtected(state, protectedMinion, 0, '0', 'action')).toBe(false);
        });

        it('POD 版烟雾弹也会保护被附着的随从', () => {
            const myMinion = makeNinjaOngoingMinion({
                defId: 'ninja_a', uid: 'n-pod-1', controller: '0',
                attachedActions: [{ uid: 'sb-pod-1', defId: 'ninja_smoke_bomb_pod', ownerId: '0' }],
            });
            const state = makeNinjaOngoingState([makeBase({ minions: [myMinion] })]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });

        it('不保护未附着烟幕弹的随从', () => {
            const myMinion = makeNinjaOngoingMinion({
                defId: 'ninja_b', uid: 'n-2', controller: '0',
                attachedActions: [{ uid: 'sb-1', defId: 'ninja_smoke_bomb', ownerId: '0' }],
            });
            const oppMinion = makeNinjaOngoingMinion({ defId: 'robot_a', uid: 'r-1', controller: '1', owner: '1' });
            const state = makeNinjaOngoingState([makeBase({ minions: [myMinion, oppMinion] })]);

            expect(isMinionProtected(state, oppMinion, 0, '0', 'action')).toBe(false);
        });
    });

    describe('ninja_assassination: 暗杀', () => {
        it('回合结束时消灭附着了暗杀的随从', () => {
            const target = makeNinjaOngoingMinion({
                defId: 'opp_minion', uid: 'om-1', controller: '1', owner: '1',
                attachedActions: [{ uid: 'as-1', defId: 'ninja_assassination', ownerId: '0' }],
            });
            const state = makeNinjaOngoingState([makeBase({ minions: [target] })]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('om-1');
            expect((events[0] as any).payload.reason).toBe('ninja_assassination');
            expect((events[0] as any).payload.destroyerId).toBe('0');
        });

        it('POD 版暗杀也会在回合结束时消灭被附着的随从', () => {
            const target = makeNinjaOngoingMinion({
                defId: 'opp_minion', uid: 'om-pod-1', controller: '1', owner: '1',
                attachedActions: [{ uid: 'as-pod-1', defId: 'ninja_assassination_pod', ownerId: '0' }],
            });
            const state = makeNinjaOngoingState([makeBase({ minions: [target] })]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('om-pod-1');
            expect((events[0] as any).payload.reason).toBe('ninja_assassination');
        });

        it('无附着暗杀时不触发', () => {
            const target = makeNinjaOngoingMinion({ defId: 'opp_minion', uid: 'om-1', controller: '1', owner: '1' });
            const state = makeNinjaOngoingState([makeBase({ minions: [target] })]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        it('同一宿主上第一张暗杀不属于当前回合玩家时，不应吞掉后面另一控制者的真实触发', () => {
            const target = makeNinjaOngoingMinion({
                defId: 'opp_minion',
                uid: 'om-mixed-1',
                controller: '1',
                owner: '1',
                attachedActions: [
                    { uid: 'as-owner-1', defId: 'ninja_assassination', ownerId: '1' },
                    { uid: 'as-owner-0', defId: 'ninja_assassination', ownerId: '0' },
                ],
            });
            const state = makeNinjaOngoingState([makeBase({ minions: [target] })]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: defaultTestRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('om-mixed-1');
            expect((events[0] as any).payload.reason).toBe('ninja_assassination');
            expect((events[0] as any).payload.destroyerId).toBe('0');
        });
    });

    describe('ninja_infiltrate: 渗透', () => {
        it('附着渗透的随从不受影响', () => {
            const minion = makeNinjaOngoingMinion({
                defId: 'ninja_a', uid: 'n-1', controller: '0',
                attachedActions: [{ uid: 'inf-1', defId: 'ninja_infiltrate', ownerId: '0' }],
            });
            const state = makeNinjaOngoingState([makeBase({ minions: [minion] })]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        });

        it('POD 版渗透不会继承基础版渗透的保护语义', () => {
            const minion = makeNinjaOngoingMinion({
                defId: 'ninja_a', uid: 'n-inf-pod-1', controller: '0',
            });
            const state = makeNinjaOngoingState([makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'inf-pod-1', defId: 'ninja_infiltrate_pod', ownerId: '0' }],
            })]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(false);
        });

        it('渗透只能消灭基地上的战术，不能消灭随从上的战术', () => {
            const minion = makeNinjaOngoingMinion({
                uid: 'm1',
                defId: 'test_minion',
                controller: '1',
                owner: '1',
                attachedActions: [{ uid: 'poison', defId: 'ninja_poison', ownerId: '1' }],
            });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'ongoing1', defId: 'test_ongoing', ownerId: '1' }],
            });
            const targets: { uid: string; defId: string }[] = [];

            for (const ongoing of base.ongoingActions) {
                if (ongoing.uid === 'infiltrate') continue;
                targets.push({ uid: ongoing.uid, defId: ongoing.defId });
            }

            expect(targets).toHaveLength(1);
            expect(targets[0].uid).toBe('ongoing1');
            expect(targets[0].defId).toBe('test_ongoing');
        });

        it('有多个基地战术时创建选择交互', () => {
            const base = makeBase({
                ongoingActions: [
                    { uid: 'ongoing-1', defId: 'zombie_overrun', ownerId: '1' },
                    { uid: 'ongoing-2', defId: 'ninja_smoke_bomb', ownerId: '0' },
                ],
            });
            const templateState = makeNinjaOngoingState([base]);
            const state = makeNinjaOngoingState([base], {
                '0': {
                    ...templateState.players['0'],
                    hand: [makeCard('infiltrate-1', 'ninja_infiltrate', 'action', '0')],
                },
            });

            const result = runCommand(
                makeMatchState(state),
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: { cardUid: 'infiltrate-1', targetBaseIndex: 0 },
                } as any,
                defaultTestRandom,
            );

            expect(result.success).toBe(true);
            const current = getFirstPrompt(result.finalState);
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('ninja_infiltrate_destroy');
            expect(getPromptTargetType(current)).toBe('ongoing');
            expect(getPromptOptions(current)).toHaveLength(2);
        });

        it('POD 版渗透只会给出基地上的战术目标，不会把随从或附着战术当目标', () => {
            const minion = makeNinjaOngoingMinion({
                uid: 'm-pod-1',
                defId: 'test_minion',
                controller: '1',
                owner: '1',
                attachedActions: [{ uid: 'poison-pod', defId: 'ninja_poison_pod', ownerId: '1' }],
            });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'ongoing-pod-1', defId: 'zombie_overrun', ownerId: '1' }],
            });
            const templateState = makeNinjaOngoingState([base]);
            const state = makeNinjaOngoingState([base], {
                '0': {
                    ...templateState.players['0'],
                    hand: [makeCard('infiltrate-pod-1', 'ninja_infiltrate_pod', 'action', '0')],
                },
            });

            const result = runCommand(
                makeMatchState(state),
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: { cardUid: 'infiltrate-pod-1', targetBaseIndex: 0 },
                } as any,
                defaultTestRandom,
            );

            expect(result.success).toBe(true);
            const current = getFirstPrompt(result.finalState);
            expect(getPromptSourceId(current)).toBe('ninja_infiltrate_pod_destroy');
            expect(getPromptTargetType(current)).toBe('ongoing');
            expect(getPromptOptions(current)).toHaveLength(2);

            const cardOptions = getPromptOptions(current).filter((option: any) => option.value?.cardUid);
            expect(cardOptions).toHaveLength(1);
            expect(cardOptions[0].value.cardUid).toBe('ongoing-pod-1');
            expect(cardOptions[0].value.defId).toBe('zombie_overrun');
        });

        it('只有一个基地战术时也必须等待玩家选择后才消灭', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'ongoing-1', defId: 'zombie_overrun', ownerId: '1' }],
            });
            const templateState = makeNinjaOngoingState([base]);
            const state = makeNinjaOngoingState([base], {
                '0': {
                    ...templateState.players['0'],
                    hand: [makeCard('infiltrate-1', 'ninja_infiltrate', 'action', '0')],
                },
            });

            const result = runCommand(
                makeMatchState(state),
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: { cardUid: 'infiltrate-1', targetBaseIndex: 0 },
                } as any,
                defaultTestRandom,
            );

            expect(result.success).toBe(true);
            const current = getFirstPrompt(result.finalState);
            expect(getPromptSourceId(current)).toBe('ninja_infiltrate_destroy');
            expect(getPromptTargetType(current)).toBe('ongoing');
            expect(getPromptOptions(current)).toHaveLength(1);
            const option = getPromptOption(current, candidate => candidate?.value?.cardUid === 'ongoing-1', '唯一基地战术');

            const resolved = respondToPrompt(result.finalState, option.id, '0', defaultTestRandom);
            const detached = resolved.events.find(event => event.type === SU_EVENTS.ONGOING_DETACHED) as any;
            expect(detached).toBeDefined();
            expect(detached.payload.cardUid).toBe('ongoing-1');
        });

        it('没有基地战术时不创建交互也不额外发事件', () => {
            const base = makeBase({ ongoingActions: [] });
            const templateState = makeNinjaOngoingState([base]);
            const state = makeNinjaOngoingState([base], {
                '0': {
                    ...templateState.players['0'],
                    hand: [makeCard('infiltrate-1', 'ninja_infiltrate', 'action', '0')],
                },
            });

            const result = runCommand(
                makeMatchState(state),
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: { cardUid: 'infiltrate-1', targetBaseIndex: 0 },
                } as any,
                defaultTestRandom,
            );

            expect(result.success).toBe(true);
            expectNoPrompt(result.finalState);
            expect(result.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(false);
        });
    });

    describe('ninja_shinobi: 影舞者 Me First! 窗口打出', () => {
        it('影舞者卡牌定义有 beforeScoringPlayable 标记', () => {
            const def = getMinionDef('ninja_shinobi');
            expect(def).toBeDefined();
            expect(def!.beforeScoringPlayable).toBe(true);
        });

        it('beforeScoring 触发器不再注册影舞者', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })]);
            const result = fireTriggers(state, 'beforeScoring', {
                state,
                playerId: '0',
                baseIndex: 0,
                random: defaultTestRandom,
                now: 1000,
            });
            const shinobiEvents = result.events.filter(e =>
                e.type === SU_EVENTS.MINION_PLAYED && (e as any).payload?.defId === 'ninja_shinobi',
            );
            expect(shinobiEvents).toHaveLength(0);
        });
    });

    describe('ninja_acolyte: 忍者侍从 special 能力（点击激活）', () => {
        it('基地上有侍从时激活返回手牌并给额外随从额度', () => {
            const state = makeNinjaOngoingState([
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })] }),
            ]);
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const acolyteEvents = result.events.filter(e =>
                e.type === SU_EVENTS.MINION_RETURNED ||
                (e.type === SU_EVENTS.SPECIAL_LIMIT_USED && (e as any).payload?.abilityDefId === 'ninja_acolyte'),
            );
            expect(acolyteEvents).toHaveLength(2);
            expect(acolyteEvents[0].type).toBe(SU_EVENTS.SPECIAL_LIMIT_USED);
            expect(acolyteEvents[1].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect((acolyteEvents[1] as any).payload).toMatchObject({
                minionUid: 'ac-1',
                toPlayerId: '0',
                sourcePlayerId: '0',
                reason: 'ninja_acolyte',
            });
            expect(getFirstPrompt(result.finalState)).toBeDefined();
        });

        it('ninja_acolyte_pod talent 返回手牌事件应保留发动玩家 sourcePlayerId', () => {
            const state = makeNinjaOngoingState([
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte_pod', uid: 'ac-pod-1', controller: '0' })] }),
            ]);
            state.players['0'].hand = [];
            state.players['0'].minionsPlayed = 0;

            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'ac-pod-1', baseIndex: 0 },
            } as any, defaultTestRandom);

            expect(result.success, result.error).toBe(true);
            const returnedEvent = result.events.find(event => event.type === SU_EVENTS.MINION_RETURNED) as any;
            expect(returnedEvent).toBeDefined();
            expect(returnedEvent.payload).toMatchObject({
                minionUid: 'ac-pod-1',
                toPlayerId: '0',
                sourcePlayerId: '0',
                reason: 'ninja_acolyte_pod',
            });
            expect(getPromptSourceId(getFirstPrompt(result.finalState))).toBe('ninja_acolyte_play');
        });

        it('把自己收回再额外打出后，应视为本回合已打出过随从，不能再发动其他忍者侍从', () => {
            const state = makeNinjaOngoingState([
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })] }),
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-2', controller: '0' })] }),
            ]);

            const activated = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(activated.success, activated.error).toBe(true);

            const prompt = getFirstPrompt(activated.finalState);
            const selfOption = getPromptOption(
                prompt,
                option => option?.value?.cardUid === 'ac-1' && option?.value?.defId === 'ninja_acolyte',
                'Acolyte self replay option',
            );
            const replayed = respondToPrompt(activated.finalState, selfOption.id, '0', defaultTestRandom);
            expect(replayed.success, replayed.error).toBe(true);

            const secondAttempt = runCommand(replayed.finalState, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-2', baseIndex: 1 },
            } as any, defaultTestRandom);

            expect(secondAttempt.success).toBe(false);
            expect(secondAttempt.error).toContain('已打出过随从');
        });

        it('同基地已使用忍者 special 时被阻止', () => {
            const state = makeNinjaOngoingState([
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })] }),
            ]);
            state.specialLimitUsed = { ninja_acolyte: [0] };
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success).toBe(false);
            expect(result.error).toContain('已使用过同组特殊能力');
            expect(result.events).toHaveLength(0);
        });

        it('本回合已打出随从时被阻止', () => {
            const state = makeNinjaOngoingState([
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })] }),
            ]);
            state.players['0'].minionsPlayed = 1;
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success).toBe(false);
            expect(result.error).toContain('已打出过随从');
            expect(result.events).toHaveLength(0);
        });

        it('被泛滥横行封锁时，仍会先回手，但额外打出的随从不能落到该基地', () => {
            const state = makeNinjaOngoingState([
                makeBase({
                    minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
                    ongoingActions: [{ uid: 'overrun-1', defId: 'zombie_overrun', ownerId: '1' }],
                }),
            ]);
            state.players['0'].hand = [makeCard('h3', 'test_minion_b', 'minion', '0')];

            const activated = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(activated.success, activated.error).toBe(true);
            expect(activated.finalState.core.players['0'].hand.some(card => card.uid === 'ac-1')).toBe(true);

            const prompt = getFirstPrompt(activated.finalState);
            const option = getPromptOption(
                prompt,
                candidate => candidate?.value?.cardUid === 'h3',
                'Acolyte blocked extra-play option',
            );
            const resolved = respondToPrompt(activated.finalState, option.id, '0', defaultTestRandom);

            expect(resolved.success, resolved.error).toBe(true);
            expect(resolved.events.some((event: any) => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
            expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'h3')).toBe(false);
            expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'h3')).toBe(true);
            expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'ac-1')).toBe(true);
        });
    });

    describe('ninja_hidden_ninja: 隐忍 special', () => {
        it('会把手牌中所有随从都放入选择交互', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })], {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hidden', 'ninja_hidden_ninja', 'action', '0'),
                        makeCard('acolyte', 'ninja_acolyte', 'minion', '0'),
                        makeCard('shinobi', 'ninja_shinobi', 'minion', '0'),
                        makeCard('pirate', 'pirate_first_mate', 'minion', '0'),
                        makeCard('action', 'test_action', 'action', '0'),
                    ],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.PIRATES],
                }),
            });
            const matchState = makeMatchState(state);
            const result = invokeRegisteredAbilityContract('ninja_hidden_ninja', 'special', {
                state,
                matchState,
                playerId: '0',
                cardUid: 'hidden',
                defId: 'ninja_hidden_ninja',
                baseIndex: 0,
                random: defaultTestRandom,
                now: 1000,
            });

            const current = getFirstPrompt(result.matchState!);
            expect(getPromptSourceId(current)).toBe('ninja_hidden_ninja');
            expect(getPromptTargetType(current)).toBe('hand');
            expect(getPromptOptions(current)).toEqual(expect.arrayContaining([
                expect.objectContaining({ value: expect.objectContaining({ cardUid: 'acolyte', defId: 'ninja_acolyte' }) }),
                expect.objectContaining({ value: expect.objectContaining({ cardUid: 'shinobi', defId: 'ninja_shinobi' }) }),
                expect.objectContaining({ value: expect.objectContaining({ cardUid: 'pirate', defId: 'pirate_first_mate' }) }),
            ]));
        });

        it('同基地已使用忍者 special 时被阻止', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })]);
            state.specialLimitUsed = { ninja_hidden_ninja: [0] };
            const matchState = makeMatchState(state);
            const result = invokeRegisteredAbilityContract('ninja_hidden_ninja', 'special', {
                state,
                matchState,
                playerId: '0',
                cardUid: 'hn-1',
                defId: 'ninja_hidden_ninja',
                baseIndex: 0,
                random: defaultTestRandom,
                now: 1000,
            });
            expect(result.events).toHaveLength(0);
        });
    });

    describe('specialLimitGroup: 跨卡牌共享限制', () => {
        it('影舞者、便衣忍者、忍者侍从各自声明独立的 specialLimitGroup', () => {
            const shinobi = getCardDef('ninja_shinobi') as any;
            const hidden = getCardDef('ninja_hidden_ninja') as any;
            const acolyte = getCardDef('ninja_acolyte') as any;

            expect(shinobi.specialLimitGroup).toBe('ninja_shinobi');
            expect(hidden.specialLimitGroup).toBe('ninja_hidden_ninja');
            expect(acolyte.specialLimitGroup).toBe('ninja_acolyte');
        });

        it('三张忍者特殊卡牌不再共享旧的 ninja_special 限制组', () => {
            const groups = [
                (getCardDef('ninja_shinobi') as any).specialLimitGroup,
                (getCardDef('ninja_hidden_ninja') as any).specialLimitGroup,
                (getCardDef('ninja_acolyte') as any).specialLimitGroup,
            ];

            expect(new Set(groups).size).toBe(3);
            expect(groups).not.toContain('ninja_special');
        });

        it('使用 ninja_acolyte 后同基地再次使用被阻止', () => {
            const state = makeNinjaOngoingState([
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })] }),
            ]);
            state.specialLimitUsed = { ninja_acolyte: [0] };
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success).toBe(false);
            expect(result.error).toContain('已使用过同组特殊能力');
            expect(result.events).toHaveLength(0);
        });

        it('SPECIAL_LIMIT_USED 事件正确更新 reducer 状态', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })]);
            const evt = {
                type: SU_EVENTS.SPECIAL_LIMIT_USED,
                payload: { playerId: '0', baseIndex: 0, limitGroup: 'ninja_acolyte', abilityDefId: 'ninja_acolyte' },
                timestamp: 1000,
            };
            const next = reduce(state, evt as any);
            expect(next.specialLimitUsed).toEqual({ ninja_acolyte: [0] });
            const evt2 = { ...evt, payload: { ...evt.payload, baseIndex: 1 } };
            const next2 = reduce(next, evt2 as any);
            expect(next2.specialLimitUsed).toEqual({ ninja_acolyte: [0, 1] });
        });

        it('TURN_STARTED 清除 specialLimitUsed', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })]);
            state.specialLimitUsed = { ninja_special: [0, 1] };
            const evt = {
                type: SU_EVENTS.TURN_STARTED,
                payload: { playerId: '0', turnNumber: 2 },
                timestamp: 2000,
            };
            const next = reduce(state, evt as any);
            expect(next.specialLimitUsed).toBeUndefined();
        });
    });

    describe('consumesNormalLimit: 忍者 special 额外打出不消耗正常额度', () => {
        it('ninja_acolyte_play 交互产生 MINION_PLAYED 事件且 consumesNormalLimit=false', () => {
            const state = makeNinjaOngoingState([
                makeBase({ minions: [makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })] }),
            ]);
            state.players['0'].hand = [makeCard('h3', 'test_minion_b', 'minion', '0')];
            state.players['0'].minionsPlayed = 0;
            const result = runCommand(makeMatchState(state), {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: '0',
                payload: { minionUid: 'ac-1', baseIndex: 0 },
            } as any, defaultTestRandom);
            expect(result.success, result.error).toBe(true);

            const returnEvt = result.events.find((e: any) => e.type === SU_EVENTS.MINION_RETURNED);
            expect(returnEvt).toBeDefined();
            const limitEvt = result.events.find((e: any) => e.type === SU_EVENTS.LIMIT_MODIFIED);
            expect(limitEvt).toBeUndefined();

            clearInteractionHandlers();
            registerNinjaInteractionHandlers();
            const prompt = getFirstPrompt(result.finalState);
            expect(getPromptSourceId(prompt)).toBe('ninja_acolyte_play');
            const option = getPromptOption(
                prompt,
                candidate => candidate?.value?.cardUid === 'h3',
                'Acolyte extra-play minion option',
            );
            const resolved = respondToPrompt(result.finalState, option.id, '0', defaultTestRandom);
            expect(resolved.success).toBe(true);
            const playedEvt = resolved.events.find((e: any) => e.type === SU_EVENTS.MINION_PLAYED);
            expect(playedEvt).toBeDefined();
            expect((playedEvt as any).payload.consumesNormalLimit).toBe(false);
        });

        it('ninja_hidden_ninja 交互产生的 MINION_PLAYED 带 consumesNormalLimit=false', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })]);
            state.players['0'].hand = [
                makeCard('hidden', 'ninja_hidden_ninja', 'action', '0'),
                makeCard('h3', 'test_minion_b', 'minion', '0'),
            ];
            const matchState = makeMatchState(state);
            clearInteractionHandlers();
            registerNinjaInteractionHandlers();
            const result = invokeRegisteredAbilityContract('ninja_hidden_ninja', 'special', {
                state,
                matchState,
                playerId: '0',
                cardUid: 'hidden',
                defId: 'ninja_hidden_ninja',
                baseIndex: 0,
                random: defaultTestRandom,
                now: 1000,
            });
            const promptState = result.matchState ?? matchState;
            const prompt = getFirstPrompt(promptState);
            expect(getPromptSourceId(prompt)).toBe('ninja_hidden_ninja');
            const resolved = respondToPrompt(
                promptState,
                getPromptOption(prompt, candidate => candidate?.value?.cardUid === 'h3', 'Hidden Ninja extra-play minion option').id,
                '0',
                defaultTestRandom,
            );
            expect(resolved.success).toBe(true);
            const playedEvt = resolved.events.find((e: any) => e.type === SU_EVENTS.MINION_PLAYED);
            expect(playedEvt).toBeDefined();
            expect((playedEvt as any).payload.consumesNormalLimit).toBe(false);
        });

        it('consumesNormalLimit=false 时 reducer 不增加 minionsPlayed', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })]);
            state.players['0'].minionsPlayed = 0;
            const evt = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: '0',
                    cardUid: 'h3',
                    defId: 'test_minion_b',
                    baseIndex: 0,
                    power: 3,
                    consumesNormalLimit: false,
                },
                timestamp: 1000,
            };
            const next = reduce(state, evt as any);
            expect(next.players['0'].minionsPlayed).toBe(0);
            expect(next.bases[0].minions.some(minion => minion.uid === 'h3')).toBe(true);
        });

        it('consumesNormalLimit 未设置时 reducer 正常增加 minionsPlayed', () => {
            const state = makeNinjaOngoingState([makeBase({ minions: [] })]);
            state.players['0'].minionsPlayed = 0;
            const evt = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: '0',
                    cardUid: 'h3',
                    defId: 'test_minion_b',
                    baseIndex: 0,
                    power: 3,
                },
                timestamp: 1000,
            };
            const next = reduce(state, evt as any);
            expect(next.players['0'].minionsPlayed).toBe(1);
        });

        it('忍者侍从额外打出的枪手会继续接管当前交互并创建决斗选择', () => {
            clearInteractionHandlers();
            registerNinjaInteractionHandlers();
            registerCowboysAbilities();
            registerCowboysInteractionHandlers();

            const base = makeBase({
                defId: 'base_the_workshop',
                minions: [
                    makeNinjaOngoingMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0', owner: '0', basePower: 2 }),
                    makeNinjaOngoingMinion({ defId: 'pirate_first_mate', uid: 'opp-1', controller: '1', owner: '1', basePower: 2 }),
                ],
            });
            const templateState = makeNinjaOngoingState([base]);
            const state = makeNinjaOngoingState([base], {
                '0': {
                    ...templateState.players['0'],
                    hand: [makeCard('gun-1', 'cowboys_gunfighter', 'minion', '0')],
                    factions: [SMASHUP_FACTION_IDS.NINJAS, 'cowboys'],
                    minionsPlayed: 0,
                },
            });

            const activated = runCommand(
                makeMatchState(state),
                {
                    type: SU_COMMANDS.ACTIVATE_SPECIAL,
                    playerId: '0',
                    payload: { minionUid: 'ac-1', baseIndex: 0 },
                } as any,
                defaultTestRandom,
            );

            expect(activated.success).toBe(true);
            const acolytePrompt = getFirstPrompt(activated.finalState);
            expect(getPromptSourceId(acolytePrompt)).toBe('ninja_acolyte_play');

            const gunfighterOption = getPromptOption(
                acolytePrompt,
                option => option?.value?.defId === 'cowboys_gunfighter',
                'Acolyte Gunfighter play option',
            );
            const resolved = respondToPrompt(activated.finalState, gunfighterOption.id, '0', defaultTestRandom);

            expect(resolved.success).toBe(true);
            expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'gun-1')).toBe(true);
            const duelPrompt = getFirstPrompt(resolved.finalState);
            expect(getPromptSourceId(duelPrompt)).toBe('cowboys_gunfighter');

            const duelOptions = getPromptOptions(duelPrompt);
            expect(duelOptions.some(option => option?.value?.minionUid === 'opp-1')).toBe(true);
        });
    });
});
