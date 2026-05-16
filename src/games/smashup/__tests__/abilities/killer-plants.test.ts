import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveAbility } from '../../domain/abilityRegistry';
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
import { SU_EVENTS } from '../../domain/types';
import {
    getPromptHandlerData,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';

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
        const matchState = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } };
        const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');

        const result = executor!({
            state,
            matchState,
            playerId: '0',
            cardUid: 'trap',
            defId: 'killer_plant_venus_man_trap',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        const prompt = getSimpleChoicePrompt(result.matchState!, 'killer_plant_venus_man_trap_search');
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
        const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');

        const result = executor!({
            state,
            playerId: '0',
            cardUid: 'trap',
            defId: 'killer_plant_venus_man_trap',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        expect(result.events.map(event => event.type)).toEqual([
            SU_EVENTS.CARDS_DRAWN,
            SU_EVENTS.LIMIT_MODIFIED,
            SU_EVENTS.MINION_PLAYED,
            SU_EVENTS.DECK_REORDERED,
        ]);
        expect(result.events[2]).toEqual(
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
        const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');

        const result = executor!({
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
});

describe('killer_plant_budding 场上随从选择', () => {
    it('场上有随从时创建随从选择 prompt', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 })] })],
        });
        const matchState = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } };
        const executor = resolveAbility('killer_plant_budding', 'onPlay');

        const result = executor!({
            state,
            matchState,
            playerId: '0',
            cardUid: 'bud-1',
            defId: 'killer_plant_budding',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        const prompt = getSimpleChoicePrompt(result.matchState!, 'killer_plant_budding_choose');
        expect(getPromptSourceId(prompt)).toBe('killer_plant_budding_choose');
        expect(getPromptTargetType(prompt)).toBe('minion');
    });

    it('场上无随从时不产生事件', () => {
        const state = makeState({ bases: [makeBase()] });
        const executor = resolveAbility('killer_plant_budding', 'onPlay');

        const result = executor!({
            state,
            playerId: '0',
            cardUid: 'bud-1',
            defId: 'killer_plant_budding',
            baseIndex: 0,
            random: dummyRandom,
            now: 0,
        } as AbilityContext);

        expect(result.events).toEqual([]);
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
