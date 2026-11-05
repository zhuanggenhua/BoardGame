import {expect,it} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {calculateFatePower} from '../domain/power';
import type {FateDominationCommand,LocationId} from '../domain';
const freshAdapter=()=>createReplayAdapter(FateDominationDomain,'printed-deployment-slots');
const deploy=(locationId:LocationId,playerId:string):FateDominationCommand=>({type:'DEPLOY_MASTER',playerId,payload:{locationId},timestamp:1});
it('工房同值空位均可明确选择，不能选已占点位、跳过更高收益或提交非法序号',()=>{
 const adapter=freshAdapter();
 let state=adapter.setup(['0','1','2']);state.core.phase='outpost';
 const explicit=(playerId:string,deploymentSlot:number|null):FateDominationCommand=>({type:'DEPLOY_MASTER',playerId,payload:{locationId:'workshop',deploymentSlot},timestamp:1});
 expect(FateDominationDomain.validate(state,explicit('0',3)).valid).toBe(false);
 state=adapter.execute(state,explicit('0',0)).state;state.core.currentPlayerId='1';
 const before=state.core.players['1'].mana;
 for(const slot of [1,2,3])expect(FateDominationDomain.validate(state,explicit('1',slot)).valid).toBe(true);
 for(const slot of [0,-1,4,1.5,null,NaN])expect(FateDominationDomain.validate(state,explicit('1',slot)).valid).toBe(false);
 state=adapter.execute(state,explicit('1',3)).state;
 expect(state.core.players['1'].deploymentSlot).toBe(3);
 expect(state.core.players['1'].mana-before).toBe(1);
 state.core.currentPlayerId='2';expect(FateDominationDomain.validate(state,explicit('2',3)).valid).toBe(false);
});
it('工房按四个印刷席位依次给二一一一魔力',()=>{
 const adapter=freshAdapter();
 let state=adapter.setup(['0','1','2','3']);state.core.phase='outpost';
 const before=state.core.playerIds.map(id=>state.core.players[id].mana);
 for(const id of state.core.playerIds){state.core.currentPlayerId=id;state=adapter.execute(state,deploy('workshop',id)).state;}
 expect(state.core.playerIds.map((id,index)=>state.core.players[id].mana-before[index])).toEqual([2,1,1,1]);
 expect(state.core.playerIds.map(id=>state.core.players[id].deploymentSlot)).toEqual([0,1,2,3]);
});
it('战场仅两个部署者占三一地利，第三人无地利且不额外获得魔力',()=>{
 const adapter=freshAdapter();
 let state=adapter.setup(['0','1','2']);state.core.phase='outpost';
 const before=state.core.playerIds.map(id=>state.core.players[id].mana);
 for(const id of state.core.playerIds){state.core.currentPlayerId=id;state=adapter.execute(state,deploy('miyama',id)).state;}
 expect(state.core.playerIds.map(id=>calculateFatePower(state.core,id,[]))).toEqual([3,1,0]);
 expect(state.core.playerIds.map(id=>state.core.players[id].mana)).toEqual(before);
});
it('离开地利后效果移动回来也不重新获得部署地利',()=>{
 const adapter=freshAdapter();
 let state=adapter.setup(['0','1','2']);state.core.phase='outpost';
 // Isolate deployment terrain from randomly drawn movement-lock events.
 state.core.currentEvents={miyama:[],shinto:[]};
 state=adapter.execute(state,deploy('miyama','0')).state;
 state.core.phase='action';state.core.currentPlayerId='0';state.core.players['0'].mana=12;
 expect(calculateFatePower(state.core,'0',[])).toBe(3);
 const outward={type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'move',targetLocationId:'shinto'},timestamp:1} as const;
 expect(FateDominationDomain.validate(state,outward).valid).toBe(true);
 state=adapter.execute(state,outward).state;
 expect(state.core.players['0'].locationId).toBe('shinto');
 expect(state.core.players['0'].deploymentSlot).toBeNull();
 state=adapter.execute(state,{type:'USE_COMMAND_SPELL',playerId:'0',payload:{effect:'move',targetLocationId:'miyama'},timestamp:2}).state;
 expect(state.core.players['0'].locationId).toBe('miyama');
 expect(calculateFatePower(state.core,'0',[])).toBe(0);
});
