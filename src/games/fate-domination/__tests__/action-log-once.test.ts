import {expect,it} from 'vitest';
import {createInitialSystemState,createSeededRandom,executePipeline} from '../../../engine';
import {FateDominationDomain} from '../domain';
import {engineConfig} from '../game';

it('一次准备和一次卡牌检视各产生一条玩家操作日志',()=>{
 const ids=['0','1','2'],random=createSeededRandom('action-log-once');
 let state={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'action-log-once')};
 const prepared=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}},random,ids);
 expect(prepared.success).toBe(true);state=prepared.state;
 expect(state.sys.actionLog.entries.filter(entry=>entry.kind==='ADVANCE_PHASE')).toHaveLength(1);
 const inspected=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'INSPECT_CARD',playerId:'0',payload:{cardId:state.core.players['0'].hand[0].id}},random,ids);
 expect(inspected.success).toBe(true);
 expect(inspected.state.sys.actionLog.entries.filter(entry=>entry.kind==='INSPECT_CARD')).toHaveLength(1);
});
