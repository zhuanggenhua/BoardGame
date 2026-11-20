import type {FateDominationCore,LocationId,PlayerState} from './types';
/** CHM setup C/D: workshop mana 2/1/1/1, battlefield terrain 3/1. */
export const FATE_DEPLOYMENT_BONUSES:Record<LocationId,readonly number[]>={workshop:[2,1,1,1],miyama:[3,1],shinto:[3,1],recon:[]};
export function fateOccupiedDeploymentSlots(player: Pick<PlayerState, 'deploymentSlot' | 'secondaryDeploymentSlot'>): number[] {
 return [player.deploymentSlot, player.secondaryDeploymentSlot].filter((slot): slot is number => typeof slot === 'number');
}
export function legalFateDeploymentSlots(core:FateDominationCore,locationId:LocationId):(number|null)[] {
 const occupied=new Set(core.battlefield[locationId].playerIds.flatMap(id=>fateOccupiedDeploymentSlots(core.players[id])));
 const remaining=FATE_DEPLOYMENT_BONUSES[locationId].map((bonus,index)=>({bonus,index})).filter(slot=>!occupied.has(slot.index));
 if(!remaining.length)return locationId==='miyama'||locationId==='shinto'?[null]:[];
 const highest=Math.max(...remaining.map(slot=>slot.bonus));
 return remaining.filter(slot=>slot.bonus===highest).map(slot=>slot.index);
}
export function nextFateDeploymentSlot(core:FateDominationCore,locationId:LocationId):number|null {
 return legalFateDeploymentSlots(core,locationId)[0]??null;
}
export function fateDeploymentManaGain(locationId:LocationId,slot:number|null):number {
 return locationId==='workshop'&&slot!==null ? FATE_DEPLOYMENT_BONUSES.workshop[slot]??0 : 0;
}
export function fateDeploymentTerrain(player:Pick<PlayerState,'locationId'|'deploymentSlot'|'secondaryDeploymentSlot'>):number {
 const location = player.locationId;
 return location === 'miyama' || location === 'shinto'
  ? fateOccupiedDeploymentSlots(player).reduce((total, slot) => total + (FATE_DEPLOYMENT_BONUSES[location][slot] ?? 0), 0) : 0;
}
