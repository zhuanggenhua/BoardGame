import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import { FATE_ATTACK_CARDS, FATE_MASTERS, FATE_SERVANTS, FATE_SITUATIONS, FATE_EVENTS } from './data';
import type { FateDominationCore } from './domain';

const dedupe = (paths: string[]) => [...new Set(paths)];

export const fateDominationCriticalImageResolver: CriticalImageResolver = (gameState: unknown): CriticalImageResolverResult => {
    const core = (gameState as { core?: FateDominationCore } | undefined)?.core;
    const currentHand = core?.players[core.currentPlayerId]?.hand ?? [];
    const currentCardPaths = currentHand.map((card) => FATE_ATTACK_CARDS.find((definition) => definition.id === card.definitionId)?.assetPath).filter((path): path is string => Boolean(path));
    return {
        critical: dedupe([
            'fate-domination/board/fuyuki-city',
            core?.situation.assetPath ?? FATE_SITUATIONS[0].assetPath,
            core?.miyamaEvent.assetPath ?? FATE_EVENTS[0].assetPath,
            'fate-domination/events/back',
            'fate-domination/situations/back',
            ...currentCardPaths,
        ]),
        warm: dedupe([
            ...FATE_ATTACK_CARDS.map((card) => card.assetPath),
            ...FATE_MASTERS.map((card) => card.assetPath),
            ...FATE_SERVANTS.flatMap((card) => [card.assetPath, ...card.skillAssetPaths]),
            ...FATE_SITUATIONS.map((card) => card.assetPath),
            ...FATE_EVENTS.map((card) => card.assetPath),
        ]),
        phaseKey: `fate-domination:${core?.round ?? 0}:${core?.phase ?? 'unknown'}`,
    };
};

export default fateDominationCriticalImageResolver;
