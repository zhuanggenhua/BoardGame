import type { TutorialStepSnapshot } from '../../engine/types';

/** 沿用浮层正式避让，把手牌、资源与骰盘留给当前决策。 */
export const withDiceThroneTutorialSurfaces = (steps: TutorialStepSnapshot[]): TutorialStepSnapshot[] => steps.map(step => {
    const target = step.highlightTarget ?? '';
    const targetsAbilitySlot = target === 'ability-slots' || target.startsWith('ability-slot-');
    const usesSideControls = target.startsWith('dice-')
        || target === 'advance-phase-button'
        || target === 'response-pass-button'
        || target === 'response-toggle'
        || target === 'player-stats'
        || target === 'status-tokens';
    return {
        ...step,
        ...(!target ? { highlightTarget: 'phase-indicator', position: 'right' as const } : usesSideControls ? { position: 'top' as const } : {}),
        ...(targetsAbilitySlot ? {
            compactAvoidOverlapSelectors: [
                ...(step.compactAvoidOverlapSelectors ?? []),
                '[data-tutorial-id="dice-tray"]',
                '[data-testid="current-total-damage-badge"]',
                ...(['ability-rule', 'abilities'].includes(step.id)
                    ? ['[data-ability-slot-scope="main-board"][data-can-click="true"]'] : []),
            ],
        } : {}),
        avoidOverlapSelectors: step.avoidOverlapSelectors ?? (['response-finish', 'defense-start'].includes(step.id)
            // 正式来袭弹窗已模糊背景；此时决策对象是前景技能与开始防御按钮。
            ? ['[data-testid="attack-showcase-overlay"] > div:last-child'] : [
        '[data-tutorial-id="player-stats"]',
        '[data-tutorial-id="status-tokens"]',
        '[data-testid="dt-top-header-1"]',
        '[data-tutorial-id="hand-area"]',
        '[data-tutorial-id="dice-tray"]',
        '[data-testid="dt-active-phase-indicator"]',
        '[data-tutorial-id="draw-deck"]',
        '[data-tutorial-id="discard-pile"]',
        '[data-testid="current-total-damage-badge"]',
        ...(['hand-inspect', 'double-play'].includes(step.id)
            ? ['[data-testid="board-magnify-overlay"][aria-hidden="false"] > div']
            : []),
        ...(targetsAbilitySlot ? ['[data-tutorial-id="tip-board"]'] : []),
        ]),
    };
});
