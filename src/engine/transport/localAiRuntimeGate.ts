import type { AiSeatController } from '../ai';
import type { LocalAiCommandEffect } from './localAiCommandEffects';
import type { LocalAiTurnTimeline } from './localAiDiagnostics';

type RefBox<T> = {
    current: T;
};

export type LocalAiAutomationBlockReason =
    | 'no-ai-seat'
    | 'pregame-controlled'
    | 'disabled'
    | null;

export function hasAutomatedSeat(
    seatControllers: Record<string, AiSeatController>,
): boolean {
    return Object.values(seatControllers).some((controller) => controller.type !== 'human');
}

export function resolveLocalAiAutomationBlockReason(args: {
    seatControllers: Record<string, AiSeatController>;
    localPregameControlledPlayerId: string | null;
    automationDisabled?: boolean;
}): LocalAiAutomationBlockReason {
    if (args.automationDisabled) {
        return 'disabled';
    }
    if (!hasAutomatedSeat(args.seatControllers)) {
        return 'no-ai-seat';
    }
    if (args.localPregameControlledPlayerId) {
        return 'pregame-controlled';
    }
    return null;
}

export function resetLocalAiTransientState(args: {
    lastAiAttemptKeyRef: RefBox<string | null>;
    lastVisibleAiActionAtRef: RefBox<number | null>;
    aiCommandEffectByTokenRef: RefBox<Record<string, LocalAiCommandEffect>>;
    aiTurnTimelineBySeatRef?: RefBox<Record<string, LocalAiTurnTimeline>>;
}): void {
    args.lastAiAttemptKeyRef.current = null;
    args.lastVisibleAiActionAtRef.current = null;
    args.aiCommandEffectByTokenRef.current = {};
    if (args.aiTurnTimelineBySeatRef) {
        args.aiTurnTimelineBySeatRef.current = {};
    }
}
