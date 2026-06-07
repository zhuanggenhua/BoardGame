import { beforeAll, describe, expect, it } from 'vitest';
import { resolveAiDifficultyProfile } from '../../../engine/ai';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { buildSmashUpAiLegalActions, smashUpAiRuntime } from '../ai';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { makeBase, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

async function decideBaselineAction(state: ReturnType<typeof makeMatchState>) {
    const legalActions = buildSmashUpAiLegalActions({
        playerId: '0',
        state,
    });
    const decision = await smashUpAiRuntime.localPolicies!.baseline.decide({
        gameId: 'smashup',
        matchId: 'smashup-ai-talent-decision',
        playerId: '0',
        visibleState: state,
        interaction: null,
        responseWindow: null,
        legalActions,
        rulesVersion: null,
        decisionBudgetMs: 250,
        difficulty: resolveAiDifficultyProfile('expert'),
        source: 'local',
    });

    return {
        legalActions,
        chosenAction: legalActions.find((action) => action.actionId === decision?.actionId) ?? null,
        decision,
    };
}

describe('Smash Up AI 主动天赋收益判断', () => {
    it('高速追逐没有实际收益时，AI 应直接过阶段而不是见到能发动就发动', async () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_mountains_of_madness',
                    minions: [makeMinion('runner-1', 'robot_microbot_alpha', '0', 19)],
                    ongoingActions: [{ uid: 'chase-1', defId: 'world_champs_high_speed_chase', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase({
                    defId: 'base_longhouse',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        }));

        const { legalActions, chosenAction } = await decideBaselineAction(state);

        expect(legalActions.some((action) => action.kind === 'use-talent')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(true);
        expect(chosenAction?.kind).toBe('advance-phase');
    });

    it('高速追逐能直接兑现基地收益时，AI 仍应主动发动天赋', async () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_portal_room',
                    minions: [makeMinion('runner-1', 'robot_microbot_alpha', '0', 9)],
                    ongoingActions: [{ uid: 'chase-1', defId: 'world_champs_high_speed_chase', ownerId: '0', talentUsed: false } as any],
                }),
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        }));

        const { chosenAction } = await decideBaselineAction(state);

        expect(chosenAction?.kind).toBe('use-talent');
        expect(chosenAction?.metadata).toEqual(expect.objectContaining({
            defId: 'world_champs_high_speed_chase',
            sourceType: 'ongoing',
        }));
    });
});
