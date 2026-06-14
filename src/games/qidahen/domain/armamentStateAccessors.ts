import type { QidahenArmamentId, QidahenCore, QidahenFactionId } from './types';

export const getArmamentLevel = (
    state: QidahenCore,
    factionId: QidahenFactionId | null,
    armamentId: QidahenArmamentId,
): number => {
    if (!factionId) {
        return 0;
    }
    return state.factions[factionId].armaments.find((armament) => armament.id === armamentId)?.level ?? 0;
};
