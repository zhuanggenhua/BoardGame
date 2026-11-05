/**
 * Cardia 对共享调试作弊系统的适配。
 */

import type { CheatResourceModifier } from '../../../engine/systems/CheatSystem';
import type { CardiaCore } from './core-types';
import { PHASE_ORDER } from './core-types';
import { updatePlayer } from './utils';

export const cardiaCheatModifier: CheatResourceModifier<CardiaCore> = {
    getResource: (core, playerId, resourceId) => {
        if (resourceId !== 'signets') return undefined;
        return core.players[playerId]?.signets;
    },

    setResource: (core, playerId, resourceId, value) => {
        if (resourceId !== 'signets' || !core.players[playerId]) return core;
        return updatePlayer(core, playerId, {
            signets: Math.max(0, value),
        });
    },

    setPhase: (core, phase) => {
        const nextPhase = PHASE_ORDER.find((candidate) => candidate === phase);
        return nextPhase ? { ...core, phase: nextPhase } : core;
    },
};

export default cardiaCheatModifier;
