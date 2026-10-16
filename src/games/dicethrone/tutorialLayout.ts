import type { TutorialStepSnapshot } from '../../engine/types';

/** 双侧操作时把说明留在中央，资源、骰盘和当前伤害仍可读可点。 */
export const withDiceThroneTutorialSurfaces = (steps: TutorialStepSnapshot[]): TutorialStepSnapshot[] => steps.map(step => {
    const target = step.highlightTarget ?? '';
    const usesSideControls = target.startsWith('dice-')
        || target === 'advance-phase-button'
        || target === 'response-pass-button'
        || target === 'player-stats'
        || (target === 'status-tokens' && step.id !== 'purify-use');
    return {
        ...step,
        ...(usesSideControls ? { position: 'center' as const } : {}),
        avoidOverlapSelectors: step.avoidOverlapSelectors ?? [
        '[data-tutorial-id="player-stats"]',
        '[data-tutorial-id="status-tokens"]',
        '[data-testid="dt-top-header-1-hp"]',
        '[data-testid="dt-top-header-1-cp"]',
            ...(usesSideControls ? [
                '[data-tutorial-id="dice-tray"]',
                '[data-testid="current-total-damage-badge"]',
            ] : []),
        ],
    };
});
