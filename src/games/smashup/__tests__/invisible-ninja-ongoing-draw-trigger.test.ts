import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_EVENTS, type SmashUpEvent, type TitanState } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    FIXED_RANDOM,
    applyEvents,
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptPlayerId,
    getReactionPromptOptionBySourceDefId,
    resolveAffectedMinions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveDestroyedMinions,
    respondCommand,
} from './helpers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { runCommand } from './testRunner';

beforeEach(() => {
    resetAbilityInit();
    initAllAbilities();
});

function createInvisibleNinjaState(currentPlayerIndex = 0, turnNumber = 1) {
    return makeState({
        players: {
            '0': makePlayer('0', {
                deck: [
                    makeCard('draw-a', 'robot_microbot_alpha', 'minion', '0'),
                    makeCard('draw-b', 'ghosts_spectre', 'minion', '0'),
                    makeCard('draw-c', 'sharks_mako', 'minion', '0'),
                ],
            }),
            '1': makePlayer('1'),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex,
        turnNumber,
        bases: [
            makeBase(),
            makeBase({
                minions: [
                    makeMinion('enemy-a', 'pirate_first_mate', '1', 2),
                    makeMinion('enemy-b', 'tornados_dust_devil', '1', 2),
                ],
            }),
        ],
        titans: [{
            uid: 't-invisible-ninja-live',
            defId: 'ninjas_invisible_ninja',
            faction: SMASHUP_FACTION_IDS.NINJAS,
            ownerId: '0',
            controllerId: '0',
            powerCounters: 0,
            talentUsed: false,
            location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
        } satisfies TitanState],
    });
}

function resolveInvisibleNinjaTrigger(state: ReturnType<typeof makeMatchState>) {
    let reactionState = state;
    if (!getOptionalSimpleChoicePrompt(reactionState)) {
        const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 999);
        reactionState = reactionResult?.state ?? reactionState;
    }

    const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
    if (reactionChoicePrompt) {
        const ninjaOption = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'ninjas_invisible_ninja');
        const afterChooseTrigger = runCommand(
            reactionState,
            respondCommand(ninjaOption.id, '0'),
            FIXED_RANDOM,
        );
        reactionState = afterChooseTrigger.finalState;
    }

    const currentInteraction = getSimpleChoicePrompt(reactionState, 'titan_ninjas_invisible_ninja_ongoing');
    const drawOption = getPromptOption(currentInteraction, option => option.value?.cardUid, 'Invisible Ninja draw option');
    const afterDraw = runCommand(
        reactionState,
        respondCommand(drawOption.id, '0'),
        FIXED_RANDOM,
    );
    return afterDraw.finalState;
}

describe('Invisible Ninja 持续触发回归', () => {
    it('2v2 模式下队友消灭对手随从时，不应给隐形忍者弹出反应', () => {
        const matchState = makeMatchState(makeState({
            teamMode: '2v2',
            seatOrder: ['0', '1', '2', '3'],
            turnOrder: ['0', '1', '2', '3'],
            currentPlayerIndex: 2,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-b', 'ghosts_spectre', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
                '3': makePlayer('3'),
            },
            bases: [
                makeBase(),
                makeBase({
                    minions: [
                        makeMinion('enemy-a', 'pirate_first_mate', '1', 2),
                    ],
                }),
            ],
            titans: [{
                uid: 't-invisible-ninja-team',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        }));

        const processed = resolveDestroyedMinions(matchState, '2', [{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'enemy-a',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 1,
                ownerId: '1',
                destroyerId: '2',
                reason: 'ally_destroy',
            },
            timestamp: 301,
        } satisfies SmashUpEvent], FIXED_RANDOM, 301);

        const queuedTrigger = (processed.matchState ?? matchState).core.triggerQueue?.find(
            trigger => trigger.sourceDefId === 'ninjas_invisible_ninja',
        );

        expect(queuedTrigger).toBeUndefined();
    });

    it('同一回合多次消灭对手卡牌时，每次都应再次触发抽牌', () => {
        const matchState = makeMatchState(createInvisibleNinjaState(), 'playCards', '0');

        const first = resolveDestroyedMinions(matchState, '0', [{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'enemy-a',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 1,
                ownerId: '1',
                destroyerId: '0',
                reason: 'invisible_ninja_first_destroy',
            },
            timestamp: 101,
        } satisfies SmashUpEvent], FIXED_RANDOM, 101);
        const stateAfterFirst = resolveInvisibleNinjaTrigger(first.matchState ?? matchState);

        const second = resolveDestroyedMinions(stateAfterFirst, '0', [{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'enemy-b',
                minionDefId: 'tornados_dust_devil',
                fromBaseIndex: 1,
                ownerId: '1',
                destroyerId: '0',
                reason: 'invisible_ninja_second_destroy',
            },
            timestamp: 102,
        } satisfies SmashUpEvent], FIXED_RANDOM, 102);

        let secondReactionState = second.matchState ?? stateAfterFirst;
        if (!getOptionalSimpleChoicePrompt(secondReactionState)) {
            const reactionResult = maybeResolveReactionQueue(secondReactionState, FIXED_RANDOM, 102);
            secondReactionState = reactionResult?.state ?? secondReactionState;
        }

        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(secondReactionState, 'smashup_reaction_choose');
        expect(reactionChoicePrompt).toBeTruthy();
        const ninjaOption = getReactionPromptOptionBySourceDefId(secondReactionState, reactionChoicePrompt!, 'ninjas_invisible_ninja');
        expect(ninjaOption).toBeTruthy();
    });

    it('对手回合里由你消灭对手卡牌时，仍应把抽牌触发交给你', () => {
        const core = createInvisibleNinjaState(1, 2);
        const matchState = makeMatchState(core, 'playCards', '1');

        const processed = resolveDestroyedMinions(matchState, '1', [{
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'enemy-a',
                minionDefId: 'pirate_first_mate',
                fromBaseIndex: 1,
                ownerId: '1',
                destroyerId: '0',
                reason: 'invisible_ninja_enemy_turn_destroy',
            },
            timestamp: 201,
        } satisfies SmashUpEvent], FIXED_RANDOM, 201);

        let reactionState = processed.matchState ?? matchState;
        if (!getOptionalSimpleChoicePrompt(reactionState)) {
            const reactionResult = maybeResolveReactionQueue(reactionState, FIXED_RANDOM, 201);
            reactionState = reactionResult?.state ?? reactionState;
        }

        const reactionChoicePrompt = getOptionalSimpleChoicePrompt(reactionState, 'smashup_reaction_choose');
        if (reactionChoicePrompt) {
            const ninjaOption = getReactionPromptOptionBySourceDefId(reactionState, reactionChoicePrompt, 'ninjas_invisible_ninja');
            const afterChooseTrigger = runCommand(
                reactionState,
                respondCommand(ninjaOption.id, '0'),
                FIXED_RANDOM,
            );
            reactionState = afterChooseTrigger.finalState;
        }

        const currentInteraction = getSimpleChoicePrompt(reactionState, 'titan_ninjas_invisible_ninja_ongoing');
        expect(getPromptPlayerId(currentInteraction)).toBe('0');
    });

    it('自己消灭对手持续行动牌时，隐形忍者也应触发抽牌', () => {
        const matchState = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'robot_microbot_alpha', 'minion', '0'),
                        makeCard('draw-b', 'ghosts_spectre', 'minion', '0'),
                        makeCard('draw-c', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            bases: [
                makeBase(),
                makeBase({
                    ongoingActions: [{ uid: 'enemy-ongoing', defId: 'bear_cavalry_superiority', ownerId: '1' } as any],
                }),
            ],
            titans: [{
                uid: 't-invisible-ninja-live',
                defId: 'ninjas_invisible_ninja',
                faction: SMASHUP_FACTION_IDS.NINJAS,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            } satisfies TitanState],
        }));

        const processed = resolveAffectedMinions(matchState, '0', [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'enemy-ongoing',
                defId: 'bear_cavalry_superiority',
                ownerId: '1',
                reason: 'test_destroy_enemy_ongoing',
                sourcePlayerId: '0',
            },
            timestamp: 401,
        } satisfies SmashUpEvent], FIXED_RANDOM, 401);

        const queuedState = processed.matchState ?? matchState;
        const reactionState = {
            ...queuedState,
            core: applyEvents(queuedState.core, processed.events),
        };
        const finalState = resolveInvisibleNinjaTrigger(reactionState);

        expect(finalState.core.players['0'].hand).toHaveLength(1);
        expect(finalState.core.players['0'].deck).toHaveLength(2);
    });
});
