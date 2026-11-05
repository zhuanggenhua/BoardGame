import {canPlayAttack} from './movement';
import {FATE_ATTACK_BY_ID, FATE_SERVANT_BY_ID} from '../data';
import type {PlayerState, AttackCardDefinition, SkillDefinition, FateDominationCore, ConfirmAttackCommand} from './types';

export interface FateAttackSelection { cardIds: readonly string[]; faceDownIds: readonly string[]; }

/** Read-only draft projection. Neither the authoritative state nor its arrays are mutated. */
export function projectFateAttackSelection(core:FateDominationCore, playerId:string, selection:FateAttackSelection):FateDominationCore {
    return {...core,players:{...core.players,[playerId]:{...core.players[playerId],
        selectedAttackIds:[...selection.cardIds],selectedFaceDownIds:[...selection.faceDownIds],
    }}};
}

/** New confirmation is atomic; malformed explicit drafts never fall back to legacy selection. */
export function resolveFateAttackConfirmation(core:FateDominationCore, playerId:string, payload:ConfirmAttackCommand['payload']):FateDominationCore|undefined {
    if(!payload || typeof payload!=='object' || Array.isArray(payload))return undefined;
    if(Object.keys(payload).length===0)return core;
    const {cardIds,faceDownIds,round}=payload;
    if(Object.keys(payload).some(key=>!['cardIds','faceDownIds','round'].includes(key))
        || round!==core.round || !Array.isArray(cardIds) || cardIds.length!==2
        || cardIds.some(id=>typeof id!=='string') || new Set(cardIds).size!==2
        || !Array.isArray(faceDownIds) || new Set(faceDownIds).size!==faceDownIds.length
        || faceDownIds.some(id=>typeof id!=='string' || !cardIds.includes(id)))return undefined;
    return projectFateAttackSelection(core,playerId,{cardIds,faceDownIds});
}

/** One rule projection for normal attacks from either the hand or servant skill area. */
export function resolveFateAttack(player: PlayerState, id: string): {kind:'hand'|'skill'; definition:AttackCardDefinition; skill?:SkillDefinition} | undefined {
    const card=player.hand.find(card=>card.id===id);
    if(card) {
        const definition=FATE_ATTACK_BY_ID[card.definitionId];
        return definition ? {kind:'hand',definition} : undefined;
    }
    const skill=player.skills.find(skill=>skill.id===id);
    const servant=FATE_SERVANT_BY_ID[player.servantId];
    const index=servant?.skillCards?.findIndex(definition=>definition.id===skill?.id.split(':')[0]) ?? -1;
    if(!skill || index<0 || typeof skill.power!=='number' || skill.type==='被动') return undefined;
    return {kind:'skill',skill,definition:{
        id:skill.id,kind:'skill',name:skill.name,assetPath:servant.skillAssetPaths[index],
        manaCost:Number(skill.cost??skill.req??0),basePower:skill.power,type:skill.type,
        sourceStatus:servant.sourceStatus,
    }};
}
export const selectedFateAttackCost=(player:PlayerState)=>player.selectedAttackIds.reduce((sum,id)=>sum+((player.selectedFaceDownIds??[]).includes(id)?0:resolveFateAttack(player,id)?.definition.manaCost??0),0);

/** Printed attacks may be placed face down without paying; skills cannot. */
export function canSelectFateAttack(core:import('./types').FateDominationCore,playerId:string,id:string,faceDown=false) {
 const player=core.players[playerId];const attack=resolveFateAttack(player,id);
 if(!attack || player.activeAttackIds.includes(id))return {valid:false,error:'staleCard'};
 if(player.defeatMarkers.length)return {valid:false,error:'defeatActive'};
 if(!player.locationId)return {valid:false,error:'notDeployed'};
 if(faceDown)return attack.kind==='hand'?{valid:true}:{valid:false,error:'skillCannotBeFaceDown'};
 const hasLancelotLowManaException=player.skills.some(skill=>skill.id.split(':')[0]==='sc_lance_2');
 if(attack.kind==='skill'&&((player.mana<8&&!hasLancelotLowManaException)||player.activeSkills.includes(id)))return {valid:false,error:'skillAttackUnavailable'};
 return canPlayAttack(core,playerId,attack.definition);
}
export function hasAffordableFateFaceUpAttack(core:import('./types').FateDominationCore,playerId:string):boolean {
 const player=core.players[playerId];
 return [...player.hand.map(card=>card.id),...player.skills.map(skill=>skill.id)].some(id=>canSelectFateAttack(core,playerId,id).valid && (resolveFateAttack(player,id)?.definition.manaCost??Infinity)<=player.mana);
}
/** Includes legal mixed/face-down pairs; compulsory play cannot be skipped just for lack of mana. */
export function hasLegalFateNormalPlay(core:import('./types').FateDominationCore,playerId:string):boolean {
 const player=core.players[playerId];
 const ids=[...player.hand.map(card=>card.id),...player.skills.map(skill=>skill.id)];
 const choices=ids.flatMap(id=>[false,true].filter(faceDown=>canSelectFateAttack(core,playerId,id,faceDown).valid).map(faceDown=>({id,faceDown,cost:faceDown?0:resolveFateAttack(player,id)!.definition.manaCost})));
 const mustFaceUp=['miyama','shinto'].includes(player.locationId??'')&&hasAffordableFateFaceUpAttack(core,playerId);
 return choices.some((a,i)=>choices.slice(i+1).some(b=>a.id!==b.id&&a.cost+b.cost<=player.mana&&(!mustFaceUp||!a.faceDown||!b.faceDown)));
}
