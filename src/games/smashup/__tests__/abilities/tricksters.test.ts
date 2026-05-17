import { beforeAll, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { reduce } from '../../domain/reducer';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
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

describe('trickster interaction regressions', () => {
    it('trickster_gnome resolves selected target', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_gnome', 'trickster_gnome', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [
                    makeMinion('ally1', 'test_ally', '0', 3),
                    makeMinion('e1', 'test_enemy', '1', 1),
                    makeMinion('e2', 'test_enemy', '1', 1),
                ],
                ongoingActions: [],
            }],
        });

        const playResult = execPlayMinion(state, '0', 'm_gnome', 0);

        const prompt = getSimpleChoicePrompt(playResult.matchState, 'trickster_gnome');
        const targetOption = getPromptOption(
            prompt,
            option => option?.value?.minionUid === 'e1',
            'gnome destroy target e1',
        );

        const respondResult = runCommand(
            playResult.matchState,
            respondCommand(targetOption.id, '0'),
            defaultTestRandom,
        );

        const destroyEvent = respondResult.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvent).toBeDefined();
        expect((destroyEvent as any).payload.minionUid).toBe('e1');
        expect(respondResult.finalState.core.bases[0].minions.some(m => m.uid === 'e1')).toBe(false);
    });

    it('trickster_gnome_pod beforeScoring options exclude the source gnome itself', () => {
        const state = makeState({
            bases: [{
                defId: 'base_the_homeworld',
                minions: [
                    makeMinion('gnome-1', 'trickster_gnome_pod', '0', 3),
                    makeMinion('ally-1', 'test_ally', '0', 5),
                    makeMinion('enemy-1', 'test_enemy', '1', 1),
                    makeMinion('enemy-2', 'test_enemy', '1', 2),
                ],
                ongoingActions: [],
            }],
        });
        (state as any).scoringEligibleBaseIndices = [0];
        const seededMatchState = makeMatchState(state);
        const matchState = {
            ...seededMatchState,
            sys: { ...seededMatchState.sys, phase: 'scoreBases' },
        } as MatchState<SmashUpCore>;

        const result = runCommand(matchState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'gnome-1', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultTestRandom);
        expect(result.success).toBe(true);

        const prompt = getSimpleChoicePrompt(result.finalState, 'trickster_gnome_pod');
        const targetUids = getPromptOptions(prompt)
            .map(option => option?.value?.minionUid)
            .filter(Boolean);

        expect(targetUids).not.toContain('gnome-1');
        expect(targetUids).toContain('enemy-1');
        expect(targetUids).not.toContain('enemy-2');
    });

    it('trickster_gnome_pod resolves only once for the same gnome during one scoring', () => {
        const core = makeState({
            bases: [{
                defId: 'base_the_homeworld',
                minions: [
                    makeMinion('gnome-1', 'trickster_gnome_pod', '0', 3),
                    makeMinion('ally-1', 'test_ally', '0', 5),
                    makeMinion('ally-2', 'test_ally', '0', 5),
                    makeMinion('enemy-1', 'test_enemy', '1', 1),
                ],
                ongoingActions: [],
            }],
            baseDeck: ['base_the_mothership'],
        });
        (core as any).scoringEligibleBaseIndices = [0];
        const seededMatchState = makeMatchState(core);
        const initialMatchState = {
            ...seededMatchState,
            sys: {
                ...seededMatchState.sys,
                phase: 'scoreBases',
            },
        } as MatchState<SmashUpCore>;

        const activateResult = runCommand(initialMatchState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'gnome-1', baseIndex: 0 },
            timestamp: 1000,
        } as any, defaultTestRandom);
        expect(activateResult.success).toBe(true);
        const prompt = getSimpleChoicePrompt(activateResult.finalState, 'trickster_gnome_pod');

        const targetOption = getPromptOption(
            prompt,
            option => option?.value?.minionUid === 'enemy-1',
            'gnome POD destroy target enemy-1',
        );

        const limitUsed = activateResult.finalState.core.specialLimitUsed?.trickster_gnome_pod ?? [];
        expect(limitUsed).toContain(0);

        const respondResult = runCommand(
            activateResult.finalState,
            { ...respondCommand(targetOption.id, '0'), timestamp: 1001 },
            defaultTestRandom,
        );

        const destroyEvents = respondResult.events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents).toHaveLength(1);
        expect((destroyEvents[0] as any).payload.minionUid).toBe('enemy-1');
        expectNoPrompt(respondResult.finalState);
    });
});

describe('诡术师派系能力', () => {
    it('trickster_take_the_shinies: 每个对手随机弃两张手牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_take_the_shinies', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('h1', 'test', 'minion', '1'),
                        makeCard('h2', 'test', 'minion', '1'),
                        makeCard('h3', 'test', 'minion', '1'),
                    ],
                }),
            },
            bases: [],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvents.length).toBe(1);
        expect((discardEvents[0] as any).payload.playerId).toBe('1');
        expect((discardEvents[0] as any).payload.cardUids.length).toBe(2);
    });

    it('trickster_take_the_shinies: 对手手牌不足2张时弃全部', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_take_the_shinies', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('h1', 'test', 'minion', '1')],
                }),
            },
            bases: [],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const discardEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DISCARDED);
        expect(discardEvents.length).toBe(1);
        expect((discardEvents[0] as any).payload.cardUids.length).toBe(1);
    });

    it('trickster_disenchant: 单个基地持续行动卡时创建 Interaction', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '1' }],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'trickster_disenchant');
    });

    it('trickster_disenchant: 单个随从附着行动卡时创建 Interaction', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [{
                    ...makeMinion('m1', 'test', '1', 3),
                    attachedActions: [{ uid: 'att1', defId: 'test_attached', ownerId: '1' }],
                }],
                ongoingActions: [],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'trickster_disenchant');
    });

    it('trickster_disenchant: 选项使用 cardUid + _source: ongoing（显式声明来源）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '1' }],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'trickster_disenchant');
        const options = getPromptOptions(prompt);

        expect(options).toHaveLength(1);
        expect(options[0].value.cardUid).toBe('oa1');
        expect(options[0]._source).toBe('ongoing');
    });

    it('trickster_disenchant: 同时收集基地 ongoing 和随从附着行动卡', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [{
                    ...makeMinion('m1', 'test', '1', 3),
                    attachedActions: [{ uid: 'att1', defId: 'test_attached', ownerId: '1' }],
                }],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '0' }],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'trickster_disenchant');
        const options = getPromptOptions(prompt);

        expect(options).toHaveLength(2);
    });

    it('trickster_disenchant: 交互解决后 ongoing 卡被移除并进入弃牌堆', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1',
                minions: [],
                ongoingActions: [{ uid: 'oa1', defId: 'test_ongoing', ownerId: '1' }],
            }],
        });

        const detachEvent = {
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: 'oa1', defId: 'test_ongoing', ownerId: '1', reason: 'trickster_disenchant' },
            timestamp: Date.now(),
        } as SmashUpEvent;
        const newCore = reduce(state, detachEvent);

        expect(newCore.bases[0].ongoingActions.length).toBe(0);
        expect(newCore.players['1'].discard.some(card => card.uid === 'oa1')).toBe(true);
    });

    it('trickster_disenchant: 场上无行动卡时返回反馈', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'trickster_disenchant', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'b1', minions: [], ongoingActions: [] }],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const feedbackEvents = events.filter(e => e.type === SU_EVENTS.ABILITY_FEEDBACK);

        expect(feedbackEvents.length).toBe(1);
        expectNoPrompt(matchState);
    });
});
