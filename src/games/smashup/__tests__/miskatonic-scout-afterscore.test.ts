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

function findOptionId(
    choice: NonNullable<ReturnType<typeof getCurrentChoice>>,
    predicate: (option: NonNullable<ReturnType<typeof getCurrentChoice>>['options'][number]) => boolean,
    message: string,
) {
    const option = choice.options.find(predicate);
    if (!option) {
        throw new Error(`${message}: ${JSON.stringify(choice.options.map(item => item.id))}`);
    }
    return option.id;
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
    const queuedTriggers = state.core.triggerQueue ?? [];
    expect(queuedTriggers.some((trigger: any) => trigger?.sourceDefId === 'base_miskatonic_university_base')).toBe(false);

    const triggersById = new Map(
        queuedTriggers.map((trigger: any) => [trigger.id, trigger]),
    );
    const optionId = findOptionId(
        currentChoice!,
        option => {
            const triggerId = (option as any)?.value?.triggerId;
            return triggerId && triggersById.get(triggerId)?.sourceDefId === 'alien_scout';
        },
        '找不到 alien_scout 的 queued trigger 选项',
    );

    const result = runner.resolveInteraction(playerId, { optionId });
    expect(result.success).toBe(true);

    const nextChoice = getCurrentChoice(runner.getState());
    expect(nextChoice?.sourceId).toBe('alien_scout_return');
    return nextChoice!;
}

beforeAll(() => {
    initAllAbilities();
});

describe('Miskatonic University + Scout scoring chain', () => {
    it('base_miskatonic_university_base 当前不属于 afterScoring 链，计分时应直接继续 alien_scout_return', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_miskatonic_university_base',
                    minions: [
                        makeMinion('scout-0', 'alien_scout', '0', '0', 3),
                        makeMinion('friend-0', 'alien_invader', '0', '0', 18),
                        makeMinion('enemy-0', 'pirate_pirate_king', '1', '1', 5),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden', 'base_tar_pits', 'base_jungle_oasis'];
            core.players['0'].hand = [
                { uid: 'mad-0', defId: 'special_madness', type: 'action', owner: '0' },
            ];
            core.players['1'].hand = [];
            core.madnessDeck = ['special_madness', 'special_madness'];

            return { sys, core };
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        let state = runner.getState();
        expect(getSmashUpReactionSession(state)?.responseWindowType).toBe('afterScoring');
        expect(state.sys.interaction?.current?.data?.sourceId).not.toBe('base_miskatonic_university_base');
        expect(state.core.bases[0].defId).toBe('base_miskatonic_university_base');
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'scout-0')).toBe(true);

        const scoutChoice = enterScoutPrompt(runner, '0');
        expect(scoutChoice.sourceId).toBe('alien_scout_return');

        const resolveScout = runner.resolveInteraction('0', { optionId: 'yes' });
        expect(resolveScout.success).toBe(true);

        state = runner.getState();
        expect(getSmashUpReactionSession(state)).toBeUndefined();
        expect(state.sys.responseWindow?.current).toBeUndefined();
        expect(state.sys.interaction?.current).toBeUndefined();
        expect(state.core.players['0'].hand.map(card => card.uid)).toContain('scout-0');
        expect(state.core.players['0'].hand.filter(card => card.defId === 'special_madness')).toHaveLength(1);
        expect(state.core.bases[0].defId).toBe('base_secret_garden');
    });
});
