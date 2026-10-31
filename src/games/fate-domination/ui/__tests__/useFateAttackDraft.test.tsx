import {act,renderHook} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {createInitialSystemState,createSeededRandom,executePipeline} from '../../../../engine';
import type {MatchState} from '../../../../engine/types';
import {FateDominationDomain,type FateDominationCore} from '../../domain';
import type {ConfirmAttackCommand} from '../../domain/types';
import {engineConfig} from '../../game';
import {buildFateTutorialPlan,FATE_TUTORIAL_SEED} from '../../tutorial';
import {useFateAttackDraft} from '../useFateAttackDraft';

// 只借用已合法复演的开局牌序建立夹具；下面验证客户端提交合同，不以教程文案证明规则。
const ids=['1','0','2'];
const random=createSeededRandom(FATE_TUTORIAL_SEED);
let cursor:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,FATE_TUTORIAL_SEED)};
let beforeAttack:MatchState<FateDominationCore>|undefined;
let pair:string[]=[];
for(const command of buildFateTutorialPlan().commands){
    if(!beforeAttack&&command.playerId==='0'&&command.type==='CONFIRM_ATTACK'){
        beforeAttack=structuredClone(cursor);
        pair=[...(command.payload as {cardIds:string[]}).cardIds];
    }
    const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},cursor,command,random,ids);
    if(!result.success)throw new Error(`草稿测试合法前提失败：${command.type}/${result.error}`);
    cursor=result.state;
    if(beforeAttack&&cursor.core.round>beforeAttack.core.round)break;
}
if(!beforeAttack||pair.length!==2)throw new Error('草稿测试未取得合法首轮攻击及下一轮状态');
const opening=beforeAttack,nextRound=cursor;
const selectPair=(toggle:(id:string)=>void)=>act(()=>{for(const id of pair)toggle(id);});

it('普通牌与技能混选、撤回只改客户端；确认只发送一次包含回合的原子载荷',async()=>{
    const authoritative=structuredClone(opening),unchanged=structuredClone(authoritative),dispatch=vi.fn();
    const {result}=renderHook(()=>useFateAttackDraft(authoritative,'0',dispatch));
    act(()=>result.current.toggle(pair[0]));
    act(()=>result.current.toggle(pair[0]));
    expect(result.current.selection.cardIds).toEqual([]);
    selectPair(result.current.toggle);
    expect(result.current.canConfirm).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(authoritative).toEqual(unchanged);
    act(()=>{result.current.confirm();result.current.confirm();});
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('CONFIRM_ATTACK',{cardIds:pair,faceDownIds:[],round:opening.core.round});
    expect(result.current.selection.cardIds).toEqual(pair);
    expect(authoritative).toEqual(unchanged);
    await act(async()=>{await Promise.resolve();});
});

it('离线禁用确认但保留草稿；重连后按同一选择重试，收到权威换轮后不复活旧牌',()=>{
    const dispatch=vi.fn();
    const {result,rerender}=renderHook(({state,connected})=>useFateAttackDraft(state,'0',dispatch,connected),{initialProps:{state:structuredClone(opening),connected:true}});
    selectPair(result.current.toggle);
    rerender({state:structuredClone(opening),connected:false});
    expect(result.current.selection.cardIds).toEqual(pair);
    expect(result.current.canConfirm).toBe(false);
    act(()=>result.current.confirm());expect(dispatch).not.toHaveBeenCalled();
    rerender({state:structuredClone(opening),connected:true});expect(result.current.canConfirm).toBe(true);
    rerender({state:structuredClone(nextRound),connected:true});expect(result.current.selection.cardIds).toEqual([]);
    rerender({state:structuredClone(opening),connected:true});expect(result.current.selection.cardIds).toEqual([]);
});

it('发送错误不清除未获确认的草稿，也不留下无法重试的提交锁',async()=>{
    const dispatch=vi.fn<(type:'CONFIRM_ATTACK',payload:ConfirmAttackCommand['payload'])=>void>(()=>{throw new Error('传输未接受');});
    const {result}=renderHook(()=>useFateAttackDraft(structuredClone(opening),'0',dispatch));
    selectPair(result.current.toggle);
    expect(()=>act(()=>result.current.confirm())).toThrow('传输未接受');
    expect(result.current.selection.cardIds).toEqual(pair);
    await act(async()=>{await Promise.resolve();});
    dispatch.mockImplementation(()=>undefined);
    act(()=>result.current.confirm());expect(dispatch).toHaveBeenCalledTimes(2);
    expect(result.current.selection.cardIds).toEqual(pair);
    await act(async()=>{await Promise.resolve();});
});
