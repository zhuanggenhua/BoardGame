import { hasActiveCharacter } from './characterPresenceAccessors';
import type { QidahenCore, QidahenFactionId } from './types';

export const getAttackerDeckPlunderHandBonus = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    plunderPopulation: number,
): number => (
    factionId === 'mongol' && hasActiveCharacter(state, 'mongol', 'mongol-gunchu-ketuji')
        ? Math.max(0, plunderPopulation)
        : 0
);

export const isSunYuanhuaEnabled = (state: QidahenCore): boolean => (
    hasActiveCharacter(state, 'ming', 'ming-sun-yuanhua')
    && hasActiveCharacter(state, 'ming', 'ming-yuan-chonghuan')
);

export const hasJinDefeatLossImmunity = (
    state: QidahenCore,
    factionId: QidahenFactionId | 'neutral',
): boolean => (
    factionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-daisan')
);
