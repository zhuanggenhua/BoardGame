import type { FateDominationCore, LocationId, EventCardDefinition, SituationCardDefinition } from './types';

/** Locked CHM situation and Fuyuki event semantics, independent of presentation text. */
const typesOf = (text: string) => new Set((text.replaceAll('敏捷','迅捷').match(/力量|迅捷|魔术|特殊|宝具/g) ?? []));
const commonType = (types: string[]) => types.length > 0 && [...typesOf(types[0])].some(type => types.every(text => typesOf(text).has(type)));
const isBattlefield = (location: LocationId | null) => location === 'miyama' || location === 'shinto';
export const fateNoblePhantasmsForbidden = (situation: SituationCardDefinition) => ['sit7','sit8','sit9'].includes(situation.id);
export const fateLateClimax = (situation: SituationCardDefinition) => ['sit12','sit13'].includes(situation.id);
export function fateSituationAttackBonus(situation: SituationCardDefinition, type: string, location: LocationId | null): number {
 if(!isBattlefield(location))return 0;
 const bonus:Record<string,[string,number]>={sit4:['力量',2],sit5:['迅捷',2],sit6:['魔术',2],sit7:['魔术',1],sit8:['迅捷',1],sit9:['力量',1]};
 const rule=bonus[situation.id];return rule&&typesOf(type).has(rule[0])?rule[1]:0;
}
export function fateEventBasePower(events: EventCardDefinition[], base: number): number {
 return events.some(event=>event.id==='fuyuki_E6')&&(base===1||base===2)?5:base;
}
export function fateEventAttackBonus(events: EventCardDefinition[], type:string,base:number):number {
 const attributes:Record<string,[string,number]>={fuyuki_E3:['魔术',3],fuyuki_E4:['迅捷',3],fuyuki_E5:['力量',3],fuyuki_E9:['力量',2],fuyuki_E10:['魔术',2],fuyuki_E11:['迅捷',2]};
 return events.reduce((sum,event)=>{const rule=attributes[event.id];return sum+(rule&&typesOf(type).has(rule[0])?rule[1]:0)+(event.id==='fuyuki_E12'&&base>=4?1:0);},0);
}
export function fateEventTerrain(events:EventCardDefinition[],terrain:number):number {
 if(events.some(event=>event.id==='fuyuki_E8'))return 0;
 return terrain*2**events.filter(event=>event.id==='fuyuki_E7').length;
}
export function fateEnvironmentTotalBonus(core:FateDominationCore,playerId:string,attackTypes:string[]):number {
 const player=core.players[playerId];if(!isBattlefield(player.locationId))return 0;
 const shared=commonType(attackTypes);const events=core.battlefield[player.locationId!].eventCards;
 const lowerCount=Object.values(core.players).filter(other=>!other.eliminated&&other.victoryPoints<player.victoryPoints).length;
 return (core.situation.id==='sit10'&&shared?3:0)+events.reduce((sum,event)=>sum+
  (['fuyuki_E1','fuyuki_E2'].includes(event.id)?[12,8,4][lowerCount]??0:0)+
  (['fuyuki_E13','fuyuki_E14'].includes(event.id)&&!player.isRevealed?5:0)+
  (event.id==='fuyuki_E15'&&shared?4:0),0);
}
export function fateSituationEventCounts(situation:SituationCardDefinition):{miyama:number;shinto:number} {
 const extra:Record<string,[number,number]>={sit1:[1,1],sit2:[0,1],sit3:[1,0],sit11:[1,1],sit12:[1,0],sit13:[2,0]};
 const [miyama,shinto]=extra[situation.id]??[0,0];return {miyama:1+miyama,shinto:1+shinto};
}

export function distributeFateRoundEvents(drawn:EventCardDefinition[],situation:SituationCardDefinition):Record<'miyama'|'shinto',EventCardDefinition[]> {
 const counts=fateSituationEventCounts(situation);const extras=drawn.slice(2);
 return {miyama:[...drawn.slice(0,1),...extras.slice(0,counts.miyama-1)],shinto:[...drawn.slice(1,2),...extras.slice(counts.miyama-1)]};
}

/** Resolve only after all battlefield results are fixed; defeat does not remove presence. */
export function fateAfterBattleManaAwards(core:FateDominationCore):Array<{playerId:string;amount:number;sourceId:string}> {
 return (['miyama','shinto'] as const).flatMap(locationId => {
  const location=core.battlefield[locationId];
  return location.eventCards.filter(event=>['fuyuki_E18','fuyuki_E19'].includes(event.id))
   .flatMap(event=>location.playerIds.filter(id=>!core.players[id].eliminated)
    .map(playerId=>({playerId,amount:2,sourceId:event.id})));
 });
}
