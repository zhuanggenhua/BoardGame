import type {
    QidahenArmamentId,
    QidahenArmamentState,
    QidahenCore,
} from './types';

const QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL = 2;

const isLowFidelityUpgradeableArmament = (armament: QidahenArmamentState): boolean => (
    armament.level > 0 && armament.level < QIDAHEN_ARMAMENT_LOW_FIDELITY_MAX_LEVEL
);

export const upgradeLowFidelityArmament = (
    armaments: QidahenArmamentState[],
    preferredArmamentId: QidahenArmamentId | null = null,
): { armaments: QidahenArmamentState[]; upgradedArmament: QidahenArmamentState | null } => {
    const targetIndex = (() => {
        if (!preferredArmamentId) {
            return armaments.findIndex(isLowFidelityUpgradeableArmament);
        }
        const preferredTargetIndex = armaments.findIndex((armament) => (
            armament.id === preferredArmamentId && isLowFidelityUpgradeableArmament(armament)
        ));
        return preferredTargetIndex >= 0
            ? preferredTargetIndex
            : armaments.findIndex(isLowFidelityUpgradeableArmament);
    })();
    if (targetIndex < 0) {
        return { armaments: armaments.map((armament) => ({ ...armament })), upgradedArmament: null };
    }
    const upgradedArmament = {
        ...armaments[targetIndex],
        level: armaments[targetIndex].level + 1,
    };
    return {
        armaments: armaments.map((armament, index) => (
            index === targetIndex ? upgradedArmament : { ...armament }
        )),
        upgradedArmament,
    };
};

export const hasUpgradableArmament = (
    state: QidahenCore,
    factionId: QidahenCore['factions'][keyof QidahenCore['factions']]['id'],
): boolean => (
    state.factions[factionId].armaments.some(isLowFidelityUpgradeableArmament)
);

export const resolveSelectedArmamentIdFromCards = (
    handCards: readonly Pick<QidahenCore['handCards'][number], 'id' | 'cardKind' | 'armamentId'>[],
    cardIds: readonly string[],
): QidahenArmamentId | null => {
    const armamentIds = new Set<QidahenArmamentId>();
    for (const cardId of cardIds) {
        const card = handCards.find((item) => item.id === cardId);
        if (!card || card.cardKind !== 'armament' || !card.armamentId) {
            continue;
        }
        armamentIds.add(card.armamentId);
        if (armamentIds.size > 1) {
            return null;
        }
    }
    return armamentIds.values().next().value ?? null;
};
