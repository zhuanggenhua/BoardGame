import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondCommand,
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

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(
    state: SmashUpCore,
    playerId: string,
    cardUid: string,
    targetBaseIndex?: number,
    targetMinionUid?: string,
) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex, targetMinionUid },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

describe('alien_jammed_signal 基地能力压制', () => {
    it('压制常规基地触发（onActionPlayed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_the_workshop' })],
        });
        const normalResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_the_workshop',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });

    it('压制扩展基地触发（onMinionDestroyed）', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_cave_of_shinies' })],
        });
        const normalResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(normalResult.events.some(e => e.type === SU_EVENTS.VP_AWARDED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_cave_of_shinies',
                ongoingActions: [{ uid: 'jam-1', defId: 'alien_jammed_signal', ownerId: '1' }],
            })],
        });
        const suppressedResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });
});

describe('外星人派系能力', () => {
    it('alien_invader: 获得1VP', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_invader', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1' })],
        });

        const { events } = execPlayMinion(state, '0', 'm1', 0);
        const vpEvents = events.filter(event => event.type === SU_EVENTS.VP_AWARDED);

        expect(vpEvents.length).toBe(1);
        expect((vpEvents[0] as any).payload.amount).toBe(1);
        expect((vpEvents[0] as any).payload.playerId).toBe('0');
    });

    it('alien_collector: 单个力量≤3对手随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_collector', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m2', 'test', '1', 3),
                    makeMinion('m3', 'test', '1', 5),
                ],
            })],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        getSimpleChoicePrompt(matchState, 'alien_collector');
    });

    it('alien_collector: 选择目标后通过 runtime prompt 返回随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_collector', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m2', 'test', '1', 3),
                    makeMinion('m3', 'test', '1', 5),
                ],
            })],
        });

        const playResult = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any, defaultTestRandom);

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'alien_collector');
        const option = getPromptOption(
            prompt,
            candidate => candidate?.value?.minionUid === 'm2',
            'alien collector target m2',
        );

        const respondResult = runCommand(
            playResult.finalState,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const returnedEvent = respondResult.events.find(event => event.type === SU_EVENTS.MINION_RETURNED);
        expect(returnedEvent).toBeDefined();
        expect((returnedEvent as any).payload).toMatchObject({
            minionUid: 'm2',
            reason: 'alien_collector',
            toPlayerId: '1',
        });
        expect(respondResult.finalState.core.bases[0].minions.some(minion => minion.uid === 'm2')).toBe(false);
    });

    it('alien_supreme_overlord: 选择目标后通过 runtime prompt 返回随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'alien_supreme_overlord', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('ally-1', 'test_ally', '0', 4)],
                }),
                makeBase({
                    defId: 'b2',
                    minions: [makeMinion('enemy-1', 'test_enemy', '1', 3)],
                }),
            ],
        });

        const playResult = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any, defaultTestRandom);

        const prompt = getSimpleChoicePrompt(playResult.finalState, 'alien_supreme_overlord');
        const option = getPromptOption(
            prompt,
            candidate => candidate?.value?.minionUid === 'enemy-1',
            'alien supreme overlord target enemy-1',
        );

        const respondResult = runCommand(
            playResult.finalState,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const returnedEvent = respondResult.events.find(event => event.type === SU_EVENTS.MINION_RETURNED);
        expect(returnedEvent).toBeDefined();
        expect((returnedEvent as any).payload).toMatchObject({
            minionUid: 'enemy-1',
            reason: 'alien_supreme_overlord',
            toPlayerId: '1',
        });
        expect(respondResult.finalState.core.bases[1].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('alien_disintegrator: 缺少 targetMinionUid 时应校验失败；提供目标后正常结算', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'alien_disintegrator', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [makeMinion('m1', 'test', '1', 2)],
            })],
        });

        const missingTarget = execPlayAction(state, '0', 'a1');
        expectNoPrompt(missingTarget.matchState);
        expect(missingTarget.matchState.core.players['0'].hand.some(card => card.uid === 'a1')).toBe(true);

        const resolved = execPlayAction(state, '0', 'a1', 0, 'm1');
        const deckBottom = resolved.events.find(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect(deckBottom).toBeDefined();
        expect((deckBottom as any).payload).toMatchObject({
            cardUid: 'm1',
            reason: 'alien_disintegrator',
        });
    });

    it('alien_crop_circles: 单个基地有随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'alien_crop_circles', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'b1',
                minions: [
                    makeMinion('m1', 'test', '0', 3),
                    makeMinion('m2', 'test', '1', 2),
                    makeMinion('m3', 'test', '1', 4),
                ],
            })],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'alien_crop_circles');
    });

    it('alien_scout: 打出时无 onPlay 交互（能力为 afterScoring 触发）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'alien_invader', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                        makeCard('d3', 'alien_supreme_overlord', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        expectNoPrompt(matchState);
    });

    it('alien_scout: 牌库无随从时无抽牌事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_action2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('alien_scout: 牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        expect(events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN)).toHaveLength(0);
        expectNoPrompt(matchState);
    });
});
