import type { FateDominationCore, LocationId } from './types';
export { FATE_LOCATION_ORDER, FATE_STEP_COST, legalMoveTargets, movementCost } from './movement';

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
