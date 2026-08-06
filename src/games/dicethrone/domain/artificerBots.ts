import type { PlayerId } from '../../../engine/types';
import { TOKEN_IDS } from './ids';
import { getTokenStackLimit } from './rules';
import type { DiceThroneCore } from './types';

export const ADVANCED_ARTIFICER_BOT_LIMIT = 2;

export const ARTIFICER_BOT_IDS = [
    TOKEN_IDS.NANOBOT,
    TOKEN_IDS.SHOCK_BOT,
    TOKEN_IDS.HEAL_BOT,
] as const;

export type ArtificerBotTokenId = typeof ARTIFICER_BOT_IDS[number];

export interface ArtificerBotState {
    built: boolean;
    upgraded: boolean;
    activationsUsedThisTurn: number;
}

const ACTIVATION_LIMIT_BY_BOT_ID: Record<ArtificerBotTokenId, number> = {
    [TOKEN_IDS.NANOBOT]: 1,
    [TOKEN_IDS.SHOCK_BOT]: 1,
    [TOKEN_IDS.HEAL_BOT]: 2,
};

export function isArtificerBotTokenId(tokenId: string): tokenId is ArtificerBotTokenId {
    return (ARTIFICER_BOT_IDS as readonly string[]).includes(tokenId);
}

export function getArtificerBotState(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: ArtificerBotTokenId,
): ArtificerBotState {
    const player = state.players[playerId];
    const stored = player?.artificerBotState?.[tokenId];
    if (stored) return stored;

    const tokenAmount = player?.tokens[tokenId] ?? 0;
    const tokenLimit = getTokenStackLimit(state, playerId, tokenId);
    return {
        built: tokenAmount > 0,
        upgraded: tokenLimit >= ADVANCED_ARTIFICER_BOT_LIMIT || tokenAmount >= ADVANCED_ARTIFICER_BOT_LIMIT,
        activationsUsedThisTurn: 0,
    };
}

export function isArtificerBotBuilt(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: ArtificerBotTokenId,
): boolean {
    return getArtificerBotState(state, playerId, tokenId).built;
}

export function isArtificerBotUpgraded(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: ArtificerBotTokenId,
): boolean {
    return getArtificerBotState(state, playerId, tokenId).upgraded;
}

export function getRemainingArtificerBotActivations(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: ArtificerBotTokenId,
): number {
    const botState = getArtificerBotState(state, playerId, tokenId);
    if (!botState.built) return 0;
    return Math.max(
        0,
        ACTIVATION_LIMIT_BY_BOT_ID[tokenId] - (botState.activationsUsedThisTurn ?? 0),
    );
}

export function buildArtificerBotStatePatch(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: ArtificerBotTokenId,
    patch: Partial<ArtificerBotState>,
): DiceThroneCore['players'][PlayerId]['artificerBotState'] | undefined {
    const player = state.players[playerId];
    if (!player) return undefined;
    return {
        ...player.artificerBotState,
        [tokenId]: {
            ...getArtificerBotState(state, playerId, tokenId),
            ...patch,
        },
    };
}

export function buildArtificerBotStateAfterActivation(
    state: DiceThroneCore,
    playerId: PlayerId,
    tokenId: ArtificerBotTokenId,
    amount: number,
): DiceThroneCore['players'][PlayerId]['artificerBotState'] | undefined {
    const botState = getArtificerBotState(state, playerId, tokenId);
    return buildArtificerBotStatePatch(state, playerId, tokenId, {
        built: true,
        activationsUsedThisTurn: (botState.activationsUsedThisTurn ?? 0) + amount,
    });
}
