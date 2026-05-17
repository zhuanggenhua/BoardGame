import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { registerKillerPlantAbilities } from '../../abilities/killer_plants';
import { clearRegistry } from '../../domain/abilityRegistry';
import type { AbilityContext } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import {
    clearOngoingEffectRegistry,
    fireTriggers,
    isMinionProtected,
} from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectiveBreakpoint } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reducer';
import type { MinionDestroyedEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getFirstPrompt,
    makeCard,
    getPromptHandlerData,
    getPromptOptions,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeMinion,
    makeMatchState,
    makePlayer,
    makeState,
    respondToPromptOption,
    withOnlyCurrentPrompt,
} from '../helpers';
import { runCommand } from '../testRunner';

const dummyRandom: RandomFn = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]) => [...arr],
    d: () => 1,
    range: (min: number) => min,
};

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('killer_plant_overgrowth 回合开始临界点修正', () => {
    it('控制者回合开始时把所在基地临界点降为 0', () => {
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.BREAKPOINT_MODIFIED,
                payload: expect.objectContaining({
                    baseIndex: 0,
                    delta: -12,
                    reason: 'killer_plant_overgrowth',
                }),
            }),
        );
    });

    it('POD 版控制者回合开始时也把所在基地临界点降为 0', () => {
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{ uid: 'og-pod-1', defId: 'killer_plant_overgrowth_pod', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.BREAKPOINT_MODIFIED,
                payload: expect.objectContaining({
                    baseIndex: 0,
                    delta: -12,
                }),
            }),
        );
    });

    it('非控制者回合开始时不修改临界点', () => {
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: dummyRandom,
            now: 0,
        });

        expect(events).not.toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.BREAKPOINT_MODIFIED,
                payload: expect.objectContaining({ reason: 'killer_plant_overgrowth' }),
            }),
        );
    });

    it('临界点修正事件经 reducer 后会影响有效临界点', () => {
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
            ],
        });

        const modified = reduce(state, {
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: { baseIndex: 0, delta: -12, reason: 'killer_plant_overgrowth' },
            timestamp: 0,
        });

        expect(getEffectiveBreakpoint(modified, 0)).toBe(0);
    });

    it('未经过 onTurnStart 时不会提前影响 scoreBases 阶段临界点', () => {
        const state = makeState({
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
            ],
        });

        expect(getEffectiveBreakpoint(state, 0)).toBe(12);
    });
});

describe('killer_plant_entangled 移动保护与回合开始自毁', () => {
    it('有己方随从的基地上所有随从都不能被移动', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion, enemyMinion],
                    ongoingActions: [{ uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' }],
                }),
            ],
        });

        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, enemyMinion, 0, '0', 'move')).toBe(true);
    });

    it('控制者回合开始时会自毁', () => {
        const state = makeState({
            bases: [
                makeBase({
                    ongoingActions: [{ uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({ defId: 'killer_plant_entangled' }),
            }),
        );
    });

    it('非控制者回合开始时不会自毁', () => {
        const state = makeState({
            bases: [
                makeBase({
                    ongoingActions: [{ uid: 'ent-1', defId: 'killer_plant_entangled', ownerId: '0' }],
                }),
            ],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: dummyRandom,
            now: 0,
        });

        expect(events).not.toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({ defId: 'killer_plant_entangled' }),
            }),
        );
    });
});

describe('killer_plant_venus_man_trap 牌库搜索', () => {
    it('牌库有多个力量不大于 2 的随从时创建牌库选择 prompt', () => {
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [trap] })],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        { uid: 'd1', defId: 'killer_plant_sprout', type: 'minion', owner: '0' },
                        { uid: 'd2', defId: 'killer_plant_sprout', type: 'minion', owner: '0' },
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'trap', baseIndex: 0 },
            } as any,
            dummyRandom,
        );

        expect(result.success).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'killer_plant_venus_man_trap_search');
        expect(getPromptSourceId(prompt)).toBe('killer_plant_venus_man_trap_search');
        expect(getPromptTargetType(prompt)).toBe('generic');
        expect(prompt?.autoRefresh ?? getPromptHandlerData(prompt).autoRefresh).toBe('deck');
    });

    it('牌库只有一个合格随从时自动抽入手牌、增加本回合随从次数并重排牌库', () => {
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [trap] })],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        { uid: 'd1', defId: 'killer_plant_sprout', type: 'minion', owner: '0' },
                        { uid: 'd2', defId: 'killer_plant_venus_man_trap', type: 'minion', owner: '0' },
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'trap', baseIndex: 0 },
            } as any,
            dummyRandom,
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toEqual([
            SU_EVENTS.TALENT_USED,
            SU_EVENTS.CARDS_DRAWN,
            SU_EVENTS.LIMIT_MODIFIED,
            SU_EVENTS.MINION_PLAYED,
            SU_EVENTS.DECK_REORDERED,
        ]);
        const minionPlayedEvent = result.events.find(event => event.type === SU_EVENTS.MINION_PLAYED);
        expect(minionPlayedEvent).toEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_PLAYED,
                payload: expect.objectContaining({ baseIndex: 0 }),
            }),
        );
    });

    it('牌库无合格随从时只重排牌库并发送能力反馈', () => {
        const trap = makeMinion('trap', 'killer_plant_venus_man_trap', '0', 5, { powerModifier: 0 });
        const state = makeState({
            bases: [makeBase({ minions: [trap] })],
            players: {
                '0': makePlayer('0', {
                    deck: [{ uid: 'd1', defId: 'killer_plant_venus_man_trap', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = invokeRegisteredAbilityContract('killer_plant_venus_man_trap', 'talent', {
            state,
            playerId: '0',
            cardUid: 'trap',
            defId: 'killer_plant_venus_man_trap',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        expect(result.events.map(event => event.type)).toEqual([SU_EVENTS.DECK_REORDERED, SU_EVENTS.ABILITY_FEEDBACK]);
    });

    it('交互响应会带上基地信息', () => {
        const state = makeState({
            bases: [
                makeBase({
                    defId: 'base_crypt',
                    minions: [makeMinion('vmt-1', 'killer_plant_venus_man_trap', '0', 3, { powerModifier: 0 })],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('sp-1', 'killer_plant_sprout', 'minion', '0'),
                        makeCard('sp-2', 'killer_plant_sprout', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const firstStep = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'vmt-1', baseIndex: 0 },
            } as any,
            dummyRandom,
        );
        expect(firstStep.success, firstStep.error).toBe(true);
        const resolved = respondToPromptOption(
            firstStep.finalState,
            option => option.value?.cardUid === 'sp-1',
            'venus man trap sp-1 option',
            '0',
            dummyRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);

        const playedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
        expect(playedEvent).toBeDefined();
        expect(playedEvent.payload.cardUid).toBe('sp-1');
        expect(playedEvent.payload.baseIndex).toBe(0);
        expect(playedEvent.payload.baseDefId).toBe('base_crypt');
    });

    it('交互目标已离开牌库时不会重复打出', () => {
        const initialState = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('vmt-1', 'killer_plant_venus_man_trap', '0', 3, { powerModifier: 0 })],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('sp-1', 'killer_plant_sprout', 'minion', '0'),
                        makeCard('sp-3', 'killer_plant_sprout', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const staleState = makeState({
            bases: [
                makeBase({
                    minions: [makeMinion('vmt-1', 'killer_plant_venus_man_trap', '0', 3, { powerModifier: 0 })],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('sp-2', 'killer_plant_sprout', 'minion', '0'),
                        makeCard('wl-2', 'killer_plant_water_lily', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const firstStep = runCommand(
            makeMatchState(initialState),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'vmt-1', baseIndex: 0 },
            } as any,
            dummyRandom,
        );
        expect(firstStep.success, firstStep.error).toBe(true);
        const prompt = getSimpleChoicePrompt(firstStep.finalState, 'killer_plant_venus_man_trap_search');

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt({ ...firstStep.finalState, core: staleState } as any, prompt),
            option => option.value?.cardUid === 'sp-1',
            'venus man trap stale sp-1 option',
            '0',
            dummyRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);

        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(resolved.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
        expect(getPromptSourceId(getFirstPrompt(resolved.finalState))).toBe('killer_plant_venus_man_trap_search');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['sp-2', 'wl-2']);
    });
});

describe('killer_plant_water_lily 回合开始抽牌', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearPowerModifierRegistry();
        clearOngoingEffectRegistry();
        clearInteractionHandlers();
        registerKillerPlantAbilities();
    });

    const makeWaterLilyState = (
        minions: Array<ReturnType<typeof makeMinion>>,
        playerZeroOverrides: Parameters<typeof makePlayer>[1] = {},
    ) => makeState({
        bases: [makeBase({ minions })],
        players: {
            '0': makePlayer('0', {
                deck: [makeCard('draw-1', 'deck_minion_1', 'minion', '0')],
                ...playerZeroOverrides,
            }),
            '1': makePlayer('1'),
        },
    });

    it('控制者回合开始时抽 1 牌', () => {
        const state = makeWaterLilyState([
            makeMinion('wl-1', 'killer_plant_water_lily', '0', 3, { powerModifier: 0 }),
        ]);

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
    });

    it('POD 版控制者回合开始时也抽 1 牌', () => {
        const state = makeWaterLilyState([
            makeMinion('wl-pod-1', 'killer_plant_water_lily_pod', '0', 3, { powerModifier: 0 }),
        ]);

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
    });

    it('牌库空但弃牌堆有牌时先洗回再抽牌', () => {
        const state = makeWaterLilyState(
            [makeMinion('wl-1', 'killer_plant_water_lily', '0', 3, { powerModifier: 0 })],
            {
                deck: [],
                discard: [makeCard('discard-1', 'deck_minion_1', 'minion', '0')],
            },
        );

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        expect(events.map(event => event.type)).toEqual([SU_EVENTS.DECK_RESHUFFLED, SU_EVENTS.CARDS_DRAWN]);
        expect((events[1] as any).payload.cardUids).toEqual(['discard-1']);
    });

    it('非控制者回合不触发', () => {
        const state = makeWaterLilyState([
            makeMinion('wl-1', 'killer_plant_water_lily', '0', 3, { powerModifier: 0 }),
        ]);

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '1',
            random: dummyRandom,
            now: 1000,
        });

        expect(events).toHaveLength(0);
    });

    it('多张睡莲在场每回合也只触发一次', () => {
        const state = makeWaterLilyState([
            makeMinion('wl-1', 'killer_plant_water_lily', '0', 3, { powerModifier: 0 }),
            makeMinion('wl-2', 'killer_plant_water_lily', '0', 3, { powerModifier: 0 }),
            makeMinion('wl-3', 'killer_plant_water_lily', '0', 3, { powerModifier: 0 }),
        ]);

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
    });
});

describe('killer_plant_sprout 回合开始自毁与检索', () => {
    it('控制者回合开始时消灭自身并搜索随从', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('sp-1', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] })],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        expect(events.length).toBeGreaterThanOrEqual(1);
        expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
        expect((events[0] as any).payload.minionUid).toBe('sp-1');
        if (events.length > 1) {
            expect([SU_EVENTS.CARDS_DRAWN, SU_EVENTS.DECK_REORDERED]).toContain(events[1].type);
        }
    });

    it('POD 版控制者回合开始时也会消灭自身并搜索随从', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('sp-pod-1', 'killer_plant_sprout_pod', '0', 2, { owner: '0', powerModifier: 0 })] })],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        expect(events.length).toBeGreaterThanOrEqual(1);
        expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
        expect((events[0] as any).payload.minionUid).toBe('sp-pod-1');
    });

    it('多个候选时创建 generic 牌库检索交互', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('sp-1', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] })],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('d1', 'killer_plant_sprout', 'minion', '0'),
                        makeCard('d2', 'wizard_neophyte', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const matchState = {
            core: state,
            sys: { phase: 'startTurn', interaction: { current: undefined, queue: [] } },
        } as any;

        const result = fireTriggers(state, 'onTurnStart', {
            state,
            matchState,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        const current = getSimpleChoicePrompt(result.matchState as any, 'killer_plant_sprout_search');
        expect(getPromptSourceId(current)).toBe('killer_plant_sprout_search');
        expect(getPromptTargetType(current)).toBe('generic');
        const promptData = getPromptHandlerData(current);
        expect(promptData.autoRefresh).toBe('deck');
        expect(promptData.responseValidationMode).toBe('live');
        expect(getPromptOptions(current).some((opt: any) => opt.id === 'skip')).toBe(true);
        expect(getPromptOptions(current).filter((opt: any) => opt.displayMode === 'card')).toHaveLength(2);
    });

    it('多个嫩芽共享唯一候选时不会重复打出同一 UID', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('sp-1', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] }),
                makeBase({ minions: [makeMinion('sp-2', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] }),
            ],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('wl-1', 'killer_plant_water_lily', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        const playedEvents = events.filter(event => event.type === SU_EVENTS.MINION_PLAYED);
        expect(playedEvents).toHaveLength(1);
        expect((playedEvents[0] as any).payload.cardUid).toBe('wl-1');
    });

    it('多个嫩芽在不同基地会分别消灭自身', () => {
        const state = makeState({
            bases: [
                makeBase({ minions: [makeMinion('sp-1', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] }),
                makeBase({ minions: [makeMinion('sp-2', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] }),
            ],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        const destroyedEvents = events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyedEvents).toHaveLength(2);
        const destroyedUids = destroyedEvents.map(event => (event as any).payload.minionUid).sort();
        expect(destroyedUids).toEqual(['sp-1', 'sp-2']);
    });

    it('交互在卡已离开牌库后不会再次打出同一 UID', () => {
        const initialState = makeState({
            bases: [makeBase({ minions: [makeMinion('sp-1', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] })],
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('wl-1', 'killer_plant_water_lily', 'minion', '0'),
                        makeCard('sp-1-deck', 'killer_plant_sprout', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const staleState = makeState({
            bases: [makeBase()],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('wl-2', 'killer_plant_water_lily', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = {
            core: initialState,
            sys: { phase: 'startTurn', interaction: { current: undefined, queue: [] } },
        } as any;

        const promptState = fireTriggers(initialState, 'onTurnStart', {
            state: initialState,
            matchState,
            playerId: '0',
            random: dummyRandom,
            now: 999,
        }).matchState as any;
        const prompt = getSimpleChoicePrompt(promptState, 'killer_plant_sprout_search');

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt({ ...promptState, core: staleState } as any, prompt),
            option => option.value?.cardUid === 'wl-1',
            'killer plant sprout stale wl-1 option',
            '0',
            dummyRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);

        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(getPromptSourceId(getFirstPrompt(resolved.finalState))).toBe('killer_plant_sprout_search');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['wl-2']);
    });
});

describe('killer_plant_blossom 同名额外随从额度', () => {
    it('打出后给予 3 个同名额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bl-1', 'killer_plant_blossom', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'bl-1' },
            } as any,
            dummyRandom,
        );

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(result.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(limitEvents).toHaveLength(3);
        limitEvents.forEach(event => {
            expect((event as any).payload.limitType).toBe('minion');
            expect((event as any).payload.sameNameOnly).toBe(true);
        });
        expect(result.finalState.core.players['0'].sameNameMinionRemaining).toBe(3);
        expect(result.finalState.core.players['0'].sameNameMinionDefId).toBeNull();
        expect(result.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(result.finalState.core.players['0'].hand).toHaveLength(0);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('bl-1');
    });
});

describe('killer_plant_budding 场上随从选择', () => {
    it('场上有随从时创建随从选择 prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bud-1', 'killer_plant_budding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ minions: [makeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 })] })],
        });
        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'bud-1' },
            } as any,
            dummyRandom,
        );

        expect(result.success).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'killer_plant_budding_choose');
        expect(getPromptSourceId(prompt)).toBe('killer_plant_budding_choose');
        expect(getPromptTargetType(prompt)).toBe('minion');
    });

    it('场上无随从时不产生事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bud-1', 'killer_plant_budding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });
        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'bud-1' },
            } as any,
            dummyRandom,
        );

        expect(result.success).toBe(true);
        expect(result.events.map(event => event.type)).toEqual([SU_EVENTS.ACTION_PLAYED]);
    });
});

describe('killer_plant_insta_grow 额外随从额度', () => {
    it('给予额外随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect(limitEvents[0]).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({
                    limitType: 'minion',
                    delta: 1,
                }),
            }),
        );
    });

    it('off-phase 额外随从应标记为 immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });

        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';

        const result = invokeRegisteredAbilityContract('killer_plant_insta_grow', 'onPlay', {
            state,
            matchState,
            playerId: '0',
            cardUid: 'a1',
            defId: 'killer_plant_insta_grow',
            baseIndex: 0,
            random: dummyRandom,
            now: 1000,
        } as AbilityContext);

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect(limitEvents[0]).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({
                    playTiming: 'immediate',
                }),
            }),
        );
    });

    it('额度正确累加到最终状态', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'killer_plant_insta_grow', 'action', '0')],
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1' },
            } as any,
            dummyRandom,
        );

        expect(result.finalState.core.players['0'].minionLimit).toBe(2);
    });
});

describe('killer_plant_weed_eater 打出回合力量修正', () => {
    it('打出时获得 -2 力量修正事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'killer_plant_weed_eater', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'm1', baseIndex: 0 },
            } as any,
            dummyRandom,
        );

        const powerEvents = result.events.filter(event => event.type === SU_EVENTS.TEMP_POWER_ADDED);
        expect(powerEvents).toHaveLength(1);
        expect(powerEvents[0]).toEqual(
            expect.objectContaining({
                payload: expect.objectContaining({
                    minionUid: 'm1',
                    amount: -2,
                }),
            }),
        );
    });

    it('力量修正正确应用到最终状态', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'killer_plant_weed_eater', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });

        const result = runCommand(
            makeMatchState(state),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'm1', baseIndex: 0 },
            } as any,
            dummyRandom,
        );

        const minion = result.finalState.core.bases[0].minions.find(candidate => candidate.uid === 'm1');
        expect(minion).toBeDefined();
        expect(minion?.tempPowerModifier).toBe(-2);
    });
});

describe('killer_plant_deep_roots 移动保护', () => {
    it('对手不能移动 Deep Roots 所在基地上的拥有者随从', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
                }),
            ],
        });

        expect(isMinionProtected(state, myMinion, 0, '1', 'move')).toBe(true);
    });

    it('不保护对手随从', () => {
        const enemy = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [enemy],
                    ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
                }),
            ],
        });

        expect(isMinionProtected(state, enemy, 0, '0', 'move')).toBe(false);
    });

    it('不阻止拥有者移动自己的随从', () => {
        const myMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [myMinion],
                    ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
                }),
            ],
        });

        expect(isMinionProtected(state, myMinion, 0, '0', 'move')).toBe(false);
    });
});

describe('killer_plant_choking_vines 回合开始触发', () => {
    it('消灭附着 Choking Vines 的随从', () => {
        const target = makeMinion('m1', 'test_minion', '1', 5, {
            attachedActions: [{ uid: 'cv-1', defId: 'killer_plant_choking_vines', ownerId: '0' }],
        });
        const state = makeState({
            bases: [makeBase({ minions: [target, makeMinion('m2', 'test_minion', '1', 2, { powerModifier: 0 })] })],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({ minionUid: 'm1' }),
            } as Partial<MinionDestroyedEvent>),
        );
    });

    it('不会消灭未附着 Choking Vines 的随从', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('m1', 'test_minion', '1', 5, { powerModifier: 0 })] })],
        });

        const { events } = fireTriggers(state, 'onTurnStart', {
            state,
            playerId: '0',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        });

        expect(events).not.toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({ minionUid: 'm1' }),
            } as Partial<MinionDestroyedEvent>),
        );
    });
});
