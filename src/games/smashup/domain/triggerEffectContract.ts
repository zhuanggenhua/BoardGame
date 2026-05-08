import type { MatchState } from '../../../engine/types';
import { asSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { SU_EVENTS, type ReactionOrderingAtom, type SmashUpCore, type SmashUpEvent, type TriggerEffectContract } from './types';
import type { TitanAwareTriggerTiming, TriggerCallback, TriggerContext, TriggerResult } from './ongoingEffects';

function countQueuedInteractions(state: MatchState<SmashUpCore> | undefined): number {
    if (!state?.sys.interaction) return 0;
    return (state.sys.interaction.current ? 1 : 0) + (state.sys.interaction.queue?.length ?? 0);
}

function formatAtoms(atoms: ReactionOrderingAtom[] | undefined): string {
    return (atoms ?? []).join(', ') || '∅';
}

function buildViolationMessage(params: {
    sourceDefId: string;
    timing: TitanAwareTriggerTiming;
    kind: 'read' | 'write' | 'interaction';
    detail: string;
    contract: TriggerEffectContract | undefined;
}): string {
    const { sourceDefId, timing, kind, detail, contract } = params;
    return [
        `SmashUp effect contract 违规: ${sourceDefId}@${timing}`,
        `类型: ${kind}`,
        `详情: ${detail}`,
        `已声明 reads: ${formatAtoms(contract?.reads)}`,
        `已声明 writes: ${formatAtoms(contract?.writes)}`,
        `已声明 opensInteraction: ${contract?.opensInteraction === true ? 'true' : 'false'}`,
    ].join(' | ');
}

function normalizeObservedPath(path: Array<string | number>): Array<string | number> {
    return path[0] === 'state' ? path.slice(1) : path;
}

function formatObservedPath(path: Array<string | number>): string {
    const normalized = normalizeObservedPath(path);
    return normalized.length > 0 ? `state.${normalized.join('.')}` : 'state';
}

function buildMissingTriggerEffectContractError(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    reason?: string,
): Error {
    return new Error(`SmashUp trigger 缺少声明: ${sourceDefId}::${timing}${reason ? ` (${reason})` : ''}`);
}

export function requireTriggerEffectContract(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    contract: TriggerEffectContract | undefined,
    reason?: string,
): TriggerEffectContract {
    if (!contract) {
        throw buildMissingTriggerEffectContractError(sourceDefId, timing, reason);
    }
    return contract;
}

function getRequiredReadAtomsForPath(path: Array<string | number>): ReactionOrderingAtom[] {
    const normalizedPath = normalizeObservedPath(path);
    const [root, , field] = normalizedPath;
    if (root === 'players') {
        if (normalizedPath.length === 1) {
            return ['playLimits', 'handState', 'deckState', 'madnessDeckState', 'discardState', 'vpState', 'controllerState', 'turnFlags'];
        }
        switch (field) {
            case 'hand':
                return ['handState'];
            case 'deck':
                return ['deckState'];
            case 'discard':
            case 'removedFromGame':
                return ['discardState'];
            case 'vp':
                return ['vpState'];
            case 'minionsPlayed':
            case 'minionLimit':
            case 'actionsPlayed':
            case 'actionLimit':
            case 'extraCardsPlayedThisTurn':
            case 'minionsPlayedPerBase':
            case 'usedDiscardPlayAbilities':
            case 'baseLimitedMinionQuota':
            case 'baseLimitedMinionPowerCaps':
            case 'baseLimitedSameNameRequired':
            case 'baseLimitedSameNameDefId':
            case 'extraMinionPowerMax':
            case 'extraMinionPowerCaps':
            case 'sameNameMinionRemaining':
            case 'sameNameMinionDefId':
            case 'pendingMinionPlayEffects':
            case 'extraTalentUsesConsumed':
                return ['playLimits'];
            case 'factions':
            case 'id':
                return ['controllerState'];
            default:
                return ['controllerState'];
        }
    }

    if (root === 'bases') {
        if (normalizedPath.length === 1) {
            return ['minionBoardState', 'baseState', 'scoringState', 'targetAvailability', 'sourceSelfState', 'triggerMinionState', 'controllerState'];
        }
        switch (field) {
            case 'minions':
                return ['minionBoardState', 'triggerMinionState', 'sourceSelfState', 'controllerState'];
            case 'ongoingActions':
            case 'buriedCards':
            case 'defId':
                return ['baseState', 'sourceSelfState'];
            default:
                return ['minionBoardState', 'baseState', 'scoringState', 'targetAvailability', 'sourceSelfState', 'triggerMinionState', 'controllerState'];
        }
    }

    if (root === 'titans') {
        return ['titanBoardState', 'sourceSelfState', 'controllerState'];
    }

    switch (root) {
        case 'pendingAfterScoringSpecials':
        case 'scoringEligibleBaseIndices':
        case 'beforeScoringTriggeredBases':
        case 'whenScoringTriggeredBases':
        case 'afterScoringTriggeredBases':
        case 'tempBreakpointModifiers':
            return ['scoringState', 'sourceSelfState'];
        case 'currentPlayerIndex':
        case 'turnNumber':
        case 'turnPhase':
        case 'activeDuel':
        case 'playerRestrictionsUntilTurnStart':
        case 'specialLimitUsed':
        case 'suppressedBasesUntilTurnStart':
        case 'suppressedCardsUntilTurnStart':
        case 'turnUsedOngoingUids':
        case 'usedBaseAbilitiesThisTurn':
            return ['turnFlags'];
        case 'triggerQueue':
            return ['turnFlags'];
        default:
            return [];
    }
}

function createReadGuard(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    contract: TriggerEffectContract | undefined,
) {
    const allowedReads = new Set(contract?.reads ?? []);
    const seenObjects = new WeakMap<object, unknown>();

    const proxify = (value: unknown, path: Array<string | number>): unknown => {
        if (!value || typeof value !== 'object') {
            return value;
        }
        const cached = seenObjects.get(value as object);
        if (cached) return cached;

        const proxy = new Proxy(value as Record<string, unknown>, {
            get(target, property, receiver) {
                if (typeof property === 'symbol') {
                    return Reflect.get(target, property, receiver);
                }
                const nextPath = [...path, property];
                const requiredAtoms = getRequiredReadAtomsForPath(nextPath);
                if (requiredAtoms.length > 0 && !requiredAtoms.some(atom => allowedReads.has(atom))) {
                    throw new Error(buildViolationMessage({
                        sourceDefId,
                        timing,
                        kind: 'read',
                        detail: `读取 ${formatObservedPath(nextPath)} 时缺少声明，至少需要其一: ${requiredAtoms.join(', ')}`,
                        contract,
                    }));
                }
                return proxify(Reflect.get(target, property, receiver), nextPath);
            },
            ownKeys(target) {
                const requiredAtoms = getRequiredReadAtomsForPath(path);
                if (requiredAtoms.length > 0 && !requiredAtoms.some(atom => allowedReads.has(atom))) {
                    throw new Error(buildViolationMessage({
                        sourceDefId,
                        timing,
                        kind: 'read',
                        detail: `枚举 ${formatObservedPath(path)} 时缺少声明，至少需要其一: ${requiredAtoms.join(', ')}`,
                        contract,
                    }));
                }
                return Reflect.ownKeys(target);
            },
        });

        seenObjects.set(value as object, proxy);
        return proxy;
    };

    return proxify;
}

function assertWritesDeclared(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    contract: TriggerEffectContract | undefined,
    events: SmashUpEvent[],
): void {
    if (events.length === 0) return;
    if ((contract?.writes?.length ?? 0) > 0) return;

    const meaningfulEvents = events.filter(event => ![
        SU_EVENTS.ABILITY_FEEDBACK,
        SU_EVENTS.ABILITY_TRIGGERED,
        SU_EVENTS.REVEAL_HAND,
        SU_EVENTS.REVEAL_DECK_TOP,
        SU_EVENTS.DECK_INSPECTED,
        SU_EVENTS.TRIGGER_QUEUED,
        SU_EVENTS.TRIGGER_CONSUMED,
    ].includes(event.type as never));

    if (meaningfulEvents.length === 0) return;
    throw new Error(buildViolationMessage({
        sourceDefId,
        timing,
        kind: 'write',
        detail: `返回了 ${meaningfulEvents.map(event => event.type).join(', ')}，但未声明 writes`,
        contract,
    }));
}

function assertInteractionDeclared(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    contract: TriggerEffectContract | undefined,
    beforeState: MatchState<SmashUpCore> | undefined,
    afterState: MatchState<SmashUpCore> | undefined,
): void {
    const beforeCount = countQueuedInteractions(beforeState);
    const afterCount = countQueuedInteractions(afterState);
    if (afterCount <= beforeCount) return;
    if (contract?.opensInteraction === true) return;

    const current = afterState?.sys.interaction?.current;
    const sourceId = current ? asSimpleChoice(current)?.sourceId ?? 'unknown' : 'unknown';
    throw new Error(buildViolationMessage({
        sourceDefId,
        timing,
        kind: 'interaction',
        detail: `打开了新交互 (${sourceId})，但未声明 opensInteraction=true`,
        contract,
    }));
}

export function wrapTriggerCallbackWithEffectContract(
    sourceDefId: string,
    timing: TitanAwareTriggerTiming,
    callback: TriggerCallback,
    contract: TriggerEffectContract | undefined,
): TriggerCallback {
    return (ctx: TriggerContext): SmashUpEvent[] | TriggerResult => {
        const declaredContract = requireTriggerEffectContract(sourceDefId, timing, contract, 'trigger.execute');
        const guard = createReadGuard(sourceDefId, timing, declaredContract);
        const guardedState = guard(ctx.state, []) as SmashUpCore;
        const guardedMatchState = ctx.matchState
            ? {
                ...ctx.matchState,
                core: guard(ctx.matchState.core, []) as SmashUpCore,
            }
            : undefined;

        const result = callback({
            ...ctx,
            state: guardedState,
            matchState: guardedMatchState,
        });

        const normalized = Array.isArray(result)
            ? { events: result, matchState: ctx.matchState }
            : result;
        const normalizedMatchState = normalized.matchState
            ? {
                ...normalized.matchState,
                core: ctx.matchState?.core ?? ctx.state,
            }
            : undefined;
        const sanitized = {
            ...normalized,
            matchState: normalizedMatchState,
        };

        assertWritesDeclared(sourceDefId, timing, declaredContract, sanitized.events);
        assertInteractionDeclared(sourceDefId, timing, declaredContract, ctx.matchState, sanitized.matchState);

        if (Array.isArray(result)) {
            return result;
        }
        return sanitized;
    };
}
