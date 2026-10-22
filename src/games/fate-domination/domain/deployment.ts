import type {FateDominationCore,LocationId,PlayerState} from './types';
/** CHM setup C/D: workshop mana 2/1/1/1, battlefield terrain 3/1. */
export const FATE_DEPLOYMENT_BONUSES:Record<LocationId,readonly number[]>={workshop:[2,1,1,1],miyama:[3,1],shinto:[3,1],recon:[]};
export function nextFateDeploymentSlot(core:FateDominationCore,locationId:LocationId):number|null {
 const occupied=new Set(core.battlefield[locationId].playerIds.map(id=>core.players[id].deploymentSlot).filter(slot=>slot!==null));
 const index=FATE_DEPLOYMENT_BONUSES[locationId].findIndex((_,index)=>!occupied.has(index));
 return index<0?null:index;
}
export function fateDeploymentManaGain(locationId:LocationId,slot:number|null):number {
 return locationId==='workshop'&&slot!==null ? FATE_DEPLOYMENT_BONUSES.workshop[slot]??0 : 0;
}
export function fateDeploymentTerrain(player:Pick<PlayerState,'locationId'|'deploymentSlot'>):number {
 return (player.locationId==='miyama'||player.locationId==='shinto')&&player.deploymentSlot!==null
  ? FATE_DEPLOYMENT_BONUSES[player.locationId][player.deploymentSlot]??0 : 0;
}
