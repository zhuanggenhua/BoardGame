import type { PlayerId } from '../../../engine/types';
import type { CardInstance, SmashUpCore } from './types';

export interface DiscardSpecialOption {
    card: CardInstance;
    allowedBaseIndices: number[] | 'all';
    allowedMinionUids?: string[];
    sourceId: string;
    defId: string;
    name: string;
}

export interface DiscardSpecialProvider {
    id: string;
    getActivatableCards(core: SmashUpCore, playerId: PlayerId): DiscardSpecialOption[];
}

const providers: DiscardSpecialProvider[] = [];

export function registerDiscardSpecialProvider(provider: DiscardSpecialProvider): void {
    if (providers.some(entry => entry.id === provider.id)) return;
    providers.push(provider);
}

export function clearDiscardSpecialProviders(): void {
    providers.length = 0;
}

export function getDiscardSpecialOptions(core: SmashUpCore, playerId: PlayerId): DiscardSpecialOption[] {
    const result: DiscardSpecialOption[] = [];
    const seenUids = new Set<string>();
    for (const provider of providers) {
        const options = provider.getActivatableCards(core, playerId);
        for (const option of options) {
            if (seenUids.has(option.card.uid)) continue;
            seenUids.add(option.card.uid);
            result.push(option);
        }
    }
    return result;
}

export function canActivateSpecialFromDiscard(
    core: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    baseIndex: number,
    targetMinionUid?: string,
): { allowed: boolean; sourceId: string } | null {
    const options = getDiscardSpecialOptions(core, playerId);
    const option = options.find(entry => entry.card.uid === cardUid);
    if (!option) return null;
    if (option.allowedBaseIndices !== 'all' && !option.allowedBaseIndices.includes(baseIndex)) return null;
    if (option.allowedMinionUids && option.allowedMinionUids.length > 0) {
        if (!targetMinionUid || !option.allowedMinionUids.includes(targetMinionUid)) return null;
    } else if (targetMinionUid !== undefined) {
        return null;
    }
    return { allowed: true, sourceId: option.sourceId };
}

export function __getDiscardSpecialProviderIdsForTest(): string[] {
    return providers.map(provider => provider.id);
}
