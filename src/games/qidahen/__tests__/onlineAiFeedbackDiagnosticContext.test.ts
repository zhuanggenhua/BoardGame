import { describe, expect, it } from 'vitest';
import { engineConfig } from '../game';

describe('Qidahen online AI feedback diagnostic context', () => {
    it('只输出阵营选择、投票和候选组数量，不输出隐藏派系或玩家映射', () => {
        const hiddenFaction = 'authoritative-hidden-faction-canary';
        const playerMapping = 'authoritative-player-map-canary';
        const contextBuilder = engineConfig.onlineAiRecovery?.buildFeedbackDiagnosticContext;
        expect(contextBuilder).toBeTypeOf('function');

        const context = contextBuilder!({
            state: {
                core: {
                    turnPhase: 'annual-selection',
                    playerIds: ['0', playerMapping],
                    factions: {
                        [hiddenFaction]: { playerId: playerMapping },
                        'visible-placeholder': { playerId: '0' },
                    },
                    factionSelection: {
                        selections: { [playerMapping]: hiddenFaction },
                    },
                    scenarioVote: {
                        hostPlayerId: playerMapping,
                        votes: { '0': 'scenario-a', [playerMapping]: null },
                    },
                    pendingScenarioCharacterChoices: [{
                        id: 'private-choice-id-canary',
                        factionId: hiddenFaction,
                        count: 1,
                        characterIds: ['hidden-character-canary', 'visible-character-canary'],
                    }],
                    pendingScenarioArmamentChoices: [{
                        id: 'private-armament-choice-id-canary',
                        factionId: hiddenFaction,
                        count: 1,
                        armamentIds: ['hidden-armament-canary'],
                    }],
                },
                sys: { phase: 'select-faction' },
            } as never,
            playerId: '0',
        } as never);

        expect(context).toMatchObject({
            turnPhase: 'annual-selection',
            factionCount: 2,
            factionSelection: { pendingCount: 1, selectedCount: 1 },
            scenarioVote: { hasHost: true, pendingCount: 1 },
            pendingScenarioCharacterChoices: [{ count: 1, optionCount: 2 }],
            pendingScenarioArmamentChoices: [{ count: 1, optionCount: 1 }],
        });
        const serialized = JSON.stringify(context);
        for (const canary of [
            hiddenFaction,
            playerMapping,
            'private-choice-id-canary',
            'private-armament-choice-id-canary',
            'hidden-character-canary',
            'visible-character-canary',
            'hidden-armament-canary',
            'scenario-a',
        ]) {
            expect(serialized).not.toContain(canary);
        }
    });
});
