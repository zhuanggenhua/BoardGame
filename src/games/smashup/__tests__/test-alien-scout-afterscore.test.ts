import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import { asSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities } from '../abilities';
import { SmashUpDomain } from '../domain';
import { getSmashUpReactionSession } from '../domain/reactionSession';
import { smashUpSystemsForTest } from '../game';
import type { MinionOnBase, SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';

const PLAYER_IDS: PlayerId[] = ['0', '1'];

function makeMinion(
    uid: string,
    defId: string,
    owner: PlayerId,
    controller: PlayerId,
    basePower: number,
): MinionOnBase {
    return {
        uid,
        defId,
        owner,
        controller,
        basePower,
        powerModifier: 0,
        tempPowerModifier: 0,
        powerCounters: 0,
        attachedActions: [],
        talentUsed: false,
    };
}

function createRunner(
    setup: (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>,
): GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent> {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        setup,
    });
}

function getCurrentChoice(state: MatchState<SmashUpCore>) {
    return asSimpleChoice(state.sys.interaction?.current);
}

function enterScoutPrompt(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    playerId: PlayerId,
) {
    const state = runner.getState();
    const currentChoice = getCurrentChoice(state);
    if (currentChoice?.sourceId === 'alien_scout_return') {
        return currentChoice;
    }

    expect(currentChoice?.sourceId).toBe('smashup_reaction_choose');
    const triggerQueue = state.core.triggerQueue ?? [];
    const triggersById = new Map(
        triggerQueue.map((trigger: any) => [trigger.id, trigger]),
    );
    const scoutOption = currentChoice?.options.find(option => {
        const triggerId = (option as any)?.value?.triggerId;
        return triggerId && triggersById.get(triggerId)?.sourceDefId === 'alien_scout';
    });

    expect(scoutOption).toBeDefined();
    const result = runner.resolveInteraction(playerId, { optionId: scoutOption!.id });
    expect(result.success).toBe(true);

    const nextChoice = getCurrentChoice(runner.getState());
    expect(nextChoice?.sourceId).toBe('alien_scout_return');
    return nextChoice!;
}

beforeAll(() => {
    initAllAbilities();
});

describe('Alien Scout afterScoring flow', () => {
    it('基地计分后应继续打开 alien_scout_return，并在选择 yes 后仅回手 1 次', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_secret_garden',
                    minions: [
                        makeMinion('scout-0', 'alien_scout', '0', '0', 3),
                        makeMinion('friend-0', 'alien_invader', '0', '0', 18),
                        makeMinion('enemy-0', 'pirate_pirate_king', '1', '1', 5),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_faceless_city', 'base_tar_pits'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        let state = runner.getState();
        expect(getSmashUpReactionSession(state)?.responseWindowType).toBe('afterScoring');
        expect(state.core.bases[0].defId).toBe('base_secret_garden');
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'scout-0')).toBe(true);

        const scoutChoice = enterScoutPrompt(runner, '0');
        expect(scoutChoice.sourceId).toBe('alien_scout_return');

        const resolveScout = runner.resolveInteraction('0', { optionId: 'yes' });
        expect(resolveScout.success).toBe(true);

        state = runner.getState();
        expect(getSmashUpReactionSession(state)).toBeUndefined();
        expect(state.sys.responseWindow?.current).toBeUndefined();
        expect(state.sys.interaction?.current).toBeUndefined();
        expect(state.core.players['0'].hand.filter(card => card.uid === 'scout-0')).toHaveLength(1);
        expect(state.core.bases[0].defId).toBe('base_faceless_city');
    });
});
