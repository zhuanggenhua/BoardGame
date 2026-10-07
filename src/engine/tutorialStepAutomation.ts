import type { TutorialManifest, TutorialStepSnapshot } from './types';

export const isHiddenTutorialAutomationStep = (
    step: TutorialStepSnapshot | null | undefined,
): boolean => Boolean(
    step?.aiActions?.length
    && !step.requireAction
    && !step.infoStep
    && step.hiddenAutomation,
);

const hasText = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

export const getTutorialHiddenAutomationContractErrors = (
    manifest: TutorialManifest,
): string[] => {
    const errors: string[] = [];
    const firstVisibleStepIndexById = new Map<string, number>();
    const hasPriorVisibleStep = (index: number): boolean => manifest.steps
        .slice(0, index)
        .some((priorStep) => !isHiddenTutorialAutomationStep(priorStep));

    manifest.steps.forEach((step, index) => {
        if (!isHiddenTutorialAutomationStep(step) && hasText(step.id)) {
            firstVisibleStepIndexById.set(step.id, index);
        }
    });

    manifest.steps.forEach((step, index) => {
        const label = `${manifest.id}:${step.id ?? index}`;
        const contract = step.hiddenAutomation;
        if (!contract) return;

        if (!step.aiActions?.length) {
            errors.push(`${label} declares hiddenAutomation without aiActions`);
        }
        if (step.requireAction || step.infoStep) {
            errors.push(`${label} cannot hide a player action or readable info step`);
        }
        if (!hasText(contract.reason)) {
            errors.push(`${label} hiddenAutomation requires a human-readable reason`);
        }

        if (contract.kind === 'setup-precondition') {
            if (hasPriorVisibleStep(index)) {
                errors.push(`${label} setup-precondition can only run before the first visible tutorial step`);
            }
            if (Array.isArray(contract.equivalentStepIds) && contract.equivalentStepIds.length > 0) {
                errors.push(`${label} setup-precondition must not cite equivalent tutorial steps`);
            }
            return;
        }

        if (contract.kind === 'branch-recovery') {
            if (Array.isArray(contract.equivalentStepIds) && contract.equivalentStepIds.length > 0) {
                errors.push(`${label} branch-recovery must not cite equivalent tutorial steps`);
            }
            if (!hasText(contract.recoveryStepId)) {
                errors.push(`${label} branch-recovery requires recoveryStepId`);
                return;
            }
            const recoveryIndex = firstVisibleStepIndexById.get(contract.recoveryStepId);
            if (recoveryIndex === undefined) {
                errors.push(`${label} cites missing or hidden recovery step ${contract.recoveryStepId}`);
            } else if (recoveryIndex >= index) {
                errors.push(`${label} cites non-prior recovery step ${contract.recoveryStepId}`);
            }
            if (step.aiActions?.length !== 1 || step.aiActions[0]?.commandType !== 'SYS_TUTORIAL_PREVIOUS') {
                errors.push(`${label} branch-recovery must issue exactly one SYS_TUTORIAL_PREVIOUS action`);
            }
            return;
        }

        if (contract.kind !== 'compressed-repeat') {
            errors.push(`${label} hiddenAutomation has unknown kind`);
            return;
        }

        if (!Array.isArray(contract.equivalentStepIds) || contract.equivalentStepIds.length === 0) {
            errors.push(`${label} compressed-repeat must cite at least one prior visible tutorial step`);
            return;
        }

        for (const equivalentStepId of contract.equivalentStepIds) {
            const equivalentIndex = firstVisibleStepIndexById.get(equivalentStepId);
            if (equivalentIndex === undefined) {
                errors.push(`${label} cites missing or hidden equivalent step ${equivalentStepId}`);
                continue;
            }
            if (equivalentIndex >= index) {
                errors.push(`${label} cites non-prior equivalent step ${equivalentStepId}`);
            }
        }
    });

    return errors;
};
