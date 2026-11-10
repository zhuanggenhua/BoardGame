export type FeedbackReplayTriggerReference = {
    commandType: string;
    playerId: string;
    stateIdBefore: number;
    randomCursorBefore?: number;
    requestId?: string;
};

export type FeedbackReplayCaptureRequest =
    | { phase: 'prepare'; trigger?: FeedbackReplayTriggerReference }
    | { phase: 'attach'; feedbackId: string; captureId: string };

export type FeedbackReplayCaptureResult = {
    accepted: boolean;
    captureId?: string;
    triggerCaptured?: boolean;
};
