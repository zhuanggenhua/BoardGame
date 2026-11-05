import { useEffect, useRef } from 'react';
import { useTutorial } from '../../../contexts/TutorialContext';
import type { FateTutorialStep } from './tutorialContract';

export type FateInspectionSource = 'map' | 'hand' | 'detail' | 'discard' | 'opponent';
interface Props {
    detail: string | null; viewerId: string | null; inspection: boolean; inspectionSource: FateInspectionSource | null; publicCards: boolean;
    pile: 'deck' | 'discard' | null; discardCount: number; seal: boolean; movement: boolean;
    movementTarget: boolean; rollbackRevision: number;
}
const fresh = (id: string) => ({ id, opened: false, advanced: false, own: false, other: false, inspected: false, detailTargetInspected: false, target: false });
/** 只读取真实控件状态；切席、嵌套检视与移动选目标均须实际发生。 */
export function FateTutorialUiBridge(ui: Props) {
    const { currentStep, nextStep } = useTutorial();
    const seen = useRef(fresh(''));
    const detailTarget=(currentStep as FateTutorialStep | undefined)?.fateUiDetailTarget;
    const inspectionSource=(currentStep as FateTutorialStep | undefined)?.fateUiInspectionSource;
    useEffect(() => {
        const stepId = currentStep?.id ?? '';
        const scope = `${stepId}:${ui.rollbackRevision}`;
        if (seen.current.id !== scope) seen.current = fresh(scope);
        const kind = stepId.replace(/^ui-/, '').replace(/-\d+$/, '');
        const open = kind === 'detail' ? Boolean(ui.detail) : kind === 'inspection' ? ui.inspection && (!inspectionSource || ui.inspectionSource===inspectionSource) : kind === 'public-cards' ? ui.publicCards
            : kind === 'pile' ? ui.pile==='discard' : kind === 'seal' ? ui.seal : kind === 'movement' ? ui.movement : undefined;
        if (open === undefined) return;
        const progress = seen.current;
        if (open) progress.opened = true;
        if (kind === 'detail' && ui.detail) {
            if (ui.detail === ui.viewerId) progress.own = true; else if (!detailTarget || ui.detail===detailTarget) progress.other = true;
            if (ui.inspection && ui.inspectionSource === 'detail') progress.inspected = true;
            if (ui.detail===detailTarget && ui.inspection && ui.inspectionSource==='detail') progress.detailTargetInspected = true;
        }
        if (kind === 'pile' && ui.pile === 'discard' && ui.inspection && ui.inspectionSource === 'discard') progress.inspected = true;
        if (kind === 'public-cards' && ui.publicCards && ui.inspection && ui.inspectionSource === 'opponent') progress.inspected = true;
        if (kind === 'movement' && ui.movementTarget) progress.target = true;
        const complete = kind === 'detail' ? (detailTarget ? progress.detailTargetInspected : progress.own && progress.other && progress.inspected) && !ui.inspection
            : kind === 'movement' ? progress.target : !ui.inspection;
        if (!open && progress.opened && complete && !progress.advanced) {
            progress.advanced = true;
            nextStep('auto');
        }
    }, [currentStep?.id, detailTarget, inspectionSource, ui.detail, ui.viewerId, ui.inspection, ui.inspectionSource, ui.publicCards, ui.pile, ui.discardCount, ui.seal, ui.movement, ui.movementTarget, ui.rollbackRevision, nextStep]);
    return null;
}
