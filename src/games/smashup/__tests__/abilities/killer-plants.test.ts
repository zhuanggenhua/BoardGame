import { beforeEach, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { registerKillerPlantAbilities } from '../../abilities/killer_plants';
import { clearRegistry } from '../../domain/abilityRegistry';
import type { AbilityContext } from '../../domain/abilityRegistry';
import { getMinionPower } from '../../domain/abilityHelpers';
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
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { getCardDef, getMinionDef } from '../../data/cards';
import {
    expectNoPrompt,
    getFirstPrompt,
    makeCard,
    getPromptHandlerData,
    getPromptOption,
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
    respondToPrompt,
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

beforeEach(() => {
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

    it('结算并换上新基地后不应继承旧基地的 0 临界点修正', () => {
        const state = makeState({
            currentPlayerIndex: 0,
            baseDeck: ['base_the_jungle'],
            bases: [
                makeBase({
                    defId: 'base_secret_garden',
                    ongoingActions: [{ uid: 'og-1', defId: 'killer_plant_overgrowth', ownerId: '0' }],
                }),
            ],
        });

        const modified = reduce(state, {
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: {
                baseIndex: 0,
                baseDefId: 'base_secret_garden',
                delta: -21,
                reason: 'killer_plant_overgrowth',
            },
            timestamp: 0,
        });
        expect(getEffectiveBreakpoint(modified, 0)).toBe(0);

        const cleared = reduce(modified, {
            type: SU_EVENTS.BASE_CLEARED,
            payload: { baseIndex: 0, baseDefId: 'base_secret_garden' },
            timestamp: 1,
        });
        const replaced = reduce(cleared, {
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex: 0,
                oldBaseDefId: 'base_secret_garden',
                newBaseDefId: 'base_the_jungle',
            },
            timestamp: 1,
        });

        expect(replaced.bases[0].defId).toBe('base_the_jungle');
        expect(getEffectiveBreakpoint(replaced, 0)).toBe(12);
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

    it('borrowed Entangled 在只有控制者随从而没有真实 owner 随从时，也应按控制者触发保护', () => {
        const controllerMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [controllerMinion, enemyMinion],
                    ongoingActions: [{
                        uid: 'ent-borrowed',
                        defId: 'killer_plant_entangled',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
            ],
        });

        expect(isMinionProtected(state, controllerMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, enemyMinion, 0, '1', 'move')).toBe(true);
    });

    it('同一基地上若同时有两张不同控制者的 Entangled，不应因第一张同名来源而放行对手移动', () => {
        const controllerMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [controllerMinion, enemyMinion],
                    ongoingActions: [
                        { uid: 'ent-owner', defId: 'killer_plant_entangled', ownerId: '1' } as any,
                        {
                            uid: 'ent-borrowed',
                            defId: 'killer_plant_entangled',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any,
                    ],
                }),
            ],
        });

        expect(isMinionProtected(state, controllerMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, enemyMinion, 0, '1', 'move')).toBe(true);
    });

    it('borrowed Entangled 不应把控制者自己的 borrowed 效果误判成“其他玩家的卡牌影响”而被 In Plain Sight 抵消', () => {
        const controllerWeakMinion = makeMinion('weak-0', 'test_minion', '0', 2, {
            owner: '0',
            powerModifier: 0,
            tempPowerModifier: 0,
        });
        const enemyMinion = makeMinion('enemy-1', 'test_minion', '1', 3, {
            owner: '1',
            powerModifier: 0,
            tempPowerModifier: 0,
        });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [controllerWeakMinion, enemyMinion],
                    ongoingActions: [
                        {
                            uid: 'ips-borrowed',
                            defId: 'innsmouth_in_plain_sight',
                            ownerId: '1',
                            metadata: { sourcePlayerId: '0', sourceControllerId: '0' },
                        } as any,
                        {
                            uid: 'ent-borrowed',
                            defId: 'killer_plant_entangled',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any,
                    ],
                }),
            ],
        });

        expect(isMinionProtected(state, controllerWeakMinion, 0, '1', 'affect')).toBe(true);
        expect(isMinionProtected(state, controllerWeakMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, enemyMinion, 0, '1', 'move')).toBe(true);
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

    it('牌库只有一个合格随从时仍创建选择 prompt，玩家确认后打出', () => {
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
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(result.finalState, 'killer_plant_venus_man_trap_search');
        expect(getPromptSourceId(prompt)).toBe('killer_plant_venus_man_trap_search');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.cardUid === 'd1',
            'venus man trap single candidate option',
            '0',
            dummyRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        const minionPlayedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_PLAYED);
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
        expect((events[0] as any).payload.destroyerId).toBe('0');
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

    it('真实交互下嫩芽只有一个合格候选时仍等待玩家确认', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('sp-1', 'killer_plant_sprout', '0', 2, { owner: '0', powerModifier: 0 })] })],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('wl-1', 'killer_plant_water_lily', 'minion', '0')],
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

        expect(result.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        const current = getSimpleChoicePrompt(result.matchState as any, 'killer_plant_sprout_search');
        expect(getPromptSourceId(current)).toBe('killer_plant_sprout_search');
        expect(getPromptHandlerData(current).autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(current).filter((opt: any) => opt.displayMode === 'card')).toHaveLength(1);

        const resolved = respondToPromptOption(
            result.matchState as any,
            option => option.value?.cardUid === 'wl-1',
            'sprout single candidate option',
            '0',
            dummyRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(true);
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

    it('同一基地上若同时有两张不同控制者的 deep_roots，不应因第一张同名来源而放行对手移动', () => {
        const controllerMinion = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const enemyMinion = makeMinion('e1', 'test_minion', '1', 3, { powerModifier: 0 });
        const state = makeState({
            bases: [
                makeBase({
                    minions: [controllerMinion, enemyMinion],
                    ongoingActions: [
                        { uid: 'dr-owner', defId: 'killer_plant_deep_roots', ownerId: '1' } as any,
                        {
                            uid: 'dr-borrowed',
                            defId: 'killer_plant_deep_roots',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any,
                    ],
                }),
            ],
        });

        expect(isMinionProtected(state, controllerMinion, 0, '1', 'move')).toBe(true);
        expect(isMinionProtected(state, enemyMinion, 0, '1', 'move')).toBe(false);
        expect(isMinionProtected(state, enemyMinion, 0, '0', 'move')).toBe(true);
        expect(isMinionProtected(state, controllerMinion, 0, '0', 'move')).toBe(false);
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
                payload: expect.objectContaining({ minionUid: 'm1', destroyerId: '0' }),
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

describe('killer_plants POD 数据与特殊回归', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearPowerModifierRegistry();
        clearOngoingEffectRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    it('Sleep Spores POD 与 Budding POD 使用 POD 牌表数量', () => {
        const sleepSporesDef = getCardDef('killer_plant_sleep_spores_pod');
        const buddingDef = getCardDef('killer_plant_budding_pod');

        expect(sleepSporesDef?.count).toBe(2);
        expect(buddingDef?.count).toBe(1);
    });

    it('Weed Eater POD 使用 POD 卡面，不再继承原版进场 debuff', () => {
        const weedEaterDef = getMinionDef('killer_plant_weed_eater_pod');
        expect(weedEaterDef?.power).toBe(3);
        expect(weedEaterDef?.abilityTags).toContain('ongoing');

        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    hand: [makeCard('we-card', 'killer_plant_weed_eater_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'we-card', baseIndex: 0 },
            timestamp: 1000,
        });

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);

        const playedWeedEater = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'we-card');
        expect(playedWeedEater).toBeDefined();
        expect(playedWeedEater?.basePower).toBe(3);
        expect(getMinionPower(result.finalState.core, playedWeedEater!, 0)).toBe(3);
    });

    it('Weed Eater POD 在控制者回合开始时获得 +2 力量', () => {
        const weedEater = makeMinion('we-1', 'killer_plant_weed_eater_pod', '0', 3);
        const core = makeState({
            bases: [makeBase({ defId: 'base1', minions: [weedEater] })],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        expect(getMinionPower(core, core.bases[0].minions[0], 0)).toBe(3);

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1001,
        });

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_METADATA_UPDATED)).toBe(true);

        const empowered = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'we-1');
        expect(empowered).toBeDefined();
        expect((empowered?.metadata as any)?.weedEaterEmpowered).toBe(true);
        expect(getMinionPower(result.finalState.core, empowered!, 0)).toBe(5);
    });

    it('Sprout POD 被 General Ivan 保护时，仍应继续完成检索', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base1',
                minions: [
                    makeMinion('ivan-1', 'bear_cavalry_general_ivan_pod', '0', 5),
                    makeMinion('sprout-1', 'killer_plant_sprout_pod', '0', 2),
                ],
            })],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    deck: [makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1002,
        });

        expect(result.success).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(result.finalState, 'killer_plant_sprout_search');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.cardUid === 'wl-1',
            'protected sprout single deck candidate',
            '0',
            dummyRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);

        const minionUids = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(minionUids).toContain('sprout-1');
        expect(minionUids).toContain('wl-1');
    });

    it('进入 playCards 后再手打 Sprout POD 时，不应误当作 startTurn 自动触发', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [makeBase({ defId: 'base1' })],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    hand: [makeCard('sprout-hand', 'killer_plant_sprout_pod', 'minion', '0')],
                    deck: [makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'playCards';

        const turnResult = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1002,
        });

        expect(turnResult.success).toBe(true);
        expect(turnResult.finalState.sys.phase).toBe('playCards');
        expect((turnResult.finalState.sys as any)._smashupStartTurnWindowActive).toBeUndefined();

        const playResult = runCommand(turnResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'sprout-hand', baseIndex: 0 },
            timestamp: 1003,
        });

        expect(playResult.success).toBe(true);
        expect(playResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expect(playResult.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expectNoPrompt(playResult.finalState);
        expect(playResult.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('sprout-hand');
    });

    it('进入 playCards 后通过 Venus Man Trap POD 打出 Sprout POD，也不应回补 startTurn 触发', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            bases: [makeBase({ defId: 'base1' })],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    hand: [makeCard('venus-hand', 'killer_plant_venus_man_trap_pod', 'minion', '0')],
                    deck: [makeCard('sprout-deck', 'killer_plant_sprout_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'playCards';

        const turnResult = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1004,
        });

        expect(turnResult.success).toBe(true);
        expect(turnResult.finalState.sys.phase).toBe('playCards');

        const playVenusResult = runCommand(turnResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'venus-hand', baseIndex: 0 },
            timestamp: 1005,
        });

        expect(playVenusResult.success).toBe(true);

        const talentResult = runCommand(playVenusResult.finalState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'venus-hand', baseIndex: 0 },
            timestamp: 1006,
        });

        expect(talentResult.success).toBe(true);
        expect(talentResult.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        const prompt = getSimpleChoicePrompt(talentResult.finalState, 'killer_plant_venus_man_trap_search');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            talentResult.finalState,
            option => option.value?.cardUid === 'sprout-deck',
            'venus pod single sprout candidate',
            '0',
            dummyRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);

        const drawEvents = resolved.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(1);
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['sprout-deck']);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        expectNoPrompt(resolved.finalState);
        const finalMinionUids = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(finalMinionUids).toContain('venus-hand');
        expect(finalMinionUids).toContain('sprout-deck');
    });

    it('Sprout POD 在同一个 startTurn 窗口打出 Water Lily POD 时应立即继续抽牌', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base1',
                minions: [makeMinion('sprout-1', 'killer_plant_sprout_pod', '0', 2)],
            })],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    deck: [
                        makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0'),
                        makeCard('bud-1', 'killer_plant_budding_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1003,
        });

        expect(result.success).toBe(true);
        expect(result.finalState.sys.phase).toBe('startTurn');
        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        const prompt = getSimpleChoicePrompt(result.finalState, 'killer_plant_sprout_search');
        expect(getPromptHandlerData(prompt).autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            result.finalState,
            option => option.value?.cardUid === 'wl-1',
            'sprout pod single water lily candidate',
            '0',
            dummyRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);

        const drawEvents = resolved.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(2);
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['wl-1']);
        expect((drawEvents[1] as any).payload.cardUids).toEqual(['bud-1']);

        const finalBaseMinionUids = resolved.finalState.core.bases[0].minions.map(minion => minion.uid);
        expect(finalBaseMinionUids).toContain('wl-1');
        expect(finalBaseMinionUids).not.toContain('sprout-1');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['bud-1']);
        expect(resolved.finalState.core.players['0'].deck).toHaveLength(0);
    });

    it('Sprout POD 交互响应打出 Water Lily POD 时，仍应留在同一个 startTurn 窗口内继续抽牌', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base1',
                minions: [makeMinion('sprout-1', 'killer_plant_sprout_pod', '0', 2)],
            })],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    deck: [
                        makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0'),
                        makeCard('we-1', 'killer_plant_weed_eater_pod', 'minion', '0'),
                        makeCard('bud-1', 'killer_plant_budding_pod', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1004,
        });

        expect(result.success).toBe(true);
        expect(result.finalState.sys.phase).toBe('startTurn');
        const interaction = getSimpleChoicePrompt(result.finalState, 'killer_plant_sprout_search');
        const waterLilyOption = getPromptOption(interaction, option => option.value?.cardUid === 'wl-1', 'Water Lily option');

        const respondResult = respondToPrompt(result.finalState, waterLilyOption.id, '0');

        expect(respondResult.success).toBe(true);
        const drawEvents = respondResult.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        const drawUids = drawEvents.flatMap(event => (event as any).payload.cardUids ?? []);
        expect(drawUids).toEqual(expect.arrayContaining(['wl-1', 'we-1']));
        expect(respondResult.finalState.core.players['0'].hand.map(card => card.uid)).toContain('we-1');
        expect(respondResult.finalState.sys.phase).toBe('playCards');
        expectNoPrompt(respondResult.finalState);
    });

    it('Sprout POD 连锁打出另一个 Sprout POD 时，应保持在 startTurn 直到整条链结束', () => {
        const core = makeState({
            bases: [makeBase({
                defId: 'base_ninja_dojo',
                minions: [makeMinion('sprout-1', 'killer_plant_sprout_pod', '0', 2)],
            })],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                    deck: [
                        makeCard('sprout-2', 'killer_plant_sprout_pod', 'minion', '0'),
                        makeCard('sprout-3', 'killer_plant_sprout_pod', 'minion', '0'),
                        makeCard('wl-1', 'killer_plant_water_lily_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'endTurn';

        const startTurnResult = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '1',
            payload: undefined,
            timestamp: 1100,
        });

        expect(startTurnResult.success).toBe(true);
        expect(startTurnResult.finalState.sys.phase).toBe('startTurn');
        const firstInteraction = getSimpleChoicePrompt(startTurnResult.finalState, 'killer_plant_sprout_search');
        const sproutOption = getPromptOption(firstInteraction, option => option.value?.cardUid === 'sprout-2', 'Sprout option');

        const firstRespondResult = respondToPrompt(startTurnResult.finalState, sproutOption.id, '0');

        expect(firstRespondResult.success).toBe(true);
        expect(firstRespondResult.finalState.sys.phase).toBe('startTurn');
        const secondInteraction = getSimpleChoicePrompt(firstRespondResult.finalState, 'killer_plant_sprout_search');
        const waterLilyOption = getPromptOption(secondInteraction, option => option.value?.cardUid === 'wl-1', 'Water Lily option');

        const secondRespondResult = respondToPrompt(firstRespondResult.finalState, waterLilyOption.id, '0');

        expect(secondRespondResult.success).toBe(true);
        expect(secondRespondResult.finalState.sys.phase).toBe('playCards');
        expectNoPrompt(secondRespondResult.finalState);
        expect(secondRespondResult.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['wl-1']);
    });

    it('爆破点被压到 0 后进入计分阶段时，只应产生一次 BASE_SCORED', () => {
        const core = makeState({
            tempBreakpointModifiers: { 0: -999 },
            bases: [makeBase({
                defId: 'base_the_jungle',
                minions: [makeMinion('m1', 'killer_plant_weed_eater_pod', '0', 3)],
            })],
            players: {
                '0': makePlayer('0', {
                    factions: [SMASHUP_FACTION_IDS.KILLER_PLANTS_POD, SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'playCards';

        const result = runCommand(matchState, {
            type: 'ADVANCE_PHASE' as any,
            playerId: '0',
            payload: undefined,
            timestamp: 1200,
        });

        expect(result.success).toBe(true);
        expect(result.events.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(1);
        expect(result.events.filter(event => event.type === SU_EVENTS.BASE_CLEARED)).toHaveLength(1);
        expect(result.events.filter(event => event.type === SU_EVENTS.BASE_REPLACED)).toHaveLength(1);
        expect((result.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil).toBeUndefined();
        expect(result.finalState.sys.phase).not.toBe('scoreBases');
    });
});
