import type { PlayerId } from '../../../engine/types';
import type { PendingBonusDiceSettlement } from '../domain/types';
import { getPendingBonusSettlementDice } from '../domain/rules';
import type { CardSpotlightItem } from './CardSpotlightOverlay';

const CARD_SPOTLIGHT_MATCH_THRESHOLD_MS = 1500;

function normalizePlayerId(value: PlayerId | string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    const match = raw.match(/(\d+)$/);
    return match ? match[1] : raw;
}

function parseDisplayOnlySettlementTimestamp(settlementId: string | undefined): number | null {
    if (!settlementId) return null;
    const match = settlementId.match(/-(\d+)$/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasMatchingSpotlightTimestamp(
    currentSpotlight: CardSpotlightItem,
    settlementTimestamp: number,
): boolean {
    if (Math.abs(currentSpotlight.timestamp - settlementTimestamp) <= CARD_SPOTLIGHT_MATCH_THRESHOLD_MS) {
        return true;
    }

    const bonusDiceTimestamps = currentSpotlight.bonusDice
        ?.map((die) => die.timestamp)
        .filter((value): value is number => typeof value === 'number') ?? [];

    return bonusDiceTimestamps.some((timestamp) => (
        Math.abs(timestamp - settlementTimestamp) <= CARD_SPOTLIGHT_MATCH_THRESHOLD_MS
    ));
}

export interface PendingBonusOverlayVisibilityArgs {
    settlement?: PendingBonusDiceSettlement;
    cardSpotlightQueue: CardSpotlightItem[];
    viewerPlayerId: PlayerId | string;
}

interface BonusDiceInteractionSnapshot {
    kind?: string;
    playerId?: PlayerId | string;
}

interface BonusDiceInteractionStateSnapshot {
    current?: BonusDiceInteractionSnapshot;
    queue?: BonusDiceInteractionSnapshot[];
}

interface BonusDiceResponseWindowStateSnapshot {
    current?: unknown;
}

export interface InteractivePendingBonusOverlayArgs {
    settlement?: PendingBonusDiceSettlement;
    viewerPlayerId: PlayerId | string;
    interactionState?: BonusDiceInteractionStateSnapshot;
    responseWindowState?: BonusDiceResponseWindowStateSnapshot;
}

export function shouldSuppressPendingDisplayOnlyBonusOverlay({
    settlement,
    cardSpotlightQueue,
    viewerPlayerId,
}: PendingBonusOverlayVisibilityArgs): boolean {
    if (!settlement?.displayOnly) return false;

    const viewerId = normalizePlayerId(viewerPlayerId);
    const attackerId = normalizePlayerId(settlement.attackerId);
    if (!attackerId || viewerId === attackerId) return false;

    const currentSpotlight = cardSpotlightQueue[0];
    if (!currentSpotlight) return false;
    if (normalizePlayerId(currentSpotlight.playerId) !== attackerId) return false;

    const spotlightDiceCount = currentSpotlight.bonusDice?.length ?? 0;
    const settlementDiceCount = getPendingBonusSettlementDice(settlement).length;
    if (spotlightDiceCount < settlementDiceCount || settlementDiceCount <= 0) return false;

    const settlementTimestamp = parseDisplayOnlySettlementTimestamp(settlement.id);
    if (settlementTimestamp === null) {
        return true;
    }

    return hasMatchingSpotlightTimestamp(currentSpotlight, settlementTimestamp);
}

export function resolveInteractivePendingBonusDiceSettlement({
    settlement,
    viewerPlayerId,
    interactionState,
    responseWindowState,
}: InteractivePendingBonusOverlayArgs): PendingBonusDiceSettlement | undefined {
    if (!settlement || settlement.displayOnly) {
        return undefined;
    }

    const viewerId = normalizePlayerId(viewerPlayerId);
    const attackerId = normalizePlayerId(settlement.attackerId);
    if (!viewerId || !attackerId || viewerId !== attackerId) {
        return undefined;
    }

    const currentInteraction = interactionState?.current;
    if (currentInteraction?.kind === 'dt:bonus-dice') {
        return settlement;
    }

    if (currentInteraction) {
        return undefined;
    }

    if ((interactionState?.queue?.length ?? 0) > 0) {
        return undefined;
    }

    if (responseWindowState?.current) {
        return undefined;
    }

    return settlement;
}
