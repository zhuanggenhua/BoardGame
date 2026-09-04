import type { ValidationResult } from '../../engine/types';
import type {
    BetrayalCore,
    BetrayalExplorerSummary,
    BetrayalInventoryCard,
    BetrayalRecentRollState,
    BetrayalTraitKey,
} from './game';
import {
    POSSESSION_USE_EFFECTS,
    resolveInventoryEffectId,
    resolveUseEffect,
    type PossessionUseEffectProfile,
} from './possessionEffects';
import {
    clampTraitTrackPosition,
    resolveExplorerTraitTrack,
} from './traitPresentation';
import {
    resolveConnectedRoomIds,
    roomDistanceByLayout,
} from './roomMapModel';
import {
    findExplorerByPlayerId,
    getAllExplorers,
} from './explorerReadModel';
import { isBetrayalPlayerControllingMonster } from './hauntScenarioReadModel';

const MYSTERIOUS_STOPWATCH_CARD_ID = 'mysterious-stopwatch';

type BetrayalEventRollRecentKind = 'eventTraitCheck' | 'eventDiceRoll';
type RecentRollRerollItemMode = 'single-die' | 'all-trait-check-dice' | 'blank-trait-check-dice';

interface RecentRollRerollItemRule {
    label: string;
    mode: RecentRollRerollItemMode;
}

const RECENT_ROLL_REROLL_ITEM_RULES_BY_CARD_ID: Record<string, RecentRollRerollItemRule> = {
    rope: { label: '兔脚', mode: 'single-die' },
    'scary-doll': { label: '恐怖玩偶', mode: 'all-trait-check-dice' },
    'lucky-coin': { label: '幸运硬币', mode: 'blank-trait-check-dice' },
};

export interface BetrayalPossessionSpecialActionStatus {
    sourceKind: 'possession';
    sourceId: string;
    sourceName: string;
    effectId: string;
    active: boolean;
    canUse: boolean;
    usedThisTurn: boolean;
    availableAtTurnStart: boolean;
    receivedThisTurn: boolean;
    reason: string | null;
}

export interface BetrayalPossessionSpecialActionPayload {
    cardId: string;
    targetPlayerId?: string;
    targetRoomId?: string;
    targetRoomIdsByTokenId?: Record<string, string>;
    replacementRollTotal?: number;
}

export interface BetrayalRecentRollRerollItemPayload {
    cardId?: string;
    dieIndex?: number;
}

export function resolveTurnStartInventoryCardIds(
    core: BetrayalCore,
    playerId = core.currentExplorer.playerId,
): string[] {
    return findExplorerByPlayerId(core, playerId)?.inventory.map((card) => card.id) ?? [];
}

export function clearPendingExtraTurnAfterCurrentTurn(
    core: BetrayalCore,
    previousPlayerId: string,
): BetrayalCore['pendingExtraTurnAfterCurrentTurn'] {
    const pending = core.pendingExtraTurnAfterCurrentTurn;
    if (!pending || pending.playerId === previousPlayerId) {
        return null;
    }
    return { ...pending };
}

function resolveTraitDamageAssignableStepsAboveCritical(
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
): number {
    const track = resolveExplorerTraitTrack(explorer, trait);
    return Math.max(0, clampTraitTrackPosition(track) - track.criticalPosition);
}

function resolvePossessionUseCostUnavailableReason(
    explorer: BetrayalExplorerSummary,
    effect: PossessionUseEffectProfile,
    cardName: string,
): string | null {
    if (
        effect.mode === 'nextNonCombatTraitReplacement'
        && resolveTraitDamageAssignableStepsAboveCritical(explorer, 'sanity') < effect.sanityCost
    ) {
        return `神志不足，不能支付${cardName}的 ${effect.sanityCost} 点神志。`;
    }
    return null;
}

function canUseMysteriousStopwatch(core: BetrayalCore): boolean {
    return core.phase === 'haunt' && core.scenarioRuntime.hauntTriggered;
}

export function resolveBetrayalPossessionSpecialActionStatus(
    core: BetrayalCore,
    cardId: string | undefined,
    playerId = core.currentExplorer.playerId,
): BetrayalPossessionSpecialActionStatus {
    const explorer = findExplorerByPlayerId(core, playerId) ?? core.currentExplorer;
    const card = cardId ? explorer.inventory.find((item) => item.id === cardId) : undefined;
    const sourceId = cardId ?? '';
    const effectId = resolveInventoryEffectId(sourceId);
    const active = Boolean(card && Object.prototype.hasOwnProperty.call(POSSESSION_USE_EFFECTS, effectId));
    const effect = active ? POSSESSION_USE_EFFECTS[effectId] : null;
    const usedThisTurn = Boolean(cardId && core.usedCardIdsThisTurn.includes(cardId));
    const receivedThisTurn = Boolean(
        cardId
        && (core.receivedCardIdsThisTurnByPlayerId[playerId] ?? []).includes(cardId),
    );
    const availableAtTurnStart = Boolean(cardId && core.turnStartInventoryCardIds.includes(cardId));
    let reason: string | null = null;
    if (!card) {
        reason = '当前没有可使用持有物。';
    } else if (!active) {
        reason = '该持有物没有主动使用效果。';
    } else if (effectId === MYSTERIOUS_STOPWATCH_CARD_ID && !canUseMysteriousStopwatch(core)) {
        reason = '神秘秒表只能在作祟开始后使用。';
    } else if (effectId === MYSTERIOUS_STOPWATCH_CARD_ID && core.pendingExtraTurnAfterCurrentTurn?.playerId === playerId) {
        reason = '神秘秒表的额外行动已经待结算。';
    } else if (usedThisTurn) {
        reason = '该持有物本回合已经使用。';
    } else if (!availableAtTurnStart || receivedThisTurn) {
        reason = '本回合新获得的持有物不能立刻使用。';
    } else if (effect) {
        reason = resolvePossessionUseCostUnavailableReason(explorer, effect, card?.name ?? sourceId);
    }

    return {
        sourceKind: 'possession',
        sourceId,
        sourceName: card?.name ?? sourceId,
        effectId,
        active,
        canUse: reason === null,
        usedThisTurn,
        availableAtTurnStart,
        receivedThisTurn,
        reason,
    };
}

export function canUseBetrayalPossessionThisTurn(core: BetrayalCore, cardId: string): boolean {
    return resolveBetrayalPossessionSpecialActionStatus(core, cardId).canUse;
}

export function validateBetrayalPossessionSpecialActionCommand(
    core: BetrayalCore,
    playerId: string,
    payload: BetrayalPossessionSpecialActionPayload,
): ValidationResult {
    const cardId = payload.cardId;
    const actor = findExplorerByPlayerId(core, playerId);
    const actionStatus = resolveBetrayalPossessionSpecialActionStatus(core, cardId, playerId);
    if (!actor || !actionStatus.sourceId || !actor.inventory.some((card) => card.id === actionStatus.sourceId)) {
        return { valid: false, error: actionStatus.reason ?? '当前没有可使用持有物。' };
    }
    if (!actionStatus.active) {
        return { valid: false, error: actionStatus.reason ?? '该持有物没有主动使用效果。' };
    }
    const effect = POSSESSION_USE_EFFECTS[actionStatus.effectId];
    if (!effect) {
        return { valid: false, error: '该持有物没有主动使用效果。' };
    }
    if (effect.mode === 'healTraits' && effect.target === 'selfOrSameRoomExplorer' && payload.targetPlayerId) {
        const canTargetSelf = payload.targetPlayerId === actor.playerId;
        const sameRoomTarget = getAllExplorers(core).some((explorer) => (
            explorer.playerId === payload.targetPlayerId
            && explorer.playerId !== actor.playerId
            && explorer.roomId === actor.roomId
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
        ));
        if (!canTargetSelf && !sameRoomTarget) {
            return { valid: false, error: '急救包只能治疗自己或同板块的另一位探索者。' };
        }
    }
    if (effect.mode === 'placeExplorer') {
        const targetRoomId = payload.targetRoomId;
        if (!targetRoomId || !core.rooms.some((room) => room.id === targetRoomId && room.state === 'discovered')) {
            const card = actor.inventory.find((item) => item.id === cardId);
            const cardName = card?.name ?? '该持有物';
            return { valid: false, error: `${cardName}只能把探索者放置到已发现板块。` };
        }
    }
    if (effect.mode === 'moveOthersInRoom') {
        const targetRoomId = payload.targetRoomId;
        const currentRoom = core.rooms.find((room) => room.id === actor.roomId);
        const targetRoomIdsByTokenId = payload.targetRoomIdsByTokenId ?? {};
        const targetTokenIds = [
            ...getAllExplorers(core)
                .filter((explorer) => (
                    explorer.playerId !== actor.playerId
                    && explorer.roomId === actor.roomId
                    && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
                ))
                .map((explorer) => explorer.playerId),
            ...core.monsters
                .filter((monster) => monster.roomId === actor.roomId)
                .map((monster) => monster.id),
        ];
        const hasOtherTargets = targetTokenIds.length > 0;
        const requestedRoomIds = targetTokenIds.map((tokenId) => targetRoomIdsByTokenId[tokenId] ?? targetRoomId);
        const hasTargetForEveryToken = requestedRoomIds.every(Boolean);
        const connectedRoomIds = currentRoom ? resolveConnectedRoomIds(core.rooms, currentRoom.id) : new Set<string>();
        const allTargetsValid = requestedRoomIds.every((roomId) => (
            Boolean(roomId)
            && core.rooms.some((room) => (
                room.id === roomId
                && room.state === 'discovered'
                && connectedRoomIds.has(room.id)
            ))
        ));
        const hasSameRoomExplorerTarget = getAllExplorers(core).some((explorer) => (
            explorer.playerId !== actor.playerId
            && explorer.roomId === actor.roomId
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && Object.prototype.hasOwnProperty.call(targetRoomIdsByTokenId, explorer.playerId)
        ));
        const hasSameRoomMonsterTarget = core.monsters.some((monster) => (
            monster.roomId === actor.roomId
            && Object.prototype.hasOwnProperty.call(targetRoomIdsByTokenId, monster.id)
        ));
        const hasOnlySameRoomTokenKeys = Object.keys(targetRoomIdsByTokenId).every((tokenId) => (
            targetTokenIds.includes(tokenId)
        ));
        if (!hasOtherTargets) {
            return { valid: false, error: '当前板块没有可被面具移动的其他角色或怪物。' };
        }
        if (
            !currentRoom
            || !hasTargetForEveryToken
            || !allTargetsValid
            || !hasOnlySameRoomTokenKeys
            || (
                Object.keys(targetRoomIdsByTokenId).length > 0
                && !hasSameRoomExplorerTarget
                && !hasSameRoomMonsterTarget
            )
        ) {
            return { valid: false, error: '面具只能把同板块其他角色移动到已发现的相邻板块。' };
        }
    }
    if (effect.mode === 'nextNonCombatTraitRollTotalReplacement') {
        const selectedTotal = payload.replacementRollTotal;
        if (!Number.isInteger(selectedTotal) || selectedTotal < effect.minTotal || selectedTotal > effect.maxTotal) {
            return { valid: false, error: `天使之羽必须选择 ${effect.minTotal}-${effect.maxTotal} 之间的整数作为投骰结果。` };
        }
    }
    if (!actionStatus.canUse) {
        return { valid: false, error: actionStatus.reason ?? '该持有物当前不能使用。' };
    }
    return { valid: true };
}

export function canUseBookForPendingEventRoll(core: BetrayalCore, playerId: string, cardId?: string): boolean {
    const pending = core.pendingEventRollResolution;
    const recentRoll = core.recentRoll;
    if (
        !pending
        || !recentRoll
        || pending.rollId !== recentRoll.id
        || pending.playerId !== playerId
        || recentRoll.playerId !== playerId
        || recentRoll.kind !== 'eventTraitCheck'
        || !recentRoll.trait
        || !recentRoll.branchThresholds?.length
    ) {
        return false;
    }
    const owner = findExplorerByPlayerId(core, playerId);
    const candidates = owner?.inventory.filter((card) => (
        resolveUseEffect(card)?.mode === 'nextNonCombatTraitReplacement'
    )) ?? [];
    const card = cardId
        ? candidates.find((candidate) => candidate.id === cardId)
        : candidates[0];
    const effect = card ? resolveUseEffect(card) : null;
    return Boolean(
        card
        && effect?.mode === 'nextNonCombatTraitReplacement'
        && recentRoll.trait !== effect.replacementTrait
        && resolveBetrayalPossessionSpecialActionStatus(core, card.id, playerId).canUse,
    );
}

export function canUseHolySymbolForDiscovery(core: BetrayalCore): boolean {
    return (core.phase === 'preHaunt' || core.phase === 'haunt')
        && core.currentExplorer.inventory.some((card) => resolveInventoryEffectId(card.id) === 'holy-symbol')
        && core.turnStartInventoryCardIds.some((cardId) => resolveInventoryEffectId(cardId) === 'holy-symbol');
}

export function canUseIdolToSkipEvent(core: BetrayalCore): boolean {
    return (core.phase === 'preHaunt' || core.phase === 'haunt')
        && core.currentExplorer.inventory.some((card) => resolveInventoryEffectId(card.id) === 'idol')
        && core.turnStartInventoryCardIds.some((cardId) => resolveInventoryEffectId(cardId) === 'idol');
}

export function resolveSkeletonKeyCardId(explorer: BetrayalExplorerSummary): string | null {
    return explorer.inventory.find((card) => resolveInventoryEffectId(card.id) === 'lockpick-tool')?.id ?? null;
}

export function canUseSkeletonKeyForMove(core: BetrayalCore, targetRoomId: string): boolean {
    const currentRoom = core.rooms.find((room) => room.id === core.currentExplorer.roomId);
    const targetRoom = core.rooms.find((room) => room.id === targetRoomId);
    return Boolean(
        resolveSkeletonKeyCardId(core.currentExplorer)
        && core.movesRemaining > 0
        && currentRoom
        && targetRoom
        && targetRoom.state === 'discovered'
        && currentRoom.floor === targetRoom.floor
        && roomDistanceByLayout(currentRoom, targetRoom) === 1
        && !resolveConnectedRoomIds(core.rooms, currentRoom.id).has(targetRoom.id),
    );
}

export function resolveRabbitFootCard(
    core: BetrayalCore,
    cardId?: string,
    playerId = core.currentExplorer.playerId,
): BetrayalInventoryCard | null {
    const owner = findExplorerByPlayerId(core, playerId);
    const cards = owner?.inventory.filter((card) => resolveInventoryEffectId(card.id) === 'rope') ?? [];
    if (cardId) {
        return cards.find((card) => card.id === cardId) ?? null;
    }
    return cards[0] ?? null;
}

export function resolveRecentRollRerollItemRule(cardId: string): RecentRollRerollItemRule | null {
    return RECENT_ROLL_REROLL_ITEM_RULES_BY_CARD_ID[resolveInventoryEffectId(cardId)] ?? null;
}

function isRecentTraitCheckRoll(recentRoll: BetrayalRecentRollState): boolean {
    return recentRoll.kind === 'eventTraitCheck'
        || recentRoll.kind === 'roomEndTurnTraitCheck';
}

function recentRollAllowsRerollItem(recentRoll: BetrayalRecentRollState, rule: RecentRollRerollItemRule): boolean {
    if (recentRoll.kind === 'eventRolledDamage') {
        return false;
    }
    if (rule.mode === 'single-die') {
        return recentRoll.kind !== 'monsterMoveRoll' && recentRoll.kind !== 'hauntRoll';
    }
    return isRecentTraitCheckRoll(recentRoll);
}

export function resolveRecentRollRerollSelectableDieIndices(
    recentRoll: BetrayalRecentRollState,
    cardId: string,
): number[] {
    const rule = resolveRecentRollRerollItemRule(cardId);
    if (!rule || !recentRollAllowsRerollItem(recentRoll, rule)) {
        return [];
    }
    if (rule.mode === 'blank-trait-check-dice') {
        return recentRoll.dice
            .map((pip, dieIndex) => (pip === 0 ? dieIndex : -1))
            .filter((dieIndex) => dieIndex >= 0);
    }
    return recentRoll.dice.map((_, dieIndex) => dieIndex);
}

export function resolveRecentRollRerollCommandDieIndices(
    recentRoll: BetrayalRecentRollState,
    cardId: string,
    dieIndex = 0,
): number[] {
    const rule = resolveRecentRollRerollItemRule(cardId);
    if (!rule || !recentRollAllowsRerollItem(recentRoll, rule)) {
        return [];
    }
    if (rule.mode === 'single-die') {
        return Number.isInteger(dieIndex) && dieIndex >= 0 && dieIndex < recentRoll.dice.length
            ? [dieIndex]
            : [];
    }
    if (rule.mode === 'blank-trait-check-dice') {
        return recentRoll.dice
            .map((pip, index) => (pip === 0 ? index : -1))
            .filter((index) => index >= 0);
    }
    return recentRoll.dice.map((_, index) => index);
}

export function resolveRecentRollRerollItemCard(
    core: BetrayalCore,
    cardId?: string,
    playerId = core.currentExplorer.playerId,
): BetrayalInventoryCard | null {
    const owner = findExplorerByPlayerId(core, playerId);
    const cards = owner?.inventory.filter((card) => Boolean(resolveRecentRollRerollItemRule(card.id))) ?? [];
    if (cardId) {
        return cards.find((card) => card.id === cardId) ?? null;
    }
    return cards[0] ?? null;
}

function isEventRecentRoll(
    recentRoll: BetrayalRecentRollState | null | undefined,
): recentRoll is BetrayalRecentRollState & { kind: BetrayalEventRollRecentKind } {
    return recentRoll?.kind === 'eventTraitCheck' || recentRoll?.kind === 'eventDiceRoll';
}

export function canUseRecentRollRerollItemForRecentRoll(core: BetrayalCore, playerId: string, cardId?: string): boolean {
    const card = resolveRecentRollRerollItemCard(core, cardId, playerId);
    const rule = card ? resolveRecentRollRerollItemRule(card.id) : null;
    const eventRollStillAwaitingFinalization = isEventRecentRoll(core.recentRoll)
        ? core.pendingEventRollResolution?.rollId === core.recentRoll.id
        : true;
    const receivedThisTurn = core.receivedCardIdsThisTurnByPlayerId[playerId] ?? [];
    const existedAtRollWindowStart = core.recentRoll?.kind === 'roomEndTurnTraitCheck'
        || core.recentRoll?.kind === 'deathPrevention'
        ? !receivedThisTurn.includes(card?.id ?? '')
        : core.turnStartInventoryCardIds.includes(card?.id ?? '');
    return Boolean(
        card
        && rule
        && core.recentRoll
        && recentRollAllowsRerollItem(core.recentRoll, rule)
        && eventRollStillAwaitingFinalization
        && core.recentRoll.playerId === playerId
        && !core.recentRoll.consumedRabbitFootCardIds.includes(card.id)
        && existedAtRollWindowStart
        && !receivedThisTurn.includes(card.id)
        && !core.usedCardIdsThisTurn.includes(card.id)
        && resolveRecentRollRerollSelectableDieIndices(core.recentRoll, card.id).length > 0,
    );
}

export function canUseRabbitFootForRecentRoll(core: BetrayalCore, playerId: string, cardId?: string): boolean {
    const card = resolveRabbitFootCard(core, cardId, playerId);
    return card ? canUseRecentRollRerollItemForRecentRoll(core, playerId, card.id) : false;
}

export function isOwnDeathPreventionRerollWindow(core: BetrayalCore, playerId: string): boolean {
    return core.recentRoll?.kind === 'deathPrevention'
        && core.recentRoll.playerId === playerId
        && Boolean(core.recentRoll.deathPrevention);
}

export function validateBetrayalRecentRollRerollItemCommand(
    core: BetrayalCore,
    playerId: string,
    payload: BetrayalRecentRollRerollItemPayload,
    options: { legacyRabbitFoot?: boolean } = {},
): ValidationResult {
    const isLegacyRabbitFootCommand = Boolean(options.legacyRabbitFoot);
    if (isBetrayalPlayerControllingMonster(core, playerId) && !isOwnDeathPreventionRerollWindow(core, playerId)) {
        return { valid: false, error: '怪物不能使用持有物、预兆、兔脚、交易或搜刮尸体。' };
    }
    const card = isLegacyRabbitFootCommand
        ? resolveRabbitFootCard(core, payload.cardId, playerId)
        : resolveRecentRollRerollItemCard(core, payload.cardId, playerId);
    if (!card) {
        return {
            valid: false,
            error: isLegacyRabbitFootCommand ? '当前探索者没有兔脚。' : '当前探索者没有可用于最近投骰重掷的物品。',
        };
    }
    const canUse = isLegacyRabbitFootCommand
        ? canUseRabbitFootForRecentRoll(core, playerId, card.id)
        : canUseRecentRollRerollItemForRecentRoll(core, playerId, card.id);
    if (!canUse) {
        return {
            valid: false,
            error: isLegacyRabbitFootCommand ? '当前没有可被兔脚重掷的最近投骰。' : '当前没有可被该物品重掷的最近投骰。',
        };
    }
    const dieIndices = core.recentRoll
        ? resolveRecentRollRerollCommandDieIndices(core.recentRoll, card.id, payload.dieIndex ?? 0)
        : [];
    if (dieIndices.length === 0) {
        return {
            valid: false,
            error: isLegacyRabbitFootCommand ? '兔脚必须选择刚刚投过的一颗骰子。' : '该物品没有可重掷的骰子。',
        };
    }
    return { valid: true };
}
