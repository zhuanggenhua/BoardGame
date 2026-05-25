import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
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

beforeAll(() => {
    initAllAbilities();
});

describe('Wizard Academy + Scout afterScoring chain', () => {
    it('base_wizard_academy 的基地交互解决后，仍应继续保留 alien_scout 的 afterScoring 返回手牌交互', () => {
        const runner = createRunner((ids, random) => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);

            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.bases = [
                {
                    defId: 'base_wizard_academy',
                    minions: [
                        makeMinion('scout-0', 'alien_scout', '0', '0', 3),
                        makeMinion('friend-0', 'alien_invader', '0', '0', 18),
                        makeMinion('enemy-0', 'pirate_first_mate', '1', '1', 2),
                    ],
                    ongoingActions: [],
                },
            ];
            core.baseDeck = ['base_secret_garden', 'base_tar_pits', 'base_jungle_oasis'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];

            return { sys, core };
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        let state = runner.getState();
        expect(getSmashUpReactionSession(state)?.responseWindowType).toBe('afterScoring');
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('base_wizard_academy');

        const resolveWizard = runner.resolveInteraction('0', { optionId: 'base-0' });
        expect(resolveWizard.success).toBe(true);

        state = runner.getState();
        expect(state.core.bases[0].defId).toBe('base_wizard_academy');
        expect(state.core.bases[0].minions.some(minion => minion.uid === 'scout-0')).toBe(true);
        expect(getSmashUpReactionSession(state)?.responseWindowType).toBe('afterScoring');
        expect(state.sys.interaction?.current?.data?.sourceId).toBe('alien_scout_return');

        const resolveScout = runner.resolveInteraction('0', { optionId: 'yes' });
        expect(resolveScout.success).toBe(true);

        state = runner.getState();
        expect(getSmashUpReactionSession(state)).toBeUndefined();
        expect(state.sys.responseWindow?.current).toBeUndefined();
        expect(state.core.players['0'].hand.map(card => card.uid)).toContain('scout-0');
        expect(state.core.players['0'].hand.filter(card => card.uid === 'scout-0')).toHaveLength(1);
        expect(state.core.bases[0].defId).toBe('base_secret_garden');
    });
});
