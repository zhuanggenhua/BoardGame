export type DispatchPayloadMeta = {
    internalOverrideId?: string;
    tutorialOverrideId?: string;
    aiTraceToken?: string;
    isTutorialAiCommand: boolean;
    normalizedPayload: unknown;
};

export function parseDispatchPayloadMeta(payload: unknown): DispatchPayloadMeta {
    const payloadRecord = payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : null;
    const internalOverrideId = typeof payloadRecord?.__internalPlayerId === 'string'
        ? payloadRecord.__internalPlayerId
        : undefined;
    const tutorialOverrideId = typeof payloadRecord?.__tutorialPlayerId === 'string'
        ? payloadRecord.__tutorialPlayerId
        : undefined;
    const aiTraceToken = typeof payloadRecord?.__aiTraceToken === 'string'
        ? payloadRecord.__aiTraceToken
        : undefined;
    const isTutorialAiCommand = payloadRecord?.__tutorialAiCommand === true;
    const normalizedPayload = payloadRecord && (
        '__internalPlayerId' in payloadRecord
        || '__internalAiCommand' in payloadRecord
        || '__tutorialPlayerId' in payloadRecord
        || '__tutorialAiCommand' in payloadRecord
        || '__aiTraceToken' in payloadRecord
    )
        ? (() => {
            const {
                __internalPlayerId: _ignored0,
                __internalAiCommand: _ignored1,
                __tutorialPlayerId: _ignored2,
                __tutorialAiCommand: _ignored3,
                __aiTraceToken: _ignored4,
                ...rest
            } = payloadRecord;
            return rest;
        })()
        : payload;

    return {
        internalOverrideId,
        tutorialOverrideId,
        aiTraceToken,
        isTutorialAiCommand,
        normalizedPayload,
    };
}

export function resolveDispatchActorPlayerId(args: {
    meta: DispatchPayloadMeta;
    allowInternalOverride: boolean;
    allowTutorialOverride: boolean;
    fallbackPlayerId: string;
}): string {
    const {
        meta,
        allowInternalOverride,
        allowTutorialOverride,
        fallbackPlayerId,
    } = args;

    if (allowTutorialOverride && meta.isTutorialAiCommand && meta.tutorialOverrideId) {
        return meta.tutorialOverrideId;
    }

    if (allowInternalOverride && meta.internalOverrideId) {
        return meta.internalOverrideId;
    }

    return fallbackPlayerId;
}
