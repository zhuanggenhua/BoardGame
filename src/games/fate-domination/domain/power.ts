import type { FateDominationCore } from './types';
import {resolveFateAttack} from './attackSelection';
import {fateDeploymentTerrain} from './deployment';
import { resolveFatePowerValue } from './mechanics';
import { fateSituationAttackBonus, fateEventBasePower, fateEventAttackBonus, fateEventTerrain, fateEnvironmentTotalBonus } from './environmentRules';

export const calculateFatePower = (core: FateDominationCore, playerId: string, cardIds: string[]) => {
    const player = core.players[playerId];
    const selected = [...new Set([...cardIds, ...player.activeSkills])]
        .filter(id => !(player.faceDownAttackIds ?? []).includes(id) && !(player.selectedFaceDownIds ?? []).includes(id))
        .map(id => resolveFateAttack(player, id)?.definition).filter(Boolean);
    const attackTypes = selected.map((card) => card!.type ?? card!.name);
    const location = player.locationId ? core.battlefield[player.locationId] : undefined;
    const events = location?.eventCards ?? [];
    const basePowers = selected.map((card) => {
        const base = fateEventBasePower(events, card!.basePower);
        const type = card!.type ?? '';
        const value = base + fateSituationAttackBonus(core.situation, type, player.locationId) + fateEventAttackBonus(events, type, base);
        const result = resolveFatePowerValue(core, value, {
            selector: 'attack',
            actorId: playerId,
            locationId: player.locationId ?? 'workshop',
            attackTypes: [card!.type ?? card!.name],
        });
        return result.value;
    });
    const base = basePowers.reduce((sum, power) => sum + power, 0);
    const terrain = player.locationId
        ? resolveFatePowerValue(core, fateEventTerrain(events, fateDeploymentTerrain(player)), {
            selector: 'terrain',
            actorId: playerId,
            locationId: player.locationId,
        }).value
        : 0;
    const total = base + terrain + fateEnvironmentTotalBonus(core, playerId, attackTypes);
    return player.locationId
        ? resolveFatePowerValue(core, total, { selector: 'total', actorId: playerId, locationId: player.locationId, attackTypes }).value
        : total;
};

