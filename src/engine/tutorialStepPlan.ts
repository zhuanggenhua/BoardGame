import type { TutorialManifest, TutorialState, TutorialStepSnapshot } from './types';

/** 恢复和运行必须使用同一份实际课程，分支会改变步骤索引。 */
export function getEffectiveTutorialSteps(manifest: TutorialManifest, tutorial: TutorialState): TutorialStepSnapshot[] {
    if (manifest.replanAfterCommand && tutorial.steps.length) return tutorial.steps;
    return tutorial.selectedBranch
        ? manifest.steps.filter(step => !step.branch || step.branch === tutorial.selectedBranch)
        : manifest.steps;
}
