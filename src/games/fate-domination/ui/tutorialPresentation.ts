import type { TutorialState } from '../../../engine/types';
import type { FateTutorialStep } from './tutorialContract';

interface VisibleTutorialUi {
    inspection: { name: string; source: string } | null;
    detail: string | null;
    viewerId?: string | null;
    detailEliminated?: boolean;
    seal: boolean;
    discard: boolean;
    postBattle?: boolean;
    attackStaged?: boolean;
    ridingSelectionCount?: number;
    publicCards?: boolean;
    movement: boolean;
    movementTarget: boolean;
    identity: boolean;
}
export const FATE_TUTORIAL_TABLE_PROTECTION = ['.fd-play-summary','.fd-phase-control','.fd-self-stats','.fd-self-pile-info','.fd-self-piles','.fd-event-deck-count','.fd-runtime-map-card-hit','.fd-runtime-card','.fd-runtime-pawn','.fd-riding-controls','.fd-runtime-opponent-cards','.fd-runtime-player-rail'];

/** 正文消费同一摘句；可选检视时让阅读对象独占前景，不另写一套窗口讲解。 */
export function presentFateTutorial(tutorial: TutorialState, ui: VisibleTutorialUi): TutorialState {
    if (!tutorial.active || !tutorial.step) return tutorial;
    const step = tutorial.step as FateTutorialStep;
    const expected = step.fateCommand;
    const hide = () => ({ ...tutorial, step: { ...step, hideOverlay:true, highlightTarget:undefined } });
    if (ui.inspection || ui.detail || ui.seal || ui.discard || ui.postBattle || (ui.publicCards && step.id.startsWith('ui-public-cards')) || ui.movementTarget || (ui.attackStaged && expected?.type==='CONFIRM_ATTACK')) return hide();
    if(expected?.type==='SYS_INTERACTION_RESPOND' && Array.isArray(expected.payload.optionIds) && (ui.ridingSelectionCount??0)>=expected.payload.optionIds.length)return hide();
    return tutorial;
}
