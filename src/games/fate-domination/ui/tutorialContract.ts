import type { TutorialState, TutorialStepSnapshot } from '../../../engine/types';
import type { FateTutorialCopy } from '../tutorialText';

/** 只约束教程的练习目标，正式规则仍由领域验证器决定。 */
export type FateTutorialStep = TutorialStepSnapshot & { fateCommand?: { type: string; payload: Record<string, unknown> }; fateUiDetailTarget?: string; fateUiInspectionSource?: 'hand'; fateCopy?: FateTutorialCopy };
export function fateTutorialExpected(tutorial: TutorialState) {
    return tutorial.active ? (tutorial.step as FateTutorialStep | undefined)?.fateCommand : undefined;
}
const comparable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => {
    if (Array.isArray(item)) return [...item].sort();
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    return item;
});
export function fateTutorialAllows(tutorial: TutorialState, type: string, payload: unknown): boolean {
    if (!tutorial.active || type.startsWith('SYS_TUTORIAL_')) return true;
    const expected = fateTutorialExpected(tutorial);
    if (!expected || type !== expected.type) return false;
    const normalize = (value: unknown) => type.startsWith('SYS_INTERACTION_') ? { ...(value as object), interactionId: '$current' } : value;
    return comparable(normalize(payload)) === comparable(normalize(expected.payload));
}
