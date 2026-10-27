import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import { RESOURCE_IDS as R } from '../domain/resources';
import { TOKEN_IDS as T } from '../domain/ids';
import { createHeroMatchup, createQueuedRandom, fixedRandom, testSystems } from './test-utils';
import { THOR_CARDS } from '../heroes/thor/cards';
import { THOR_ODINFORCE_2, THOR_HAMMER_2, THOR_HAMMER_3, THOR_POWER_OF_THUNDER_2, THOR_THUNDER_STRIKE_2, THOR_MIGHTY_SUMMON_2, THOR_BOTTLED_LIGHTNING_2, THOR_THUNDER_WHEEL_2, THOR_CHAIN_LIGHTNING_2 } from '../heroes/thor/abilities';
import type { AbilityDef } from '../domain/combat';
import { COMMON_CARDS } from '../domain/commonCards';
import { buildDiceThroneAiLegalActions } from '../ai';

type State = MatchState<DiceThroneCore>;
const cfg = { domain: DiceThroneDomain, systems: testSystems };
function send(state: State, type: string, payload: Record<string, unknown> = {}, playerId = '0', random: RandomFn = fixedRandom): State {
    const result = executePipeline(cfg, state, { type, playerId, payload, timestamp: 100 } as DiceThroneCommand, random, ['0','1']);
    expect(result.success, `${type}: ${result.error}`).toBe(true);
    return result.state as State;
}
function begin(ability: string, values: number[], upgraded: boolean | AbilityDef = false): State {
    let state = createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    const replacement = upgraded === true ? THOR_ODINFORCE_2 : upgraded || undefined;
    if (replacement) state.core.players['0'].abilities = state.core.players['0'].abilities.map(a => a.id === replacement.id ? replacement : a);
    state = send(state,'ADVANCE_PHASE');
    state = send(state,'ROLL_DICE',{},'0',createQueuedRandom(values));
    state = send(state,'CONFIRM_ROLL');
    state = send(state,'SELECT_ABILITY',{abilityId:ability});
    return send(state,'ADVANCE_PHASE',{},'0',createQueuedRandom([1,1,4,4,6]));
}
function choose(state: State, customId: string, value?: number): State {
    const prompt = state.sys.interaction.current;
    const options = (prompt?.data as { options?: Array<{id:string;value?:{customId?:string;value?:number}}> })?.options ?? [];
    const option = options.find(o => o.value?.customId === customId && (value === undefined || o.value?.value === value));
    expect(option, JSON.stringify(prompt)).toBeDefined();
    return send(state,'SYS_INTERACTION_RESPOND',{interactionId:prompt!.id,optionId:option!.id},prompt!.playerId);
}

describe('索尔正式命令流程',()=>{
 it('基础奥丁无内置重掷，效果最终奖励和驭电增伤各执行一次',()=>{
    let state=begin('thor-odinforce',[1,1,4,4,4]);
    expect(state.core.pendingBonusDiceSettlement?.maxRerollCount).toBe(0);
     state=send(state,'CONFIRM_ROLL');
    state=send(state,'ROLL_DICE',{},'1');state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(43);
    expect(state.core.players['0'].resources[R.CP]).toBe(3);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(1);
 });
 it('奥丁II全组重掷为五雷，最终只获得上限4驭电并造成10主伤害',()=>{
    let state=begin('thor-odinforce',[1,1,4,4,4],true);
    state=send(state,'REROLL_BONUS_DIE',{dieIndex:0,dieIndices:[0,1,2,3,4]},'0',createQueuedRandom([6,6,6,6,6]));
    state=send(state,'CONFIRM_ROLL');
    state=send(state,'ROLL_DICE',{},'1');state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(40);
    expect(state.core.players['0'].resources[R.CP]).toBe(2);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(4);
 });
 it('连锁II四颗效果骰选两颗，并独立造成3附属伤害',()=>{
    let state=begin('thor-chain-lightning',[1,1,1,6,6],THOR_CHAIN_LIGHTNING_2);
    expect(state.core.pendingBonusDiceSettlement?.dice).toHaveLength(4);
     state=send(state,'CONFIRM_ROLL');state=choose(state,'thor-chain-pair',8);
    expect(state.core.players['1'].resources[R.HP]).toBe(47);
    state=send(state,'ROLL_DICE',{},'1');state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(39);
 });
 it('非索尔持有者实际花4驭电抽一牌，主要一和主要二共享每回合一次',()=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.activePlayerId='1';state.core.players['1'].tokens[T.ELECTROKINESIS]=4;
    state=send(state,'USE_PASSIVE_ABILITY',{passiveId:'electrokinesis-draw',actionIndex:0},'1');
    expect(state.core.players['1'].tokens[T.ELECTROKINESIS]).toBe(0);
    expect(state.core.players['1'].hand).toHaveLength(1);
    state.core.players['1'].tokens[T.ELECTROKINESIS]=4;state.sys.phase='main2';
    const result=executePipeline(cfg,state,{type:'USE_PASSIVE_ABILITY',playerId:'1',payload:{passiveId:'electrokinesis-draw',actionIndex:0},timestamp:101},fixedRandom,['0','1']);
    expect(result.success).toBe(false);
    expect(result.state.core.players['1'].tokens[T.ELECTROKINESIS]).toBe(4);
 });
 it.each([{upgrade:false,dice:[6,6,4],hp:44,electro:1},{upgrade:true,dice:[6,6,4,4],hp:46,electro:2}])('防御升级=$upgrade：盔防伤、雷奖励正确且只结算一次',({upgrade,dice,hp,electro})=>{
    let state=createHeroMatchup('monk','thor')(['0','1'],fixedRandom);
    if(upgrade)state.core.players['1'].abilities=state.core.players['1'].abilities.map(a=>a.id==='thor-thunder-wheel'?THOR_THUNDER_WHEEL_2:a);
    state=send(state,'ADVANCE_PHASE');state=send(state,'ROLL_DICE');state=send(state,'CONFIRM_ROLL');
    state=send(state,'SELECT_ABILITY',{abilityId:'fist-technique-5'});state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'1',createQueuedRandom(dice));state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(hp);
    expect(state.core.players['1'].tokens[T.ELECTROKINESIS]).toBe(electro);
    expect(state.sys.phase).toBe('main2');
 });
 it('阿斯加德神力为同张升级的独立治疗选项，不进入防御',()=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].abilities=state.core.players['0'].abilities.map(a=>a.id==='thor-power-of-thunder'?THOR_POWER_OF_THUNDER_2:a);
    state.core.players['0'].resources[R.HP]=30;
    state=send(state,'ADVANCE_PHASE');state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([4,4,4,1,1]));state=send(state,'CONFIRM_ROLL');
    state=send(state,'SELECT_ABILITY',{abilityId:'thor-asgardian-might'});state=send(state,'ADVANCE_PHASE');
    expect(state.core.players['0'].resources[R.HP]).toBe(34);
    expect(state.core.players['1'].resources[R.HP]).toBe(50);
    expect(state.sys.phase).toBe('main2');
 });
 it('AI可选择31个非空重掷子集或确认，重掷后不再生成第二次动作',()=>{
    let state=begin('thor-odinforce',[1,1,4,4,4],true);
    const actions=buildDiceThroneAiLegalActions({playerId:'0',state});
    const rerolls=actions.filter(a=>a.commands.some(c=>c.type==='REROLL_BONUS_DIE'));
    expect(rerolls).toHaveLength(31);
    expect(actions.some(a=>a.commands.some(c=>c.type==='CONFIRM_ROLL'))).toBe(true);
    state=send(state,'REROLL_BONUS_DIE',{dieIndex:0,dieIndices:[0,1]});
    expect(buildDiceThroneAiLegalActions({playerId:'0',state}).some(a=>a.commands.some(c=>c.type==='REROLL_BONUS_DIE'))).toBe(false);
 });
 it.each([
   {id:'thor-hammer-3',dice:[1,2,3,4,5],hp:45,electro:0},
   {id:'thor-hammer-4',dice:[1,1,2,3,4],hp:44,electro:0},
   {id:'thor-hammer-2-4',dice:[2,2,2,2,4],upgrade:THOR_HAMMER_2,hp:43,electro:1},
   {id:'thor-hammer-3-3',dice:[2,2,2,4,5],upgrade:THOR_HAMMER_3,hp:44,electro:1},
   {id:'thor-hammer-3-5',dice:[1,1,1,1,1],upgrade:THOR_HAMMER_3,hp:41,electro:1},
   {id:'thor-thunder-strike',dice:[1,2,3,4,4],hp:43,electro:1},
   {id:'thor-thunder-strike',dice:[1,2,3,4,4],upgrade:THOR_THUNDER_STRIKE_2,hp:40,electro:1},
   {id:'thor-power-of-thunder',dice:[1,2,3,4,5],hp:39,electro:2},
   {id:'thor-power-of-thunder-2',dice:[1,2,3,4,5],upgrade:THOR_POWER_OF_THUNDER_2,hp:37,electro:2},
   {id:'thor-flash-and-thunder',dice:[1,1,6,6,4],upgrade:THOR_MIGHTY_SUMMON_2,hp:44,electro:2},
   {id:'thor-bottled-lightning',dice:[6,6,6,6,4],hp:43,electro:0},
   {id:'thor-bottled-lightning-2',dice:[6,6,6,6,4],upgrade:THOR_BOTTLED_LIGHTNING_2,hp:42,electro:0},
 ])('$id全流程最终敌方生命$hp，驭电$electro',({id,dice,upgrade,hp,electro})=>{
    let state=begin(id,dice,upgrade);
    for(let i=0;i<8&&state.sys.interaction.current?.kind==='simple-choice';i++){
      const options=(state.sys.interaction.current.data as {options:Array<{value:{customId:string;value:number}}>}).options;
      const stop=options.find(o=>o.value.customId==='thor-mjolnir-move'&&o.value.value===-1);
      const skip=options.find(o=>o.value.customId==='skip');
      const choice=stop??skip??options[0];
      state=choose(state,choice.value.customId,choice.value.value);
    }
    if(state.sys.phase==='defensiveRoll'){
      state=send(state,'ROLL_DICE',{},'1');state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    }
    expect(state.core.players['1'].resources[R.HP]).toBe(hp);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(electro);
    expect(state.sys.phase).toBe('main2');
 });
 it('同伴独立伤害响应关闭不跳过父攻击',()=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['1'].tokens[T.TAIJI]=1;
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([1,1,1,1,1]));
    state=send(state,'CONFIRM_ROLL');
    state=send(state,'SELECT_ABILITY',{abilityId:'thor-hammer-5'});
    state=send(state,'ADVANCE_PHASE');
    expect(state.core.pendingDamage?.damageScope).toBe('direct');
    state=send(state,'SKIP_TOKEN_RESPONSE',{pendingDamageId:state.core.pendingDamage!.id},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(49);
    expect(state.core.pendingAttack?.damageResolved).not.toBe(true);
    expect(state.sys.phase).toBe('defensiveRoll');
 });
 it('连锁闪电手动选两骰及独立目标后保留主攻击',()=>{
    let state=begin('thor-chain-lightning',[1,1,1,6,6]);
    state=send(state,'CONFIRM_ROLL');
    state=choose(state,'thor-chain-pair',5);
    expect(state.core.players['1'].resources[R.HP]).toBe(48);
    expect(state.core.pendingAttack?.bonusDamage).toBe(5);
    expect(state.sys.phase).toBe('defensiveRoll');
    state=send(state,'ROLL_DICE',{},'1');
    state=send(state,'CONFIRM_ROLL',{},'1');
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(43);
 });
 it('破防失败仍消费，可再消费第二枚，成功后普通主伤害不可防御',()=>{
    let state=begin('thor-bottled-lightning',[6,6,6,6,1]);
    state=choose(state,'thor-mjolnir-move',-1);
    state=choose(state,'use-guard_break',1);
    expect(state.core.players['0'].tokens[T.GUARD_BREAK]).toBe(1);
    state=send(state,'CONFIRM_ROLL');
    expect(state.core.pendingAttack?.isDefendable).toBe(true);
    const prompt=state.sys.interaction.current!;
    const options=(prompt.data as {options:Array<{id:string;value:{customId:string}}>}).options;
    const id=options.find(o=>o.value.customId==='use-guard_break')!.id;
    state=send(state,'SYS_INTERACTION_RESPOND',{interactionId:prompt.id,optionId:id},'0',createQueuedRandom([4]));
    expect(state.core.players['0'].tokens[T.GUARD_BREAK]).toBe(0);
    state=send(state,'CONFIRM_ROLL');
    expect(state.core.players['1'].resources[R.HP]).toBe(43);
    expect(state.sys.phase).toBe('main2');
 });
 it('驭雷策电仅治疗/资源，未持锤时附属伤害响应完成才进入主二',()=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].tokens[T.MJOLNIR]=0;state.core.players['1'].tokens[T.MJOLNIR]=1;
    state.core.players['1'].tokens[T.TAIJI]=1;state.core.players['0'].resources[R.HP]=40;
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([1,4,4,6,6]));
    state=send(state,'CONFIRM_ROLL');state=send(state,'SELECT_ABILITY',{abilityId:'thor-mighty-summon'});
    state=send(state,'ADVANCE_PHASE');
    expect(state.core.pendingDamage?.damageScope).toBe('direct');
    expect(state.sys.phase).toBe('offensiveRoll');
    state=send(state,'SKIP_TOKEN_RESPONSE',{pendingDamageId:state.core.pendingDamage!.id},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(47);
    expect(state.core.players['0'].resources[R.HP]).toBe(42);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(1);
    expect(state.core.players['0'].tokens[T.GUARD_BREAK]).toBe(2);
    // 没有主攻击，不应花费破防或进入防御。
    if(state.sys.interaction.current) state=choose(state,'skip',0);
    expect(state.sys.phase).toBe('main2');
 });
 it('雷电之轮飞掷完成后只结算一次防御，再继续原来的主伤害',()=>{
    let state=createHeroMatchup('monk','thor')(['0','1'],fixedRandom);
    state=send(state,'ADVANCE_PHASE');state=send(state,'ROLL_DICE');state=send(state,'CONFIRM_ROLL');
    state=send(state,'SELECT_ABILITY',{abilityId:'fist-technique-5'});state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'1',createQueuedRandom([1,1,6]));
    state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.sys.interaction.current).toBeUndefined();
    expect(state.core.players['0'].resources[R.HP]).toBe(49);
    expect(state.core.players['1'].resources[R.HP]).toBe(42);
    expect(state.core.players['1'].tokens[T.ELECTROKINESIS]).toBe(1);
    expect(state.sys.phase).toBe('main2');
 });
 it('终极锤子序列中拒绝对手瞬时牌，停止后结算14伤害',()=>{
    let state=begin('thor-for-asgard',[6,6,6,6,6]);
    state.core.players['1'].hand=[COMMON_CARDS.find(c=>c.id==='card-double')!];
    const result=executePipeline(cfg,state,{type:'PLAY_CARD',playerId:'1',payload:{cardId:'card-double'},timestamp:101},fixedRandom,['0','1']);
    expect(result.success).toBe(false);
    expect(result.state.core.players['1'].hand).toHaveLength(1);
    state=choose(state,'thor-mjolnir-move',-1);
    expect(state.core.players['0'].tokens[T.GUARD_BREAK]).toBe(1);
    expect(state.core.players['1'].resources[R.HP],JSON.stringify({attack:state.core.pendingAttack,prompt:state.sys.interaction.current,phase:state.sys.phase})).toBe(36);
    expect(state.core.pendingAttack).toBeNull();
 });
 it('雷神之锤飞掷后保留普通主攻击和防御入口',()=>{
    let state=begin('thor-hammer-5',[1,1,1,1,1]);
    expect(state.core.players['1'].resources[R.HP]).toBe(49);
    expect(state.core.pendingAttack?.damageResolved).not.toBe(true);
    expect(state.sys.phase).toBe('defensiveRoll');
    state=send(state,'ROLL_DICE',{},'1');
    state=send(state,'CONFIRM_ROLL',{},'1');
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(42);
 });
 it.each([{indices:[0]},{indices:[0,1,2,3,4]}])('奥丁II一次提交子集$indices，仅增加一次重掷计数，保留未选骰，拒绝第二次',({indices})=>{
    let state=begin('thor-odinforce',[1,1,4,4,4],true);
    const before=state.core.pendingBonusDiceSettlement!.dice.map(d=>d.value);
    state=send(state,'REROLL_BONUS_DIE',{dieIndex:indices[0],dieIndices:indices},'0',createQueuedRandom([6,6,6,6,6]));
    expect(state.core.pendingBonusDiceSettlement?.rerollCount).toBe(1);
    expect(state.core.pendingBonusDiceSettlement?.dice.map(d=>d.value)).toEqual(before.map((v,i)=>indices.includes(i)?6:v));
    const result=executePipeline(cfg,state,{type:'REROLL_BONUS_DIE',playerId:'0',payload:{dieIndex:0,dieIndices:[0]},timestamp:101},fixedRandom,['0','1']);
    expect(result.success).toBe(false);
 });
 it('奥丁II可以不重掷，奖励只按最终确认结果执行一次',()=>{
    let state=begin('thor-odinforce',[1,1,4,4,4],true);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(0);
    state=send(state,'CONFIRM_ROLL');
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(1);
    expect(state.core.players['0'].resources[R.CP]).toBe(3);
    expect(state.core.pendingBonusDiceSettlement).toBeUndefined();
    expect(state.sys.phase).toBe('defensiveRoll');
 });
  it('弃牌飞掷复用通用手牌交互，确认弃牌后自动命中唯一对手',()=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].hand=[THOR_CARDS.find(c=>c.id==='card-thor-thunderous')!];
    state=send(state,'USE_PASSIVE_ABILITY',{passiveId:'thor-mjolnir',actionIndex:0});
     const interaction=state.sys.interaction.current!;
     expect(interaction.kind).toBe('dt:card-interaction');
     expect((interaction.data as {type:string}).type).toBe('selectHandCard');
     const cardId=state.core.players['0'].hand[0].id;
     state=send(state,'RESOLVE_INTERACTION',{selectedCardIds:[cardId],interactionId:interaction.id});
    expect(state.core.players['0'].hand).toHaveLength(0);
     expect(state.core.players['0'].discard.some(card=>card.id===cardId)).toBe(true);
    expect(state.core.players['0'].resources[R.CP]).toBe(2);
    expect(state.core.mjolnirThrowsThisTurn?.['0']).toBe(1);
     expect(state.core.players['1'].resources[R.HP]).toBe(49);
     expect(state.core.players['1'].tokens[T.MJOLNIR]).toBe(1);
  });
  it('取消弃牌支付不弃牌且不移动姆乔尔尼尔',()=>{
     let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
     state.core.players['0'].hand=[THOR_CARDS.find(c=>c.id==='card-thor-thunderous')!];
     const cardId=state.core.players['0'].hand[0].id;
     state=send(state,'USE_PASSIVE_ABILITY',{passiveId:'thor-mjolnir',actionIndex:0});
     const interaction=state.sys.interaction.current!;
     state=send(state,'SYS_INTERACTION_CANCEL',{interactionId:interaction.id});
     expect(state.core.players['0'].hand.map(card=>card.id)).toEqual([cardId]);
     expect(state.core.players['0'].discard.some(card=>card.id===cardId)).toBe(false);
     expect(state.core.players['0'].tokens[T.MJOLNIR]).toBe(1);
     expect(state.core.players['1'].resources[R.HP]).toBe(50);
 });
  it('弃牌召回复用通用手牌交互，确认弃牌后召回并获得驭电',()=>{
     let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
     state.core.players['0'].tokens[T.MJOLNIR]=0;
     state.core.players['1'].tokens[T.MJOLNIR]=1;
     state.core.players['0'].hand=[THOR_CARDS.find(c=>c.id==='card-thor-thunderous')!];
     const cardId=state.core.players['0'].hand[0].id;
     state=send(state,'USE_PASSIVE_ABILITY',{passiveId:'thor-mjolnir',actionIndex:1});
     const interaction=state.sys.interaction.current!;
     expect((interaction.data as {type:string}).type).toBe('selectHandCard');
     state=send(state,'RESOLVE_INTERACTION',{selectedCardIds:[cardId],interactionId:interaction.id});
     expect(state.core.players['0'].discard.some(card=>card.id===cardId)).toBe(true);
     expect(state.core.players['0'].tokens[T.MJOLNIR]).toBe(1);
     expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(1);
     expect(state.core.players['1'].tokens[T.MJOLNIR]).toBe(0);
  });
 it('尚无待结算伤害时不能空付坚不可摧的卡牌费用',()=>{
    const state=createHeroMatchup('monk','thor')(['0','1'],fixedRandom);
    state.sys.phase='defensiveRoll';
    state.core.pendingAttack={attackerId:'0',defenderId:'1',sourceAbilityId:'fist-technique-5',isDefendable:true} as DiceThroneCore['pendingAttack'];
    state.core.players['1'].hand=[THOR_CARDS.find(c=>c.id==='card-thor-impenetrable')!];
    state.core.players['1'].tokens[T.ELECTROKINESIS]=2;
    const result=executePipeline(cfg,state,{type:'PLAY_CARD',playerId:'1',payload:{cardId:'card-thor-impenetrable'},timestamp:100},fixedRandom,['0','1']);
    expect(result.success).toBe(false);
    expect(result.state.core.players['1'].hand).toHaveLength(1);
    expect(result.state.core.players['1'].resources[R.CP]).toBe(2);
 });
});
