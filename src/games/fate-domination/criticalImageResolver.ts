import {fateCardImageAsset} from './data/cardArtwork';
import {projectFateSkillCards} from './domain/playerView';
import type {CriticalImageResolver} from '../../core/types';
import {FATE_ATTACK_BY_ID, FATE_MASTER_BY_ID, FATE_SERVANT_BY_ID} from './data';
import {fateTokenAsset, fateCommandSealPreview} from './data/identityArtwork';
import type {FateDominationCore} from './domain';
const dedupe=(paths:Array<string|undefined>)=>[...new Set(paths.filter((path):path is string=>Boolean(path)).map(fateCardImageAsset))];
/** Load the visible player's table, not every image in the game's catalogue. */
export const fateDominationCriticalImageResolver:CriticalImageResolver=(gameState,_locale,playerID)=>{
 const core=(gameState as {core?:FateDominationCore}|undefined)?.core;
 const viewerId=playerID===null?null:(playerID??core?.currentPlayerId);
 const viewer=viewerId?core?.players[viewerId]:undefined;
 const servant=viewer?FATE_SERVANT_BY_ID[viewer.servantId]:undefined;
 const critical:Array<string|undefined>=['fate-domination/board/fuyuki-city','fate-domination/events/back','fate-domination/situations/back','fate-domination/backs/servant','fate-domination/backs/skill',core?.situation.assetPath];
 const warm:Array<string|undefined>=[];
 if(core){
  critical.push(...core.currentEvents.miyama.map(card=>card.assetPath));
  if(!core.shintoEventFaceDown)critical.push(...core.currentEvents.shinto.map(card=>card.assetPath));
  for(const id of core.playerIds){
   const player=core.players[id];critical.push(FATE_MASTER_BY_ID[player.masterId]?.assetPath);
   if(player.locationId)critical.push(fateTokenAsset(player.masterId));
   const publicCards=player.publicView?.playedCards??player.hand.filter(card=>player.activeAttackIds.includes(card.id));
   warm.push(...projectFateSkillCards(player,viewerId).flatMap(card=>card?[card.assetPath]:[]));
   warm.push(...publicCards.map(card=>FATE_ATTACK_BY_ID[card.definitionId]?.assetPath));
   if(id===viewerId || player.isRevealed){
    const identity=FATE_SERVANT_BY_ID[player.servantId];warm.push(identity?.assetPath,...(identity?.skillAssetPaths??[]));
   }
   const seal=fateCommandSealPreview(player.masterId);
   if(seal?.type==='image')warm.push(seal.src);
   else if(seal?.type==='atlas')warm.push('fate-domination/seals/command-seal-shared-atlas');
  }
 }
 if(viewer && core?.phase!=='preparation')critical.push(...viewer.hand.map(card=>FATE_ATTACK_BY_ID[card.definitionId]?.assetPath),...(servant?.skillAssetPaths??[]));
 warm.push(...(viewer?.discard??[]).map(card=>FATE_ATTACK_BY_ID[card.definitionId]?.assetPath));
 const visible=dedupe(critical);
 return {critical:visible,warm:dedupe(warm).filter(path=>!visible.includes(path)),replaceStaticCritical:true,preserveMountedScene:true,phaseKey:`fate-domination:${core?.round??0}:${core?.phase??'unknown'}:${viewerId??'spectator'}`};
};
export default fateDominationCriticalImageResolver;
