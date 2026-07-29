import type { PlayerId } from '../../../engine/types';
import type { CardInstance, SmashUpCore } from './types';

export interface DiscardActionPlayOption {
    card: CardInstance;
    targetMode?: 'none' | 'base' | 'minion';
    allowedBaseIndices: number[] | 'all';
    allowedMinionUids?: string[];
    /** false 表示这次从弃牌堆打出是额外行动，不消耗常规行动额度。 */
    consumesNormalLimit?: boolean;
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

    const result: DiscardActionPlayOption[] = [];
    const seenUids = new Set<string>();
    for (const provider of providers) {
        const options = provider.getPlayableCards(core, playerId);
        for (const option of options) {
            if (seenUids.has(option.card.uid)) continue;
            if (player.actionsPlayed >= player.actionLimit && option.consumesNormalLimit !== false) {
                continue;
            }
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
    targetBaseIndex?: number,
    targetMinionUid?: string,
): { allowed: true; sourceId: string; consumesNormalLimit?: boolean } | null {
    const option = getDiscardActionPlayOptions(core, playerId).find(entry => entry.card.uid === cardUid);
    if (!option) return null;
    const targetMode = option.targetMode ?? (option.allowedMinionUids?.length ? 'minion' : 'base');
    if (targetMode === 'none') {
        if (targetBaseIndex !== undefined || targetMinionUid !== undefined) {
            return null;
        }
        return {
            allowed: true,
            sourceId: option.sourceId,
            consumesNormalLimit: option.consumesNormalLimit,
        };
    }
    if (typeof targetBaseIndex !== 'number') {
        return null;
    }
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
    return {
        allowed: true,
        sourceId: option.sourceId,
        consumesNormalLimit: option.consumesNormalLimit,
    };
}

export function __getDiscardActionPlayProviderIdsForTest(): string[] {
    return providers.map(provider => provider.id);
}
