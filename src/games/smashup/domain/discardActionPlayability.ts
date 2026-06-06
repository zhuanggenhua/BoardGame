import type { PlayerId } from '../../../engine/types';
import type { CardInstance, SmashUpCore } from './types';

export interface DiscardActionPlayOption {
    card: CardInstance;
    allowedBaseIndices: number[] | 'all';
    allowedMinionUids?: string[];
    sourceId: string;
    defId: string;
    name: string;
}

export interface DiscardActionPlayProvider {
    id: string;
    getPlayableCards(core: SmashUpCore, playerId: PlayerId): DiscardActionPlayOption[];
}

const providers: DiscardActionPlayProvider[] = [];

export function registerDiscardActionPlayProvider(provider: DiscardActionPlayProvider): void {
    if (providers.some(entry => entry.id === provider.id)) return;
    providers.push(provider);
}

export function clearDiscardActionPlayProviders(): void {
    providers.length = 0;
}

export function getDiscardActionPlayOptions(core: SmashUpCore, playerId: PlayerId): DiscardActionPlayOption[] {
    const player = core.players[playerId];
    if (!player) return [];
    if (player.actionsPlayed >= player.actionLimit) return [];

    const result: DiscardActionPlayOption[] = [];
    const seenUids = new Set<string>();
    for (const provider of providers) {
        const options = provider.getPlayableCards(core, playerId);
        for (const option of options) {
            if (seenUids.has(option.card.uid)) continue;
            seenUids.add(option.card.uid);
            result.push(option);
        }
    }
    return result;
}

export function canPlayActionFromDiscard(
    core: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    targetBaseIndex: number,
    targetMinionUid?: string,
): { allowed: true; sourceId: string } | null {
    const option = getDiscardActionPlayOptions(core, playerId).find(entry => entry.card.uid === cardUid);
    if (!option) return null;
    if (option.allowedBaseIndices !== 'all' && !option.allowedBaseIndices.includes(targetBaseIndex)) {
        return null;
    }
    if (option.allowedMinionUids && option.allowedMinionUids.length > 0) {
        if (!targetMinionUid || !option.allowedMinionUids.includes(targetMinionUid)) {
            return null;
        }
    } else if (targetMinionUid !== undefined) {
        return null;
    }
    return { allowed: true, sourceId: option.sourceId };
}

export function __getDiscardActionPlayProviderIdsForTest(): string[] {
    return providers.map(provider => provider.id);
}
