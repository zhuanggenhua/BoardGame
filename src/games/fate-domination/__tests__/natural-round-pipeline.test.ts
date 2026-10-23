import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FateDominationDomain } from '../domain';
import { engineConfig } from '../game';
import type { FateDominationCommand, FateDominationCore } from '../domain';
import type { MatchState } from '../../../engine/types';

it('基础正式pipeline不注入中途状态，自然洗牌循环到第十一轮与系统终局一致',()=>{
 const ids=['0','1','2'];const random=createSeededRandom('eleven-natural-rounds');
 let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'eleven-natural-rounds')};
 let steps=0;
 const apply=(command:FateDominationCommand)=>{
  expect(FateDominationDomain.validate(state,command).valid,JSON.stringify(command)).toBe(true);
  const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids);
  expect(result.success,JSON.stringify(command)).toBe(true);state=result.state;steps++;
 };
 while(state.core.phase!=='complete'&&steps<500){
  const {core}=state;const playerId=core.currentPlayerId;const player=core.players[playerId];
  if(core.phase==='preparation')apply({type:'ADVANCE_PHASE',playerId,payload:{}});
  else if(core.phase==='outpost')apply(player.locationId?{type:'ADVANCE_PHASE',playerId,payload:{}}:{type:'DEPLOY_MASTER',playerId,payload:{locationId:'miyama'}});
  else if(core.phase==='action'){
   if(!player.normalAttackPlayed){
    let selected:Array<{cardId:string;faceDown:boolean}>|undefined;
    for(let a=0;a<player.hand.length&&!selected;a++)for(let b=a+1;b<player.hand.length&&!selected;b++)for(const mask of [0,1,2,3]){
     const candidate=[{cardId:player.hand[a].id,faceDown:Boolean(mask&1)},{cardId:player.hand[b].id,faceDown:Boolean(mask&2)}];
     const projected={...state,core:{...core,players:{...core.players,[playerId]:{...player,selectedAttackIds:candidate.map(c=>c.cardId),selectedFaceDownIds:candidate.filter(c=>c.faceDown).map(c=>c.cardId)}}}};
     if(FateDominationDomain.validate(projected,{type:'CONFIRM_ATTACK',playerId,payload:{}}).valid){selected=candidate;break;}
    }
    if(selected){apply({type:'CONFIRM_ATTACK',playerId,payload:{cardIds:selected.map(card=>card.cardId),faceDownIds:selected.filter(card=>card.faceDown).map(card=>card.cardId),round:core.round}});continue;}
   }
   apply({type:'PASS_ACTION',playerId,payload:{}});
  }else if(core.battleResolution?.step==='locations'){
   const locationId=core.battleResolution.locationIds.find(id=>!core.resolvedLocations.includes(id))!;
   apply({type:'RESOLVE_LOCATION',playerId,payload:{locationId}});
  }else apply({type:'ADVANCE_PHASE',playerId,payload:{}});
 }
 expect(state.core.round).toBe(11);expect(state.core.phase).toBe('complete');
 expect(state.core.gameResult).toBeDefined();expect(state.sys.gameover).toEqual(state.core.gameResult);
 expect(steps).toBeGreaterThan(150);
},30000);
