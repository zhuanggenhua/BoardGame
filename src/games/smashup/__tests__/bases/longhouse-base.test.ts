import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    runCommand,
    defaultTestRandom,
    makeState,
    makeMinion,
    makeCard,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptOption,
    respondCommand,
    SU_COMMANDS,
    SMASHUP_FACTION_IDS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_longhouse: 主动基地能力置顶并加力量', () => {
    it('base_longhouse 改为主动基地能力：使用后会把手牌置于牌库顶并给此基地己方随从 +2 力量', () => {
        const core = makeState({
            bases: [{
                defId: 'base_longhouse',
                minions: [makeMinion('m1', '0', 4)],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0,
                    hand: [makeCard('h1', '0', 'robot_microbot_alpha')],
                    deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.VIKINGS, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });

        const started = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_BASE_ABILITY, playerId: '0', payload: { baseIndex: 0 } } as any,
            defaultTestRandom,
        );

        const cardPrompt = getSimpleChoicePrompt(started.finalState, 'base_longhouse_card');

        const chooseCard = getPromptOption(cardPrompt, entry => entry.value?.cardUid === 'h1');
        const afterCard = runCommand(
            started.finalState,
            respondCommand(chooseCard.id, '0'),
            defaultTestRandom,
        );

        const minionPrompt = getSimpleChoicePrompt(afterCard.finalState, 'base_longhouse_minion');

        const chooseMinion = getPromptOption(minionPrompt, entry => entry.value?.minionUid === 'm1');
        const resolved = runCommand(
            afterCard.finalState,
            respondCommand(chooseMinion.id, '0'),
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('h1');
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });

    it('base_longhouse_pod reuses the active base ability to topdeck and buff', () => {
        const core = makeState({
            bases: [{
                defId: 'base_longhouse_pod',
                minions: [makeMinion('m1', '0', 4, 'vikings_huscarl_pod')],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0,
                    hand: [makeCard('h1', '0', 'robot_microbot_alpha')],
                    deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.VIKINGS_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
            } as any,
        });

        const started = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_BASE_ABILITY, playerId: '0', payload: { baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(started.success).toBe(true);

        const cardPrompt = getSimpleChoicePrompt(started.finalState, 'base_longhouse_card');

        const chooseCard = getPromptOption(cardPrompt, entry => entry.value?.cardUid === 'h1');
        const afterCard = runCommand(
            started.finalState,
            respondCommand(chooseCard.id, '0'),
            defaultTestRandom,
        );

        const minionPrompt = getSimpleChoicePrompt(afterCard.finalState, 'base_longhouse_minion');

        const chooseMinion = getPromptOption(minionPrompt, entry => entry.value?.minionUid === 'm1');
        const resolved = runCommand(
            afterCard.finalState,
            respondCommand(chooseMinion.id, '0'),
            defaultTestRandom,
        );

        expect(resolved.finalState.core.players['0'].deck[0]?.uid).toBe('h1');
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });
});
