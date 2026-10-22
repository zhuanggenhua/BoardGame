import type { BetrayalCore, BetrayalPendingEventChoiceState, BetrayalTraitKey } from './game';
import { resolveEventTraitChoices } from './eventChoicePreview';

/** Read-only surface projection while the rule engine owns the roll resolution. */
export function resolveContinuousTraitRollChoice(core: BetrayalCore, viewerPlayerId: string | null) {
    const resolution = core.pendingEventRollResolution;
    const progress = core.recentAllTraitCheck;
    if (!resolution || !progress || resolution.playerId !== viewerPlayerId
        || progress.sourceTitle !== resolution.sourceTitle) return null;
    const next = resolution.nextPendingEventChoice;
    if (next?.allTraitCheckProgress?.results.length) {
        return { choiceView: next, traitChoices: resolveEventTraitChoices(next.effect), nextChoiceId: next.id, terminal: false };
    }
    if (resolution.effect.mode !== 'allTraitChecks') return null;
    // This is display data, never installed as a pending rule choice.
    const choiceView: Pick<BetrayalPendingEventChoiceState, 'sourceTitle' | 'effect'> = {
        sourceTitle: resolution.sourceTitle, effect: resolution.effect,
    };
    return { choiceView, traitChoices: [] as BetrayalTraitKey[], nextChoiceId: null, terminal: true };
}
