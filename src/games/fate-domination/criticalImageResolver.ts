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
 const critical:Array<string|undefined>=['fate-domination/board/fuyuki-city','fate-domination/events/back','fate-domination/situations/back','fate-domination/backs/servant','fate-domination/backs/skill'];
 const warm:Array<string|undefined>=[];
 // 首屏素材可以阻塞入场。后续补牌和换日由各牌面自行加载，棋盘持续可见。
 const visibleAssets = core?.round === 1 && core.phase === 'preparation' ? critical : warm;
 visibleAssets.push(core?.situation.assetPath);
 if(core){
  visibleAssets.push(...core.currentEvents.miyama.map(card=>card.assetPath));
  if(!core.shintoEventFaceDown)visibleAssets.push(...core.currentEvents.shinto.map(card=>card.assetPath));
  for(const id of core.playerIds){
   const player=core.players[id];visibleAssets.push(FATE_MASTER_BY_ID[player.masterId]?.assetPath);
   visibleAssets.push(fateTokenAsset(player.masterId));
   const publicCards=player.publicView?.playedCards??player.hand.filter(card=>player.activeAttackIds.includes(card.id));
   warm.push(...projectFateSkillCards(player,viewerId).flatMap(card=>card?[card.assetPath]:[]));
   warm.push(...publicCards.map(card=>FATE_ATTACK_BY_ID[card.definitionId]?.assetPath));
   if(id===viewerId || player.isRevealed){
    const identity=FATE_SERVANT_BY_ID[player.servantId];visibleAssets.push(identity?.assetPath,...(identity?.skillAssetPaths??[]));
   }
   const seal=fateCommandSealPreview(player.masterId);
   if(seal?.type==='image')visibleAssets.push(seal.src);
   else if(seal?.type==='atlas')visibleAssets.push('fate-domination/seals/command-seal-shared-atlas');
  }
 }
 if(viewer && core?.phase!=='preparation')warm.push(...viewer.hand.map(card=>FATE_ATTACK_BY_ID[card.definitionId]?.assetPath),...(servant?.skillAssetPaths??[]));
 warm.push(...(viewer?.discard??[]).map(card=>FATE_ATTACK_BY_ID[card.definitionId]?.assetPath));
 const visible=dedupe(critical);
 return {critical:visible,warm:dedupe(warm).filter(path=>!visible.includes(path)),replaceStaticCritical:true,preserveMountedScene:true,phaseKey:`fate-domination:${core?.round??0}:${core?.phase??'unknown'}:${viewerId??'spectator'}`};
};
export default fateDominationCriticalImageResolver;
