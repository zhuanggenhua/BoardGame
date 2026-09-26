import type { FateDominationCore, LocationId, PlayerState } from './types';

/** Demo 的地图是单向路线：魔术工房→深山町→新都→侦察。 */
export const FATE_LOCATION_ORDER: LocationId[] = ['workshop', 'miyama', 'shinto', 'recon'];
export const FATE_STEP_COST: Record<LocationId, number> = { workshop: 1, miyama: 2, shinto: 2, recon: 0 };

export function movementCost(from: LocationId, to: LocationId): number | null {
    const fromIndex = FATE_LOCATION_ORDER.indexOf(from);
    const toIndex = FATE_LOCATION_ORDER.indexOf(to);
    if (fromIndex < 0 || toIndex <= fromIndex) return null;
    return FATE_LOCATION_ORDER.slice(fromIndex, toIndex).reduce((sum, location) => sum + FATE_STEP_COST[location], 0);
}

export function legalMoveTargets(core: FateDominationCore, player: PlayerState): LocationId[] {
    if (core.phase !== 'action' || !player.locationId) return [];
    const targets: LocationId[] = [];
    for (const locationId of FATE_LOCATION_ORDER) {
        const cost = movementCost(player.locationId, locationId);
        if (cost === null) continue;
        const target = core.battlefield[locationId];
        if (target.capacity !== null && target.playerIds.length >= target.capacity) continue;
        if (player.mana < cost) continue;
        if ((locationId === 'shinto' || locationId === 'recon') && ['身处地狱之门', '天之杯'].includes(core.situation.name)) continue;
        if (target.eventCards.some((event) => event.name === '固有结界')) continue;
        targets.push(locationId);
    }
    return targets;
}

export function situationPowerBonus(core: FateDominationCore, locationId: LocationId, attackTypes: string[]): number {
    if (!['miyama', 'shinto'].includes(locationId)) return 0;
    const name = core.situation.name;
    const type = name === '怒不可遏' ? '力量' : name === '暴风雨前的宁静' ? '迅捷' : ['完美的流动', '安哥拉·曼纽的实质'].includes(name) ? '魔术' : '';
    return type && attackTypes.some((attackType) => attackType.includes(type)) ? (name.startsWith('安哥拉') ? 1 : 2) : 0;
}

export function eventPowerBonus(locationEvents: FateDominationCore['battlefield'][LocationId]['eventCards'], attackTypes: string[], basePowers: number[]): number {
    return locationEvents.reduce((bonus, event) => {
        if (event.name === '强度测验' && attackTypes.some((type) => type.includes('力量'))) return bonus + 3;
        if (event.name === '火力压制' && attackTypes.some((type) => type.includes('迅捷'))) return bonus + 3;
        if (event.name === '圣地' && attackTypes.some((type) => type.includes('魔术'))) return bonus + 3;
        if (event.name === '命运之战') return bonus + basePowers.filter((power) => power <= 2).reduce((sum, power) => sum + (5 - power), 0);
        return bonus;
    }, 0);
}
