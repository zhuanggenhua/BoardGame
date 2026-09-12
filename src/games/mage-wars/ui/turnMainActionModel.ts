import { MAGE_WARS_MAX_PREPARED_SPELLS, type MageWarsPhase } from '../domain';

export type MageWarsTurnMainActionMode = 'plan-spells' | 'advance-phase';

export interface MageWarsTurnMainActionModel {
    mode: MageWarsTurnMainActionMode;
    phase: MageWarsPhase;
    testId: 'mage-wars-plan-spells' | 'mage-wars-turn-end';
    tutorialId: 'mw-plan-spells' | 'mw-turn-end';
    labelKey: string;
    labelParams?: Record<string, number>;
    disabled: boolean;
    emphasized: boolean;
    planProgress?: string;
}

export const MAGE_WARS_AUTOMATIC_PHASES = new Set<MageWarsPhase>(['reset', 'channel', 'upkeep']);

export function resolveMageWarsPhaseAdvanceActionLabelKey(phase: MageWarsPhase): string {
    switch (phase) {
        case 'reset':
        case 'channel':
        case 'upkeep':
            throw new Error(`Mage Wars automatic phase cannot expose a manual action: ${phase}`);
        case 'planning':
            throw new Error('Mage Wars planning phase must use the spell planning submit action.');
        case 'deployment':
            return 'actions.passDeployment';
        case 'initiativeQuickcast':
        case 'finalQuickcast':
            return 'actions.passQuickcast';
        case 'creatureAction':
            return 'actions.endAction';
    }
}

export function getMageWarsTurnMainActionModel(args: {
    phase: MageWarsPhase;
    canAdvance: boolean;
    canSubmitPlanningSpells: boolean;
    planSpellCount: number;
    planSpellTotal?: number;
}): MageWarsTurnMainActionModel | null {
    if (MAGE_WARS_AUTOMATIC_PHASES.has(args.phase)) return null;

    if (args.phase === 'planning') {
        const planSpellTotal = args.planSpellTotal ?? MAGE_WARS_MAX_PREPARED_SPELLS;
        return {
            mode: 'plan-spells',
            phase: args.phase,
            testId: 'mage-wars-plan-spells',
            tutorialId: 'mw-plan-spells',
            labelKey: 'spellbook.planSelected',
            labelParams: {
                count: args.planSpellCount,
                total: planSpellTotal,
            },
            disabled: !args.canSubmitPlanningSpells,
            emphasized: args.canSubmitPlanningSpells,
            planProgress: `${args.planSpellCount}/${planSpellTotal}`,
        };
    }

    return {
        mode: 'advance-phase',
        phase: args.phase,
        testId: 'mage-wars-turn-end',
        tutorialId: 'mw-turn-end',
        labelKey: resolveMageWarsPhaseAdvanceActionLabelKey(args.phase),
        disabled: !args.canAdvance,
        emphasized: false,
    };
}
