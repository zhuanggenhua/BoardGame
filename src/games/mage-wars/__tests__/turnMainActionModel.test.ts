import { describe, expect, it } from 'vitest';
import {
    getMageWarsTurnMainActionModel,
    resolveMageWarsPhaseAdvanceActionLabelKey,
} from '../ui/turnMainActionModel';

describe('Mage Wars turn main action model', () => {
    it.each(['reset', 'channel', 'upkeep'] as const)(
        'hides automatic %s as a player button',
        (phase) => {
            expect(getMageWarsTurnMainActionModel({
                phase,
                canAdvance: true,
                canSubmitPlanningSpells: true,
                planSpellCount: 0,
            })).toBeNull();
        },
    );

    it('models empty planning as an enabled confirm action when the formal command is allowed', () => {
        expect(getMageWarsTurnMainActionModel({
            phase: 'planning',
            canAdvance: false,
            canSubmitPlanningSpells: true,
            planSpellCount: 0,
        })).toEqual({
            mode: 'plan-spells',
            phase: 'planning',
            testId: 'mage-wars-plan-spells',
            tutorialId: 'mw-plan-spells',
            labelKey: 'spellbook.planSelected',
            labelParams: { count: 0, total: 2 },
            disabled: false,
            emphasized: true,
            planProgress: '0/2',
        });
    });

    it('keeps planning disabled when the same formal command is not allowed', () => {
        expect(getMageWarsTurnMainActionModel({
            phase: 'planning',
            canAdvance: true,
            canSubmitPlanningSpells: false,
            planSpellCount: 0,
        })?.disabled).toBe(true);
    });

    it.each([
        ['deployment', 'actions.passDeployment'],
        ['initiativeQuickcast', 'actions.passQuickcast'],
        ['creatureAction', 'actions.endAction'],
        ['finalQuickcast', 'actions.passQuickcast'],
    ] as const)('models %s as a phase advance action', (phase, labelKey) => {
        const model = getMageWarsTurnMainActionModel({
            phase,
            canAdvance: true,
            canSubmitPlanningSpells: false,
            planSpellCount: 0,
        });

        expect(model).toEqual(expect.objectContaining({
            mode: 'advance-phase',
            phase,
            testId: 'mage-wars-turn-end',
            tutorialId: 'mw-turn-end',
            labelKey,
            disabled: false,
            emphasized: false,
        }));
        expect(resolveMageWarsPhaseAdvanceActionLabelKey(phase)).toBe(labelKey);
    });
});
