import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import { FateDominationDomain } from '../domain';
import { engineConfig } from '../game';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { FateDominationCore } from '../domain';
import type { MatchState } from '../../../engine/types';
it('真实传输投影不从事件、撤销或旁观交互泄露私有牌序与从者',()=>{
 const ids=['0','1','2'];const random=createSeededRandom('privacy');
 let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'privacy')};
 const selectedResult=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'SELECT_SERVANT',playerId:'0',payload:{servantId:'servant-archer'}},random,ids);expect(selectedResult.success).toBe(true);state=selectedResult.state;
 state=queueInteraction(state,createSimpleChoice('private-choice','0','查看手牌',[{id:'secret-option',label:'秘密牌',value:{cardId:'secret-card'}}],{sourceId:'fate:investigation',targetType:'hand',autoResolveIfSingle:false}));
 for(const viewer of ['1',null]){
  const view=applyPlayerViewToState(engineConfig,state,viewer) as MatchState<FateDominationCore>;
  expect(view.core.players['0'].hand).toEqual([]);expect(view.core.players['0'].servantId).toBe('');
  expect(view.sys.interaction.current).toBeUndefined();expect(view.sys.undo.snapshots).toEqual([]);
  const selected=view.sys.eventStream.entries.find(entry=>entry.event.type==='SERVANT_SELECTED');
  expect(selected?.event.payload).not.toHaveProperty('deck');expect(selected?.event.payload).not.toHaveProperty('servantId');
  expect(JSON.stringify(view.sys)).not.toContain('secret-card');
 }
 const own=applyPlayerViewToState(engineConfig,state,'0') as MatchState<FateDominationCore>;
 expect(own.core.players['0'].hand).toHaveLength(0);expect(own.sys.interaction.current?.id).toBe('private-choice');
 const prepared=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},selectedResult.state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}},random,ids);
 expect(prepared.success).toBe(true);state=prepared.state;
 for(const viewer of ['0','1',null]){
  const view=applyPlayerViewToState(engineConfig,state,viewer) as MatchState<FateDominationCore>;
  const deal=view.sys.eventStream.entries.find(entry=>entry.event.type==='INITIAL_ATTACK_HAND_DEALT')!.event;
  expect(deal.payload).not.toHaveProperty('deck');
  expect(view.core.players['0'].hand).toHaveLength(viewer==='0'?3:0);
 }
});
it('战略部署抽牌事件只给本人牌面，任何视角都不收到重洗后的牌序',()=>{
 const ids=['0','1','2'];const random=createSeededRandom('private-draw');
 let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'private-draw')};
 state=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'SELECT_MASTER',playerId:'0',payload:{masterId:'m_waver'}},random,ids).state;
 state.core.phase='outpost';state.core.players['0'].mana=4;
 const skillId=state.core.players['0'].skills.find(skill=>skill.name==='战略部署')!.id;
 const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'PLAY_SKILL',playerId:'0',payload:{skillId}},random,ids);expect(result.success).toBe(true);state=result.state;
 for(const viewer of ['0','1',null]){
  const view=applyPlayerViewToState(engineConfig,state,viewer) as MatchState<FateDominationCore>;
  const event=view.sys.eventStream.entries.find(entry=>entry.event.type==='FATE_CARDS_DRAWN')!.event;
  expect(event.payload).not.toHaveProperty('deck');expect(event.payload).not.toHaveProperty('discard');
  if(viewer==='0')expect(event.payload).toHaveProperty('drawn');else expect(event.payload).not.toHaveProperty('drawn');
 }
});
it('原子暗置确认的完整传输投影不泄露私有实例或临时选择',()=>{
 const ids=['0','1','2'];const random=createSeededRandom('atomic-private-confirm');
 const state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'atomic-private-confirm')};
 state.core.phase='action';state.core.currentPlayerId='0';
 const player=state.core.players['0'];player.locationId='workshop';player.mana=0;
 player.hand=[{id:'private-atomic-a',definitionId:'cardB4'},{id:'private-atomic-b',definitionId:'cardQ4'}];
 const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'CONFIRM_ATTACK',playerId:'0',payload:{cardIds:['private-atomic-a','private-atomic-b'],faceDownIds:['private-atomic-a','private-atomic-b'],round:state.core.round}},random,ids);
 expect(result.success).toBe(true);
 expect(result.state.sys.eventStream.entries.some(entry=>entry.event.type==='ATTACK_CARD_SELECTED')).toBe(false);
 for(const viewer of ['1',null]){
  const view=applyPlayerViewToState(engineConfig,result.state,viewer) as MatchState<FateDominationCore>;
  expect(JSON.stringify(view)).not.toContain('private-atomic-a');
  expect(JSON.stringify(view)).not.toContain('private-atomic-b');
  expect(view.core.players['0'].publicView?.playedCards).toHaveLength(2);
 }
});
