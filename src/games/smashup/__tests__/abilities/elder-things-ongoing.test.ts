import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import { reduce } from '../../domain/reducer';
import { startSmashUpReactionSession } from '../../domain/reactionSession';
import { validate } from '../../domain/commands';
import type { CardInstance, CardToDeckBottomEvent } from '../../domain/types';
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptHandlerData,
    getPromptOption,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
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

function attachBeforeScoringWindow(core: ReturnType<typeof makeState>, sourceBaseIndex = 0, activePlayerId = '0') {
    const matchState = startSmashUpReactionSession(makeMatchState(core), {
        frameId: `score-before:${sourceBaseIndex}:test`,
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId,
        currentPlayerId: activePlayerId,
        consecutivePasses: 0,
        sourceBaseIndex,
        responseWindowType: 'meFirst',
    });
    matchState.sys.phase = 'scoreBases';
    matchState.sys.responseWindow = { ...(matchState.sys.responseWindow ?? {}), current: undefined } as any;
    return matchState as any;
}

describe('elder_thing_dunwich_horror 附着行动', () => {
    it('附着此卡的随从获得 +5 力量', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        expect(getEffectivePower(state, minion, 0)).toBe(8);
    });

    it('回合结束时消灭附着此卡的随从', () => {
        const minion = makeMinion('m1', 'test_minion', '0', 3, {
            attachedActions: [{ uid: 'dh-1', defId: 'elder_thing_dunwich_horror', ownerId: '0' }],
        });
        const state = makeState({ bases: [makeBase({ minions: [minion] })] });

        const { events } = fireTriggers(state, 'onTurnEnd', {
            state,
            playerId: '0',
            random: dummyRandom,
            now: 0,
        });

        expect(events).toContainEqual(
            expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({ minionUid: 'm1' }),
            }),
        );
    });
});

describe('elder_thing_the_price_of_power special', () => {
    it('对手在计分基地有随从且手牌有疯狂卡时给己方随从加力量', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [
                makeBase('base_the_jungle', [
                    makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 }),
                    makeMinion('e1', 'test_minion', '1', 4, { powerModifier: 0 }),
                ]),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'pop-1', defId: 'elder_thing_the_price_of_power', type: 'action', owner: '0' }],
                }),
                '1': makePlayer('1', {
                    hand: [
                        { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '1' },
                        { uid: 'mad2', defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '1' },
                        { uid: 'normal', defId: 'elder_thing_insanity', type: 'action' as const, owner: '1' },
                    ],
                }),
            },
        });
        const result = runCommand(attachBeforeScoringWindow(core, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pop-1', targetBaseIndex: 0 },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(true);
        const powerEvents = result.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(powerEvents).toHaveLength(2);
        expect(powerEvents.every(event => (event as any).payload.amount === 2)).toBe(true);
    });

    it('对手在此基地无随从时打出后不产生额外效果', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [makeBase('base_the_jungle', [makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 })])],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'pop-1', defId: 'elder_thing_the_price_of_power', type: 'action', owner: '0' }],
                }),
                '1': makePlayer('1', {
                    hand: [{ uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action' as const, owner: '1' }],
                }),
            },
        });
        const result = runCommand(attachBeforeScoringWindow(core, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pop-1', targetBaseIndex: 0 },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        expect(result.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(false);
    });

    it('对手手牌无疯狂卡时不触发', () => {
        const core = makeState({
            scoringEligibleBaseIndices: [0],
            bases: [
                makeBase('base_the_jungle', [
                    makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 }),
                    makeMinion('e1', 'test_minion', '1', 4, { powerModifier: 0 }),
                ]),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'pop-1', defId: 'elder_thing_the_price_of_power', type: 'action', owner: '0' }],
                }),
                '1': makePlayer('1', {
                    hand: [{ uid: 'normal', defId: 'elder_thing_insanity', type: 'action' as const, owner: '1' }],
                }),
            },
        });
        const result = runCommand(attachBeforeScoringWindow(core, 0, '0'), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'pop-1', targetBaseIndex: 0 },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(false);
        const revealEvt = result.events.find(event => event.type === SU_EVENTS.REVEAL_HAND) as any;
        expect(revealEvt?.payload?.targetPlayerId).toBe('1');
    });
});

describe('elder_thing_elder_thing 保护', () => {
    it('对手不能消灭远古之物', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [elderThing] })] });

        expect(isMinionProtected(state, elderThing, 0, '1', 'destroy')).toBe(true);
    });

    it('对手不能移动远古之物', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [elderThing] })] });

        expect(isMinionProtected(state, elderThing, 0, '1', 'move')).toBe(true);
    });

    it('不阻止己方消灭远古之物', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [elderThing] })] });

        expect(isMinionProtected(state, elderThing, 0, '0', 'destroy')).toBe(false);
    });

    it('不保护其他随从', () => {
        const elderThing = makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 });
        const other = makeMinion('m1', 'test_minion', '0', 3, { powerModifier: 0 });
        const state = makeState({ bases: [makeBase({ minions: [elderThing, other] })] });

        expect(isMinionProtected(state, other, 0, '1', 'destroy')).toBe(false);
    });
});

describe('elder_thing_elder_thing onPlay prompt', () => {
    it('不足两个其他随从时仍创建选择 prompt，但消灭选项禁用', () => {
        const state = makeState({
            bases: [makeBase()],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'et-1', defId: 'elder_thing_elder_thing', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'et-1', baseIndex: 0 },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'elder_thing_elder_thing_choice');
        expect(getPromptSourceId(prompt)).toBe('elder_thing_elder_thing_choice');
        expect(getPromptTargetType(prompt)).toBe('button');
        expect(getPromptHandlerData(prompt)?.displayCard).toEqual({ defId: 'elder_thing_elder_thing', cardUid: 'et-1' });
        expect(getPromptOption(prompt, option => option.id === 'destroy')?.disabled).toBe(true);
    });

    it('有两个其他随从时创建可选择 prompt', () => {
        const state = makeState({
            bases: [
                makeBase({
                    minions: [
                        makeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 }),
                        makeMinion('a2', 'test_minion', '0', 3, { powerModifier: 0 }),
                    ],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'et-1', defId: 'elder_thing_elder_thing', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'et-1', baseIndex: 0 },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'elder_thing_elder_thing_choice');
        expect(getPromptSourceId(prompt)).toBe('elder_thing_elder_thing_choice');
        expect(getPromptTargetType(prompt)).toBe('button');
        expect(getPromptOption(prompt, option => option.id === 'destroy')?.disabled).toBe(false);
    });

    it('CARD_TO_DECK_BOTTOM reducer 会从基地移除随从到牌库底', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('et-1', 'elder_thing_elder_thing', '0', 10, { powerModifier: 0 })] })],
        });
        const event: CardToDeckBottomEvent = {
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: {
                cardUid: 'et-1',
                defId: 'elder_thing_elder_thing',
                ownerId: '0',
                reason: 'elder_thing_elder_thing',
            },
            timestamp: 0,
        };

        const next = reduce(state, event);

        expect(next.bases[0].minions).toHaveLength(0);
        expect(next.players['0'].deck[0]).toEqual(expect.objectContaining({ uid: 'et-1' }));
    });
});

describe('elder_thing_shoggoth 打出限制与 onPlay', () => {
    it('己方力量小于 6 的基地不能打出修格斯', () => {
        const shoggothCard: CardInstance = { uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('a1', 'test_minion', '0', 3, { powerModifier: 0 })] })],
            players: {
                '0': makePlayer('0', { hand: [shoggothCard] }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(
            { core: state, sys: { phase: 'playCards' } },
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sh-1', baseIndex: 0 } },
        );

        expect(result.valid).toBe(false);
        expect(result.error).toContain('6点力量');
    });

    it('己方力量足够的基地可以打出修格斯', () => {
        const shoggothCard: CardInstance = { uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' };
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('big', 'test_minion', '0', 6, { powerModifier: 0 })] })],
            players: {
                '0': makePlayer('0', { hand: [shoggothCard] }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(
            { core: state, sys: { phase: 'playCards' } },
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sh-1', baseIndex: 0 } },
        );

        expect(result.valid).toBe(true);
    });

    it('打出时为第一个对手创建选择 prompt', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('big', 'test_minion', '0', 6, { powerModifier: 0 })] })],
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
        });
        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'sh-1', baseIndex: 0 },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'elder_thing_shoggoth_opponent');
        expect(getPromptSourceId(prompt)).toBe('elder_thing_shoggoth_opponent');
        expect(getPromptTargetType(prompt)).toBe('button');
    });

    it('无对手时不产生事件', () => {
        const state = makeState({
            bases: [makeBase({ minions: [makeMinion('big', 'test_minion', '0', 6, { powerModifier: 0 })] })],
            turnOrder: ['0'],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'sh-1', defId: 'elder_thing_shoggoth', type: 'minion', owner: '0' }],
                }),
            },
        });
        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'sh-1', baseIndex: 0 },
        } as any, dummyRandom);

        expect(result.success, result.error).toBe(true);
        expectNoPrompt(result.finalState);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.MADNESS_DRAWN)).toBe(false);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});
