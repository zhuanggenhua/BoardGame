export const DICETHRONE_DAMAGE_SHIELD_PREVENTION_SOURCE_ID = 'dicethrone_damage_shield_prevention';
export const DICETHRONE_TOKEN_RESPONSE_FRAME_ID_PREFIX = 'dicethrone:token-response-frame:';

export function buildDiceThroneTokenResponseFrameIdFromPendingDamageId(pendingDamageId: string): string {
    return `${DICETHRONE_TOKEN_RESPONSE_FRAME_ID_PREFIX}${pendingDamageId}`;
}

export function resolveDiceThroneTokenResponseFramePendingDamageId(
    resolutionFrameId: unknown,
): string | undefined {
    if (typeof resolutionFrameId !== 'string') return undefined;
    if (!resolutionFrameId.startsWith(DICETHRONE_TOKEN_RESPONSE_FRAME_ID_PREFIX)) return undefined;
    const pendingDamageId = resolutionFrameId.slice(DICETHRONE_TOKEN_RESPONSE_FRAME_ID_PREFIX.length);
    return pendingDamageId.length > 0 ? pendingDamageId : undefined;
}

export function buildDiceThroneDamageShieldPreventionOpportunityId(args: {
    pendingDamageId: string;
    targetPlayerId: string;
    shieldIndex: number;
    shieldSourceId?: string;
}): string {
    const sourceId = args.shieldSourceId && args.shieldSourceId.length > 0
        ? args.shieldSourceId
        : `shield-${args.shieldIndex}`;
    return [
        'dicethrone:damage-shield-prevention',
        args.pendingDamageId,
        args.targetPlayerId,
        args.shieldIndex,
        sourceId,
    ].join(':');
}
