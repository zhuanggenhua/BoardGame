import {expect,it} from 'vitest';
import {createInitialSystemState,createSeededRandom,executePipeline} from '../../../engine';
import {applyPlayerViewToState} from '../../../engine/ai/playerView';
import {FateDominationDomain} from '../domain';
import {engineConfig} from '../game';

it('查看本人手牌不会经对手或观战者的日志和事件泄露私有牌实例',()=>{
 const ids=['0','1','2'],random=createSeededRandom('inspect-private-proof');
 let state={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'inspect-private-proof')};
 const prepared=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}},random,ids);
 expect(prepared.success).toBe(true);state=prepared.state;
 const cardId=state.core.players['0'].hand[0].id;
 const inspected=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'INSPECT_CARD',playerId:'0',payload:{cardId}},random,ids);
 expect(inspected.success).toBe(true);
 for(const viewer of ['1',null]){
  const view=applyPlayerViewToState(engineConfig,inspected.state,viewer);
  expect(JSON.stringify(view.sys.actionLog)).not.toContain(cardId);
  expect(JSON.stringify(view.sys.eventStream)).not.toContain(cardId);
 }
 const own=applyPlayerViewToState(engineConfig,inspected.state,'0');
 expect(JSON.stringify(own.sys.actionLog)).toContain(cardId);
 expect(JSON.stringify(own.sys.eventStream)).toContain(cardId);
 const publicId=inspected.state.core.situation.id;
 const publicInspection=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},inspected.state,{type:'INSPECT_CARD',playerId:'0',payload:{cardId:publicId}},random,ids);
 expect(publicInspection.success).toBe(true);
 const publicView=applyPlayerViewToState(engineConfig,publicInspection.state,'1');
 expect(JSON.stringify(publicView.sys.actionLog)).toContain(publicId);
 expect(JSON.stringify(publicView.sys.eventStream)).toContain(publicId);
});
