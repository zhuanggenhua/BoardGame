import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialSystemState } from '../../../engine/pipeline';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import { getSmashUpReactionSession } from '../domain/reactionSession';
import { SU_EVENTS } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';
import {
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    makeBase,
    makeMinion,
    makePlayer,
} from './helpers';

function createAshlarRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: ['0', '1'],
        setup: (playerIds, random): MatchState<SmashUpCore> => {
            const core = SmashUpDomain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            core.turnOrder = ['0', '1'];
            core.currentPlayerIndex = 0;
            core.baseDeck = ['base_cuzcu'];
            core.players = {
                '0': makePlayer('0', {
                    hand: [{ uid: 'ashlar', defId: 'ancient_incas_ashlar_masonry', type: 'action', owner: '0' }],
                    deck: [{ uid: 'existing-deck-card', defId: 'ancient_incas_llama', type: 'minion', owner: '0' }],
                    discard: [],
                }),
                '1': makePlayer('1'),
            };
            core.bases = [
                makeBase('base_machu_picchu', [
                    makeMinion('scorer', 'ancient_incas_llama', '0', 20),
                ]),
                makeBase('base_cuzcu'),
            ];
            core.bases[0].ongoingActions = [
                { uid: 'keep-action', defId: 'ancient_incas_armory', ownerId: '0' },
                { uid: 'deck-action-a', defId: 'ancient_incas_armory', ownerId: '0' },
                { uid: 'deck-action-b', defId: 'ancient_incas_signs_in_the_stars', ownerId: '0' },
            ];
            sys.phase = 'playCards';
            return { core, sys };
        },
    });
}

function appendEvents(target: SmashUpEvent[], events: readonly SmashUpEvent[]) {
    target.push(...events);
}

function findAshlarTriggerOption(runner: ReturnType<typeof createAshlarRunner>) {
    const state = runner.getState();
    const prompt = getOptionalSimpleChoicePrompt(state, 'smashup_reaction_choose');
    expect(prompt).toBeTruthy();
    return getPromptOption(
        prompt,
        option => option.value?.kind === 'play_action' && option.value?.cardUid === 'ashlar',
        '方石砌体计分后出牌选项',
    );
}

describe('古代印加人：方石砌体完整计分后链路', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('计分后选一张行动回手，其余行动只入牌库，随后完成清场换基地', () => {
        const runner = createAshlarRunner();
        const eventLog: SmashUpEvent[] = [];

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success, advance.error).toBe(true);
        appendEvents(eventLog, advance.events as SmashUpEvent[]);

        const playOption = findAshlarTriggerOption(runner);
        const chooseAshlar = runner.resolveInteraction('0', { optionId: playOption.id });
        expect(chooseAshlar.success, chooseAshlar.error).toBe(true);
        appendEvents(eventLog, chooseAshlar.events as SmashUpEvent[]);

        const ashlarChoice = getOptionalSimpleChoicePrompt(
            runner.getState(),
            'ancient_incas_ashlar_masonry',
        );
        expect(ashlarChoice).toBeTruthy();
        const keepOption = getPromptOption(
            ashlarChoice,
            option => option.value?.cardUid === 'keep-action',
            '方石砌体回手选项',
        );
        const resolveAshlar = runner.resolveInteraction('0', { optionId: keepOption.id });
        expect(resolveAshlar.success, resolveAshlar.error).toBe(true);
        appendEvents(eventLog, resolveAshlar.events as SmashUpEvent[]);

        const finalState = runner.getState();
        const player = finalState.core.players['0'];
        expect(player.hand.map(card => card.uid)).toContain('keep-action');
        expect(player.hand.map(card => card.uid)).not.toContain('ashlar');
        expect(player.discard.map(card => card.uid)).not.toEqual(
            expect.arrayContaining(['keep-action', 'deck-action-a', 'deck-action-b']),
        );
        expect(finalState.core.bases[0].defId).toBe('base_cuzcu');
        expect(finalState.core.bases[0].minions).toEqual([]);
        expect(finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(getSmashUpReactionSession(finalState)).toBeUndefined();
        expect(getOptionalSimpleChoicePrompt(finalState)).toBeUndefined();
        expect(eventLog.filter(event => event.type === SU_EVENTS.BASE_SCORED)).toHaveLength(1);
        expect(eventLog.filter(event => event.type === SU_EVENTS.BASE_CLEARED)).toHaveLength(1);
        expect(eventLog.filter(event => event.type === SU_EVENTS.BASE_REPLACED)).toHaveLength(1);
        expect(eventLog.filter(event => event.type === SU_EVENTS.CARD_TRANSFERRED)
            .map(event => (event as any).payload.cardUid)).toContain('keep-action');
        const deckReordered = eventLog.find(event =>
            event.type === SU_EVENTS.DECK_REORDERED
            && ['deck-action-a', 'deck-action-b'].every(uid => (event as any).payload.deckUids.includes(uid)),
        ) as any;
        expect(deckReordered?.payload.deckUids).toEqual(expect.arrayContaining([
            'deck-action-a',
            'deck-action-b',
        ]));
        expect(eventLog.filter(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)
            .map(event => (event as any).payload.cardUid).sort()).toEqual(['deck-action-a', 'deck-action-b'].sort());
    });
});
