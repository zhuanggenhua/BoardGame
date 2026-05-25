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

function enterPromptFromReactionChoose(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    playerId: PlayerId,
    sourceDefId: string,
    expectedPromptSourceId: string,
) {
    const state = runner.getState();
    const currentChoice = getCurrentChoice(state);
    if (currentChoice?.sourceId === expectedPromptSourceId) {
        return currentChoice;
    }

    expect(currentChoice?.sourceId).toBe('smashup_reaction_choose');
    const triggersById = new Map(
        (state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]),
    );
    const optionId = findOptionId(
        currentChoice!,
        option => {
            const triggerId = (option as any)?.value?.triggerId;
            return triggerId && triggersById.get(triggerId)?.sourceDefId === sourceDefId;
        },
        `找不到 ${sourceDefId} 的 queued trigger 选项`,
    );

    const result = runner.resolveInteraction(playerId, { optionId });
    expect(result.success).toBe(true);

    const nextChoice = getCurrentChoice(runner.getState());
    expect(nextChoice?.sourceId).toBe(expectedPromptSourceId);
    return nextChoice!;
}

beforeAll(() => {
    initAllAbilities();
});

describe('Mothership + Scout afterScoring chain', () => {
    it('base_the_mothership 与两个 alien_scout、一个 pirate_first_mate 的交互应链式传递，不应提前清场', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_the_mothership',
                    minions: [
                        makeMinion('scout-1', 'alien_scout', '0', '0', 3),
                        makeMinion('scout-2', 'alien_scout', '0', '0', 3),
                        makeMinion('mate-1', 'pirate_first_mate', '0', '0', 2),
                        makeMinion('weak-1', 'alien_invader', '0', '0', 2),
                        makeMinion('strong-1', 'cyborg_apes_cyberback', '0', '0', 5),
                        makeMinion('enemy-1', 'pirate_pirate_king', '1', '1', 5),
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_tar_pits',
                    minions: [],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden', 'base_jungle_oasis'];
            core.players['0'].hand = [];
            core.players['0'].discard = [];
            core.players['1'].hand = [];
            core.players['1'].discard = [];

            return { sys, core };
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);
        expect(getSmashUpReactionSession(runner.getState())?.responseWindowType).toBe('afterScoring');

        const mothershipChoice = enterPromptFromReactionChoose(
            runner,
            '0',
            'base_the_mothership',
            'base_the_mothership',
        );
        const resolveMothership = runner.resolveInteraction('0', {
            optionId: findOptionId(
                mothershipChoice,
                option => (option as any)?.value?.minionUid === 'weak-1',
                '母舰 prompt 中应能选择 weak-1',
            ),
        });
        expect(resolveMothership.success).toBe(true);

        let state = runner.getState();
        expect(state.core.bases[0].defId).toBe('base_the_mothership');
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'scout-1')).toBe(true);
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'scout-2')).toBe(true);
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'mate-1')).toBe(true);

        const scout1Choice = enterPromptFromReactionChoose(
            runner,
            '0',
            'alien_scout',
            'alien_scout_return',
        );
        expect(scout1Choice.sourceId).toBe('alien_scout_return');
        const resolveScout1 = runner.resolveInteraction('0', { optionId: 'yes' });
        expect(resolveScout1.success).toBe(true);

        state = runner.getState();
        expect(state.core.players['0'].hand.map(card => card.uid)).toContain('scout-1');
        expect(state.core.bases[0].defId).toBe('base_the_mothership');
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'scout-2')).toBe(true);
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'mate-1')).toBe(true);

        const scout2Choice = enterPromptFromReactionChoose(
            runner,
            '0',
            'alien_scout',
            'alien_scout_return',
        );
        expect(scout2Choice.sourceId).toBe('alien_scout_return');
        const resolveScout2 = runner.resolveInteraction('0', { optionId: 'no' });
        expect(resolveScout2.success).toBe(true);

        state = runner.getState();
        expect(state.core.bases[0].defId).toBe('base_the_mothership');
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'mate-1')).toBe(true);

        const firstMateChoice = enterPromptFromReactionChoose(
            runner,
            '0',
            'pirate_first_mate',
            'pirate_first_mate_choose_base',
        );
        const resolveFirstMate = runner.resolveInteraction('0', {
            optionId: findOptionId(
                firstMateChoice,
                option => (option as any)?.value?.baseIndex === 1,
                '大副 prompt 中应能选择基地 1',
            ),
        });
        expect(resolveFirstMate.success).toBe(true);

        state = runner.getState();
        expect(getSmashUpReactionSession(state)).toBeUndefined();
        expect(state.sys.responseWindow?.current).toBeUndefined();
        expect(state.sys.interaction?.current).toBeUndefined();
        expect(state.core.bases[0].defId).toBe('base_secret_garden');
        expect(state.core.bases[0].minions).toHaveLength(0);
        expect(state.core.bases[1].minions.map(minion => minion.uid)).toContain('mate-1');
        expect(state.core.players['0'].hand.filter(card => card.uid === 'scout-1')).toHaveLength(1);
    });
});
