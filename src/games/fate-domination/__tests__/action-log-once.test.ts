import {expect,it} from 'vitest';
import {createInitialSystemState,createSeededRandom,executePipeline} from '../../../engine';
import {FateDominationDomain} from '../domain';
import {engineConfig} from '../game';
import {setUndoAiSeatIds} from '../../../engine/systems/UndoSystem';

it('一次准备和一次卡牌检视各产生一条玩家操作日志',()=>{
 const ids=['0','1','2'],random=createSeededRandom('action-log-once');
 let state={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'action-log-once')};
 const prepared=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}},random,ids);
 expect(prepared.success).toBe(true);state=prepared.state;
 expect(state.sys.actionLog.entries.filter(entry=>entry.kind==='ADVANCE_PHASE')).toHaveLength(1);
 const inspected=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'INSPECT_CARD',playerId:'0',payload:{cardId:state.core.players['0'].hand[0].id}},random,ids);
 expect(inspected.success).toBe(true);
 expect(inspected.state.sys.actionLog.entries.filter(entry=>entry.kind==='INSPECT_CARD')).toHaveLength(1);
 expect(inspected.state.sys.undo.snapshots).toEqual(state.sys.undo.snapshots);
});

it('真人部署建立撤回点，电脑部署只进入操作日志', () => {
    const ids = ['0', '1', '2'];
    const random = createSeededRandom('fate-ai-undo-separation');
    let state = setUndoAiSeatIds({ core: FateDominationDomain.setup(ids, random),
        sys: createInitialSystemState(ids, engineConfig.systems, 'fate-ai-undo-separation') }, ['1']);
    const send = (type: string, playerId: string, payload = {}) => {
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, { type, playerId, payload }, random, ids);
        expect(result.success, String(result.error ?? type)).toBe(true);
        state = result.state;
    };
    for (const id of ids) send('ADVANCE_PHASE', id);
    send('DEPLOY_MASTER', '0', { locationId: 'workshop' });
    expect(state.sys.undo.snapshots).toHaveLength(1);
    send('ADVANCE_PHASE', '0');
    send('DEPLOY_MASTER', '1', { locationId: 'miyama' });
    expect(state.sys.undo.snapshots).toHaveLength(1);
    expect(state.sys.actionLog.entries.filter(entry => entry.kind === 'DEPLOY_MASTER').map(entry => entry.actorId)).toEqual(['0', '1']);
});
