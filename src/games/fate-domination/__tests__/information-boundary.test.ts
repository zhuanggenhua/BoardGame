import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import { FateDominationDomain } from '../domain';
import { engineConfig } from '../game';
import { applyPlayerViewToState } from '../../../engine/ai/playerView';
import type { Command, MatchState } from '../../../engine/types';
import type { FateDominationCore } from '../domain';

it('韦伯看到抽牌后不能退款撤销；之后的部署仍能撤回到抽牌后', () => {
    const ids = ['0', '1', '2']; const random = createSeededRandom('private-draw-barrier');
    let state: MatchState<FateDominationCore> = { core: FateDominationDomain.setup(ids, random), sys: createInitialSystemState(ids, engineConfig.systems, 'local:private-draw-barrier') };
    const run = (command: Command) => executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, ids);
    const apply = (command: Command) => { const result = run(command); expect(result.success, command.type).toBe(true); state = result.state; };
    apply({ type: 'SELECT_MASTER', playerId: '0', payload: { masterId: 'm_waver' } });
    for (const playerId of ids) apply({ type: 'ADVANCE_PHASE', playerId, payload: {} });
    state.core.players['0'].mana = 4;
    const count = state.core.players['0'].hand.length;
    const skillId = state.core.players['0'].skills.find(skill => skill.name === '战略部署')!.id;
    apply({ type: 'PLAY_SKILL', playerId: '0', payload: { skillId } });
    expect(state.core.players['0'].hand).toHaveLength(count + 2); expect(state.core.players['0'].mana).toBe(3);
    expect(state.sys.undo.snapshots).toEqual([]); expect(state.sys.undo.snapshotCursors ?? []).toEqual([]);
    const undo = run({ type: 'SYS_REQUEST_UNDO', playerId: '0', payload: { localAutoApprove: true } });
    expect(undo.success).toBe(false); expect(undo.state.core.players['0'].hand).toHaveLength(count + 2);
    expect(run({ type: 'SYS_APPROVE_UNDO', playerId: '1', payload: {} }).success).toBe(false);
    apply({ type: 'DEPLOY_MASTER', playerId: '0', payload: { locationId: 'workshop' } });
    const view = applyPlayerViewToState(engineConfig, state, '0') as MatchState<FateDominationCore>;
    expect(view.sys.undo.snapshots).toEqual([]); expect((view.sys.undo as { snapshotCount?: number }).snapshotCount).toBe(1);
    apply({ type: 'SYS_REQUEST_UNDO', playerId: '0', payload: { localAutoApprove: true } });
    expect(state.core.players['0'].locationId).toBeNull(); expect(state.core.players['0'].hand).toHaveLength(count + 2); expect(state.core.players['0'].mana).toBe(3);
});
it('改选从者不抽牌；首次完成准备发牌后清理旧撤销快照',()=>{
 const ids=['0','1','2'];const random=createSeededRandom('summon-barrier');
 let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'local:summon-barrier')};
 state.sys.undo={...state.sys.undo,snapshots:[state],snapshotCursors:[0]};
 const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'SELECT_SERVANT',playerId:'0',payload:{servantId:'servant-archer'}},random,ids);
 expect(result.success).toBe(true);expect(result.state.core.players['0'].hand).toHaveLength(0);
 // 共享撤回已支持多步：改选身份保留既有快照并产生自己的撤回点，发牌后须全部清空。
 expect(result.state.sys.undo.snapshots).toHaveLength(state.sys.undo.snapshots.length+1);
 const prepared=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},result.state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}},random,ids);
 expect(prepared.success).toBe(true);expect(prepared.state.core.players['0'].hand).toHaveLength(3);expect(prepared.state.sys.undo.snapshots).toEqual([]);expect(prepared.state.sys.undo.snapshotCursors??[]).toEqual([]);
});
it('最后一人结束前哨揭示新都事件后，不能退回隐藏事件前',()=>{
 const ids=['0','1','2'];const random=createSeededRandom('hidden-event-barrier');
 let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,'local:hidden-event-barrier')};
 const apply=(command:Command)=>{const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids);expect(result.success).toBe(true);state=result.state;};
 for(const playerId of ids)apply({type:'ADVANCE_PHASE',playerId,payload:{}});
 for(const playerId of ids){apply({type:'DEPLOY_MASTER',playerId,payload:{locationId:'workshop'}});if(playerId==='2'){expect(state.core.shintoEventFaceDown).toBe(true);expect(state.sys.undo.snapshots.length).toBeGreaterThan(0);}apply({type:'ADVANCE_PHASE',playerId,payload:{}});}
 expect(state.core.phase).toBe('action');expect(state.core.shintoEventFaceDown).toBe(false);expect(state.sys.undo.snapshots).toEqual([]);
});
