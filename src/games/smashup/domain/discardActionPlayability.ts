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
