import type { AiDecisionContext, AiLegalAction } from './types';

export function buildDeterministicAiNoise(
    context: AiDecisionContext,
    action: AiLegalAction,
    scope = 'action',
): number {
    const stateTurnNumber = typeof context.visibleState.sys?.turnNumber === 'number'
        ? context.visibleState.sys.turnNumber
        : 0;
    const eventStreamNextId = typeof context.visibleState.sys?.eventStream?.nextId === 'number'
        ? context.visibleState.sys.eventStream.nextId
        : 0;
    const seed = `${context.matchId}|${context.playerId}|${scope}|${stateTurnNumber}|${eventStreamNextId}|${action.actionId}`;

    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    const normalized = (hash >>> 0) / 0xffffffff;
    return normalized * 2 - 1;
}
