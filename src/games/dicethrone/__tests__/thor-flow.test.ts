import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
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
import { FAN_THE_HAMMER_2 } from '../heroes/gunslinger/abilities';

type State = MatchState<DiceThroneCore>;
const cfg = { domain: DiceThroneDomain, systems: testSystems };
function send(state: State, type: string, payload: Record<string, unknown> = {}, playerId = '0', random: RandomFn = fixedRandom): State {
    const result = executePipeline(cfg, state, { type, playerId, payload, timestamp: 100 } as DiceThroneCommand, random, ['0','1']);
    expect(result.success, `${type}: ${result.error}`).toBe(true);
    return result.state as State;
}
function begin(
    ability: string,
    values: number[],
    upgraded: boolean | AbilityDef = false,
    prepare?: (state: State) => void,
): State {
    let state = createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    prepare?.(state);
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
 it.each([{upgraded:false,initialElectro:0,electro:2,hp:43},{upgraded:true,initialElectro:0,electro:2,hp:42},{upgraded:false,initialElectro:3,electro:4,hp:41}])('奥丁升级=$upgraded：效果骰驭电与召回奖励合计并遵守上限',({upgraded,initialElectro,electro,hp})=>{
    let state=begin('thor-odinforce',[1,1,4,4,4],upgraded,current=>{
      current.core.players['0'].tokens[T.MJOLNIR]=0;
      current.core.players['1'].tokens[T.MJOLNIR]=1;
      current.core.players['0'].tokens[T.ELECTROKINESIS]=initialElectro;
    });
    state=send(state,'CONFIRM_ROLL');
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(electro);
    expect(state.core.players['0'].tokens[T.MJOLNIR]).toBe(1);
    expect(state.core.players['0'].resources[R.CP]).toBe(3);
    state=send(state,'ROLL_DICE',{},'1');state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(hp);
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
 it.each([{upgrade:false,dice:[1,1,6]},{upgrade:true,dice:[1,1,6,6]}])('防御升级=$upgrade：召回神锤与雷电奖励分别获得驭电',({upgrade,dice})=>{
    let state=createHeroMatchup('monk','thor')(['0','1'],fixedRandom);
    if(upgrade)state.core.players['1'].abilities=state.core.players['1'].abilities.map(a=>a.id==='thor-thunder-wheel'?THOR_THUNDER_WHEEL_2:a);
    state.core.players['1'].tokens[T.MJOLNIR]=0;
    state.core.players['0'].tokens[T.MJOLNIR]=1;
    state=send(state,'ADVANCE_PHASE');state=send(state,'ROLL_DICE');state=send(state,'CONFIRM_ROLL');
    state=send(state,'SELECT_ABILITY',{abilityId:'fist-technique-5'});state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'1',createQueuedRandom(dice));state=send(state,'CONFIRM_ROLL',{},'1');state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].tokens[T.MJOLNIR]).toBe(1);
    expect(state.core.players['1'].tokens[T.ELECTROKINESIS]).toBe(upgrade?3:2);
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
   {id:'thor-hammer-2-3',dice:[1,1,1,4,5],upgrade:THOR_HAMMER_2,hp:44,electro:0},
   {id:'thor-hammer-3-3',dice:[2,2,2,4,5],upgrade:THOR_HAMMER_3,hp:44,electro:1},
   {id:'thor-hammer-3-4',dice:[1,1,2,3,4],upgrade:THOR_HAMMER_3,hp:43,electro:0},
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
 it.each([
   {targetHoldsMjolnir:false,bonusDamage:0,hp:43,electrokinesis:1},
   {targetHoldsMjolnir:true,bonusDamage:2,hp:41,electrokinesis:0},
 ])('基础雷轰电掣按攻击目标是否持有姆乔尔尼尔结算：持锤=$targetHoldsMjolnir',({targetHoldsMjolnir,bonusDamage,hp,electrokinesis})=>{
    let state=begin('thor-thunder-strike',[1,2,3,4,4],false,current=>{
      current.core.players['0'].tokens[T.MJOLNIR]=targetHoldsMjolnir?0:1;
      current.core.players['1'].tokens[T.MJOLNIR]=targetHoldsMjolnir?1:0;
    });
    expect(state.core.pendingAttack?.bonusDamage??0).toBe(bonusDamage);
    state=send(state,'ROLL_DICE',{},'1');
    state=send(state,'CONFIRM_ROLL',{},'1');
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(hp);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(electrokinesis);
 });
 it('持锤对手被正常攻击击败后，神锤自动召回且获得一枚驭电',()=>{
    let state=begin('thor-thunder-strike',[1,2,3,4,4],false,current=>{
      current.core.players['0'].tokens[T.MJOLNIR]=0;
      current.core.players['0'].tokens[T.ELECTROKINESIS]=0;
      current.core.players['1'].tokens[T.MJOLNIR]=1;
      current.core.players['1'].resources[R.HP]=1;
    });
    state=send(state,'ROLL_DICE',{},'1');
    state=send(state,'CONFIRM_ROLL',{},'1');
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(0);
    expect(state.core.players['1'].tokens[T.MJOLNIR]??0).toBe(0);
    expect(state.core.players['0'].tokens[T.MJOLNIR]).toBe(1);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(1);
 });
 it.each([{targetRoll:3,target:'1'},{targetRoll:1,target:'3'}])(
  '四人队伍被正常攻击击败时，持锤敌方的神锤仍回到索尔：受击者 $target',({targetRoll,target})=>{
    const players=['0','1','2','3'];
    let state:State={core:DiceThroneDomain.setup(players,fixedRandom),sys:createInitialSystemState(players,testSystems,undefined)};
    const sendFour=(type:string,playerId:string,payload:Record<string,unknown>={},random:RandomFn=fixedRandom)=>{
      const result=executePipeline(cfg,state,{type,playerId,payload,timestamp:100} as DiceThroneCommand,random,players);
      expect(result.success,`${type}: ${result.error}`).toBe(true);state=result.state as State;
    };
    for(const [index,characterId] of ['thor','monk','treant','samurai'].entries())sendFour('SELECT_CHARACTER',String(index),{characterId});
    for(const playerId of players.slice(1))sendFour('PLAYER_READY',playerId);
    sendFour('HOST_START_GAME','0');
    for(const playerId of players)state.core.players[playerId].hand=[];
    state.core.players['0'].tokens[T.MJOLNIR]=0;
    state.core.players['0'].tokens[T.ELECTROKINESIS]=0;
    state.core.players['1'].tokens[T.MJOLNIR]=1;
    state.core.teamHealth!.B=1;
    state.core.players['1'].resources[R.HP]=1;
    state.core.players['3'].resources[R.HP]=1;
    sendFour('ADVANCE_PHASE','0');
    sendFour('ROLL_DICE','0',{},createQueuedRandom([1,2,3,4,4]));
    sendFour('CONFIRM_ROLL','0');
    sendFour('SELECT_ABILITY','0',{abilityId:'thor-thunder-strike'});
    sendFour('ADVANCE_PHASE','0');
    sendFour('ROLL_DICE','0',{},createQueuedRandom([targetRoll]));
    sendFour('CONFIRM_ROLL','0');
    sendFour('ADVANCE_PHASE','0');
    expect(state.core.pendingAttack?.defenderId).toBe(target);
    sendFour('ROLL_DICE',target);
    sendFour('CONFIRM_ROLL',target);
    sendFour('ADVANCE_PHASE',target);
    expect(state.core.teamHealth!.B).toBe(0);
    expect(state.core.players['1'].tokens[T.MJOLNIR]??0).toBe(0);
    expect(state.core.players['0'].tokens[T.MJOLNIR]).toBe(1);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(target==='1'?1:2);
 });
 it.each([{targetRoll:3,target:'1',bonus:2,electro:0},{targetRoll:1,target:'3',bonus:0,electro:1}])(
  '四人雷轰电掣只按被选中的敌人是否持锤结算：目标 $target',({targetRoll,target,bonus,electro})=>{
    const players=['0','1','2','3'];
    let state:State={core:DiceThroneDomain.setup(players,fixedRandom),sys:createInitialSystemState(players,testSystems,undefined)};
    const sendFour=(type:string,playerId:string,payload:Record<string,unknown>={},random:RandomFn=fixedRandom)=>{
      const result=executePipeline(cfg,state,{type,playerId,payload,timestamp:100} as DiceThroneCommand,random,players);
      expect(result.success,`${type}: ${result.error}`).toBe(true);state=result.state as State;
    };
    for(const [index,characterId] of ['thor','monk','treant','samurai'].entries())sendFour('SELECT_CHARACTER',String(index),{characterId});
    for(const playerId of players.slice(1))sendFour('PLAYER_READY',playerId);
    sendFour('HOST_START_GAME','0');
    for(const playerId of players)state.core.players[playerId].hand=[];
    state.core.players['0'].tokens[T.MJOLNIR]=0;
    state.core.players['0'].tokens[T.ELECTROKINESIS]=0;
    state.core.players['1'].tokens[T.MJOLNIR]=1;
    sendFour('ADVANCE_PHASE','0');
    sendFour('ROLL_DICE','0',{},createQueuedRandom([1,2,3,4,4]));
    sendFour('CONFIRM_ROLL','0');
    sendFour('SELECT_ABILITY','0',{abilityId:'thor-thunder-strike'});
    sendFour('ADVANCE_PHASE','0');
    sendFour('ROLL_DICE','0',{},createQueuedRandom([targetRoll]));
    sendFour('CONFIRM_ROLL','0');
    sendFour('ADVANCE_PHASE','0');
    expect(state.core.pendingAttack?.defenderId).toBe(target);
    expect(state.core.pendingAttack?.bonusDamage??0).toBe(bonus);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]??0).toBe(electro);
  });
 it.each([
   {value:1,invalid:[0,3],valid:2},
   {value:6,invalid:[7,4],valid:5},
 ])('索尔弹一手在点数$value拒绝越界和超过一格，仅允许$valid',({value,invalid,valid})=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].hand=[THOR_CARDS.find(card=>card.id==='card-flick')!];
    state.core.players['0'].resources[R.CP]=5;
    state.core.players['1'].hand=[];
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([value,2,3,4,5]));
    state=send(state,'PLAY_CARD',{cardId:'card-flick'});
    for(const newValue of invalid){
      const rejected=executePipeline(cfg,state,{type:'MODIFY_DIE',playerId:'0',payload:{dieId:0,newValue},timestamp:101} as DiceThroneCommand,fixedRandom,['0','1']);
      expect(rejected.success).toBe(false);
      expect(rejected.state.core.dice.find(die=>die.id===0)?.value).toBe(value);
    }
    state=send(state,'MODIFY_DIE',{dieId:0,newValue:valid});
    state=send(state,'SYS_INTERACTION_CONFIRM');
    expect(state.core.dice.find(die=>die.id===0)?.value).toBe(valid);
 });
 it('索尔玩得六啊只允许将目标骰设为六',()=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].hand=[THOR_CARDS.find(card=>card.id==='card-play-six')!];
    state.core.players['0'].resources[R.CP]=5;
    state.core.players['1'].hand=[];
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([3,2,3,4,5]));
    state=send(state,'PLAY_CARD',{cardId:'card-play-six'});
    const rejected=executePipeline(cfg,state,{type:'MODIFY_DIE',playerId:'0',payload:{dieId:0,newValue:5},timestamp:101} as DiceThroneCommand,fixedRandom,['0','1']);
    expect(rejected.success).toBe(false);
    expect(rejected.state.core.dice.find(die=>die.id===0)?.value).toBe(3);
    state=send(state,'MODIFY_DIE',{dieId:0,newValue:6});
    expect(state.core.dice.find(die=>die.id===0)?.value).toBe(6);
 });
 it('索尔俺也一样只复制来源骰原值到另一颗骰子',()=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].hand=[THOR_CARDS.find(card=>card.id==='card-me-too')!];
    state.core.players['0'].resources[R.CP]=5;
    state.core.players['1'].hand=[];
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([1,3,2,4,5]));
    state=send(state,'PLAY_CARD',{cardId:'card-me-too'});
    const invalidSource=executePipeline(cfg,state,{type:'MODIFY_DIE',playerId:'0',payload:{dieId:0,newValue:2},timestamp:101} as DiceThroneCommand,fixedRandom,['0','1']);
    expect(invalidSource.success).toBe(false);
    expect(invalidSource.state.core.dice.find(die=>die.id===0)?.value).toBe(1);
    state=send(state,'MODIFY_DIE',{dieId:0,newValue:1});
    const invalidTarget=executePipeline(cfg,state,{type:'MODIFY_DIE',playerId:'0',payload:{dieId:1,newValue:4},timestamp:102} as DiceThroneCommand,fixedRandom,['0','1']);
    expect(invalidTarget.success).toBe(false);
    expect(invalidTarget.state.core.dice.find(die=>die.id===1)?.value).toBe(3);
    state=send(state,'MODIFY_DIE',{dieId:1,newValue:1});
    expect(state.core.dice.slice(0,2).map(die=>die.value)).toEqual([1,1]);
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
 it('飞锤玩家选择与停止均保留 AI 合法动作并能执行',()=>{
    const state=begin('thor-bottled-lightning',[6,6,6,6,1]);
    const prompt=state.sys.interaction.current!;
    const options=(prompt.data as {options:Array<{id:string;value:{customId:string;value:number;choiceKind?:string}}>}).options;
    const throwOption=options.find(o=>o.value.customId==='thor-mjolnir-move'&&o.value.value===1)!;
    const stopOption=options.find(o=>o.value.customId==='thor-mjolnir-move'&&o.value.value===-1)!;
    expect(throwOption.value.choiceKind).toBe('player');
    expect(stopOption.value.choiceKind).toBe('skip');
    const actions=buildDiceThroneAiLegalActions({playerId:'0',state});
    for(const option of [throwOption,stopOption]){
      const action=actions.find(a=>a.commands.some(c=>c.type==='SYS_INTERACTION_RESPOND'&&c.payload?.optionId===option.id));
      expect(action, `AI 缺少 ${option.value.value}`).toBeDefined();
      const result=executePipeline(cfg,state,{type:'SYS_INTERACTION_RESPOND',playerId:'0',payload:{interactionId:prompt.id,optionId:option.id},timestamp:101},fixedRandom,['0','1']);
      expect(result.success, String(result.error)).toBe(true);
      expect(result.state.core.players['1'].tokens[T.MJOLNIR]??0).toBe(option.value.value===1?1:0);
    }
    expect(buildDiceThroneAiLegalActions({playerId:'1',state})).toEqual([]);
    const unauthorized=executePipeline(cfg,state,{type:'SYS_INTERACTION_RESPOND',playerId:'1',payload:{interactionId:prompt.id,optionId:throwOption.id},timestamp:102},fixedRandom,['0','1']);
    expect(unauthorized.success).toBe(false);
 });
 it('飞掷独立伤害被无懈可击防止后仍继续结算主攻击',()=>{
    let state=createHeroMatchup('thor','thor')(['0','1'],fixedRandom);
    state.core.players['0'].hand=[];
    state.core.players['1'].hand=[THOR_CARDS.find(card=>card.id==='card-thor-impenetrable')!];
    state.core.players['1'].tokens[T.ELECTROKINESIS]=2;
    state.core.players['1'].resources[R.CP]=5;
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([1,1,1,1,1]));
    state=send(state,'CONFIRM_ROLL');
    for(let i=0;i<4&&state.sys.responseWindow?.current;i++){
      const window=state.sys.responseWindow.current;
      state=send(state,'RESPONSE_PASS',{},window.responderQueue[window.currentResponderIndex]);
    }
    state=send(state,'SELECT_ABILITY',{abilityId:'thor-hammer-5'});
    state=send(state,'ADVANCE_PHASE');
    expect(state.core.pendingDamage).toMatchObject({targetPlayerId:'1',currentDamage:1,damageScope:'direct'});
    state=send(state,'PLAY_CARD',{cardId:'card-thor-impenetrable'},'1');
    expect(state.core.players['1'].tokens[T.ELECTROKINESIS]??0).toBe(0);
    if(state.core.pendingDamage)state=send(state,'SKIP_TOKEN_RESPONSE',{pendingDamageId:state.core.pendingDamage.id},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(50);
    expect(state.core.pendingAttack?.damageResolved).not.toBe(true);
    expect(state.sys.phase).toBe('defensiveRoll');
    state=send(state,'ROLL_DICE',{},'1',createQueuedRandom([1,1,1]));
    state=send(state,'CONFIRM_ROLL',{},'1');
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(43);
    expect(state.sys.phase).toBe('main2');
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
 it('四人连锁附属目标的 AI 合法动作覆盖两名敌人且不可由对手提交',()=>{
    const players=['0','1','2','3'];
    let state:State={core:DiceThroneDomain.setup(players,fixedRandom),sys:createInitialSystemState(players,testSystems,undefined)};
    const sendFour=(type:string,playerId:string,payload:Record<string,unknown>={},random:RandomFn=fixedRandom)=>{
      const result=executePipeline(cfg,state,{type,playerId,payload,timestamp:100} as DiceThroneCommand,random,players);
      expect(result.success,`${type}: ${result.error}`).toBe(true);state=result.state as State;
    };
    for(const [index,characterId] of ['thor','monk','treant','samurai'].entries())sendFour('SELECT_CHARACTER',String(index),{characterId});
    for(const playerId of players.slice(1))sendFour('PLAYER_READY',playerId);
    sendFour('HOST_START_GAME','0');
    for(const playerId of players)state.core.players[playerId].hand=[];
    sendFour('ADVANCE_PHASE','0');
    sendFour('ROLL_DICE','0',{},createQueuedRandom([1,1,1,6,6]));
    sendFour('CONFIRM_ROLL','0');
    sendFour('SELECT_ABILITY','0',{abilityId:'thor-chain-lightning'});
    sendFour('ADVANCE_PHASE','0');
    sendFour('ROLL_DICE','0',{},createQueuedRandom([3]));
    sendFour('CONFIRM_ROLL','0');
    sendFour('ADVANCE_PHASE','0',{},createQueuedRandom([1,2,4]));
    sendFour('CONFIRM_ROLL','0');
    let prompt=state.sys.interaction.current!;
    const pair=(prompt.data as {options:Array<{id:string;value:{customId:string}}>}).options.find(o=>o.value.customId==='thor-chain-pair')!;
    sendFour('SYS_INTERACTION_RESPOND','0',{interactionId:prompt.id,optionId:pair.id});
    prompt=state.sys.interaction.current!;
    const targets=(prompt.data as {options:Array<{id:string;value:{customId:string;targetPlayerId:string;choiceKind:string}}>}).options;
    expect(targets.map(o=>o.value.targetPlayerId).sort()).toEqual(['1','3']);
    expect(targets.every(o=>o.value.choiceKind==='player')).toBe(true);
    const actions=buildDiceThroneAiLegalActions({playerId:'0',state});
    for(const option of targets){
      expect(actions.some(a=>a.commands.some(c=>c.type==='SYS_INTERACTION_RESPOND'&&c.payload?.optionId===option.id))).toBe(true);
      const result=executePipeline(cfg,state,{type:'SYS_INTERACTION_RESPOND',playerId:'0',payload:{interactionId:prompt.id,optionId:option.id},timestamp:101},fixedRandom,players);
      expect(result.success,String(result.error)).toBe(true);
      expect(result.events.some(e=>e.type==='DAMAGE_DEALT'&&e.payload.targetId===option.value.targetPlayerId&&e.payload.amount===2)).toBe(true);
    }
    expect(buildDiceThroneAiLegalActions({playerId:'1',state})).toEqual([]);
    const unauthorized=executePipeline(cfg,state,{type:'SYS_INTERACTION_RESPOND',playerId:'1',payload:{interactionId:prompt.id,optionId:targets[0].id},timestamp:102},fixedRandom,players);
    expect(unauthorized.success).toBe(false);
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
 it.each([1,2,3,4,5,6])('破防效果骰点数 %i 仅4或5使攻击不可防御',value=>{
    let state=begin('thor-bottled-lightning',[6,6,6,6,1]);
    state=choose(state,'thor-mjolnir-move',-1);
    const prompt=state.sys.interaction.current!;
    const options=(prompt.data as {options:Array<{id:string;value:{customId:string}}>}).options;
    const id=options.find(option=>option.value.customId==='use-guard_break')!.id;
    state=send(state,'SYS_INTERACTION_RESPOND',{interactionId:prompt.id,optionId:id},'0',createQueuedRandom([value]));
    expect(state.core.players['0'].tokens[T.GUARD_BREAK]).toBe(1);
    state=send(state,'CONFIRM_ROLL');
    if(value===4||value===5){
      expect(state.core.players['1'].resources[R.HP]).toBe(43);
      expect(state.sys.phase).toBe('main2');
    }else{
      expect(state.core.pendingAttack?.isDefendable).toBe(true);
      expect(state.core.players['1'].resources[R.HP]).toBe(50);
    }
 });
 it.each([{moves:0,hp:42},{moves:1,hp:41},{moves:2,hp:40},{moves:3,hp:39}])(
  '瓶中闪电II执行 $moves 次锤移动后结束，按实际驭电计算主伤害',({moves,hp})=>{
    let state=begin('thor-bottled-lightning-2',[6,6,6,6,4],THOR_BOTTLED_LIGHTNING_2);
    for(let i=0;i<moves;i++)state=choose(state,'thor-mjolnir-move',i%2===0?1:0);
    if(moves<3)state=choose(state,'thor-mjolnir-move',-1);
    const options=(state.sys.interaction.current?.data as {options?:Array<{value?:{customId?:string;value?:number}}> }|undefined)?.options??[];
    expect(options.some(option=>option.value?.customId==='thor-mjolnir-move')).toBe(false);
    if(options.some(option=>option.value?.customId==='skip'))state=choose(state,'skip',0);
    expect(state.sys.phase).toBe('defensiveRoll');
    state=send(state,'ROLL_DICE',{},'1');
    state=send(state,'CONFIRM_ROLL',{},'1');
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(hp);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]??0).toBe(Math.floor(moves/2));
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
 it.each([{upgraded:false,damage:3,heal:2},{upgraded:true,damage:4,heal:3}])(
  '四人驭雷策电升级=$upgraded：召回并伤害原持锤者',({upgraded,damage,heal})=>{
    const players=['0','1','2','3'];
    let state:State={core:DiceThroneDomain.setup(players,fixedRandom),sys:createInitialSystemState(players,testSystems,undefined)};
    const sendFour=(type:string,playerId:string,payload:Record<string,unknown>={},random:RandomFn=fixedRandom)=>{
      const result=executePipeline(cfg,state,{type,playerId,payload,timestamp:100} as DiceThroneCommand,random,players);
      expect(result.success,`${type}: ${result.error}`).toBe(true);state=result.state as State;
      return result.events;
    };
    for(const [index,characterId] of ['thor','monk','treant','samurai'].entries())sendFour('SELECT_CHARACTER',String(index),{characterId});
    for(const playerId of players.slice(1))sendFour('PLAYER_READY',playerId);
    sendFour('HOST_START_GAME','0');
    for(const playerId of players)state.core.players[playerId].hand=[];
    if(upgraded)state.core.players['0'].abilities=state.core.players['0'].abilities.map(a=>a.id==='thor-mighty-summon'?THOR_MIGHTY_SUMMON_2:a);
    state.core.players['0'].tokens[T.MJOLNIR]=0;
    state.core.players['3'].tokens[T.MJOLNIR]=1;
    state.core.players['0'].resources[R.HP]=40;
    state.core.players['2'].resources[R.HP]=40;
    state.core.teamHealth!.A=40;
    sendFour('ADVANCE_PHASE','0');
    sendFour('ROLL_DICE','0',{},createQueuedRandom([1,4,4,6,6]));
    sendFour('CONFIRM_ROLL','0');
    sendFour('SELECT_ABILITY','0',{abilityId:upgraded?'thor-mighty-summon-2':'thor-mighty-summon'});
    const events=sendFour('ADVANCE_PHASE','0');
    expect(state.core.teamHealth!.A).toBe(40+heal);
    expect(state.core.teamHealth!.B).toBe(50-damage);
    expect(events).toContainEqual(expect.objectContaining({type:'DAMAGE_DEALT',payload:expect.objectContaining({targetId:'3',amount:damage})}));
    expect(state.core.players['0'].tokens[T.MJOLNIR]).toBe(1);
    expect(state.core.players['3'].tokens[T.MJOLNIR]??0).toBe(0);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]).toBe(1);
    expect(state.core.pendingAttack).toBeNull();
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
 it('基础雷神之锤不持锤时不召回，但最高档主攻击仍完整结算',()=>{
    let state=begin('thor-hammer-5',[1,1,1,1,1],false,current=>{
      current.core.players['0'].tokens[T.MJOLNIR]=0;
      current.core.players['1'].tokens[T.MJOLNIR]=1;
    });
    expect(state.core.players['1'].tokens[T.MJOLNIR]).toBe(1);
    expect(state.core.players['1'].resources[R.HP]).toBe(50);
    expect(state.sys.phase).toBe('defensiveRoll');
    state=send(state,'ROLL_DICE',{},'1');
    state=send(state,'CONFIRM_ROLL',{},'1');
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(43);
    expect(state.core.players['1'].tokens[T.MJOLNIR]).toBe(1);
    expect(state.core.players['0'].tokens[T.ELECTROKINESIS]??0).toBe(0);
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
 it.each([{away:false,actionIndex:0},{away:true,actionIndex:1}])('AI付费移动神锤可选择任一手牌：持锤在外=$away',({away,actionIndex})=>{
    let state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].tokens[T.MJOLNIR]=away?0:1;
    state.core.players['1'].tokens[T.MJOLNIR]=away?1:0;
    const cardIds=['card-thor-thunderous','card-thor-hammer-time'];
    state.core.players['0'].hand=cardIds.map(id=>THOR_CARDS.find(card=>card.id===id)!);
    state=send(state,'USE_PASSIVE_ABILITY',{passiveId:'thor-mjolnir',actionIndex});
    const prompt=state.sys.interaction.current!;
    const actions=buildDiceThroneAiLegalActions({state,playerId:'0'}).filter(action=>action.commands.some(command=>command.type==='RESOLVE_INTERACTION'));
    expect(actions.map(action=>action.commands[0].payload?.selectedCardIds)).toEqual(cardIds.map(id=>[id]));
    expect(buildDiceThroneAiLegalActions({state,playerId:'1'})).toEqual([]);
    for(const action of actions){
      const cardId=(action.commands[0].payload?.selectedCardIds as string[])[0];
      const result=executePipeline(cfg,state,{...action.commands[0],playerId:'0',timestamp:101} as DiceThroneCommand,fixedRandom,['0','1']);
      expect(result.success,result.error).toBe(true);
      expect(result.state.sys.interaction.current?.id).not.toBe(prompt.id);
      expect(result.state.core.players['0'].discard.some(card=>card.id===cardId)).toBe(true);
      expect(result.state.core.players['0'].hand.map(card=>card.id)).toEqual(cardIds.filter(id=>id!==cardId));
      expect(result.state.core.players[away?'0':'1'].tokens[T.MJOLNIR]).toBe(1);
      expect(buildDiceThroneAiLegalActions({state:result.state,playerId:'0'}).some(next=>next.kind==='advance-phase')).toBe(true);
    }
 });
 it.each([
   {away:false,hasCard:false,actionIndex:0},
   {away:true,hasCard:false,actionIndex:1},
   {away:false,hasCard:true,actionIndex:1},
   {away:true,hasCard:true,actionIndex:0},
 ])('付费飞掷或召回不满足持锤与手牌条件时拒绝：$away/$hasCard/$actionIndex',({away,hasCard,actionIndex})=>{
    const state=createHeroMatchup('thor','monk')(['0','1'],fixedRandom);
    state.core.players['0'].tokens[T.MJOLNIR]=away?0:1;
    state.core.players['1'].tokens[T.MJOLNIR]=away?1:0;
    state.core.players['0'].hand=hasCard?[THOR_CARDS.find(c=>c.id==='card-thor-thunderous')!]:[];
    const result=executePipeline(cfg,state,{type:'USE_PASSIVE_ABILITY',playerId:'0',payload:{passiveId:'thor-mjolnir',actionIndex},timestamp:100},fixedRandom,['0','1']);
    expect(result.success).toBe(false);
    expect(result.state.core.players['0'].hand).toHaveLength(hasCard?1:0);
    expect(result.state.core.players['0'].tokens[T.MJOLNIR]).toBe(away?0:1);
    expect(result.state.core.players['1'].tokens[T.MJOLNIR]).toBe(away?1:0);
    expect(result.state.sys.interaction.current).toBeFalsy();
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
 it('正常攻击生成致命伤害响应后，不屈的意志掷出4保留1生命',()=>{
    let state=createHeroMatchup('monk','thor')(['0','1'],fixedRandom);
    const passOrdinaryResponses=()=>{
      for(let i=0;i<4&&state.sys.responseWindow?.current;i++){
        const window=state.sys.responseWindow.current;
        state=send(state,'RESPONSE_PASS',{},window.responderQueue[window.currentResponderIndex]);
      }
      expect(state.sys.responseWindow?.current).toBeFalsy();
    };
    state.core.players['0'].hand=[];
    state.core.players['1'].hand=[THOR_CARDS.find(card=>card.id==='card-thor-undaunted')!];
    state.core.players['1'].resources[R.HP]=5;
    state.core.players['1'].resources[R.CP]=5;
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE');
    state=send(state,'CONFIRM_ROLL');
    passOrdinaryResponses();
    state=send(state,'SELECT_ABILITY',{abilityId:'fist-technique-5'});
    passOrdinaryResponses();
    state=send(state,'ADVANCE_PHASE');
    passOrdinaryResponses();
    state=send(state,'ROLL_DICE',{},'1',createQueuedRandom([6,6,6]));
    state=send(state,'CONFIRM_ROLL',{},'1');
    passOrdinaryResponses();
    state=send(state,'ADVANCE_PHASE',{},'1');
    expect(state.core.pendingDamage).toMatchObject({targetPlayerId:'1',damageScope:'attack'});
    expect(state.core.pendingDamage!.currentDamage).toBeGreaterThanOrEqual(5);
    state=send(state,'PLAY_CARD',{cardId:'card-thor-undaunted'},'1',createQueuedRandom([4]));
    expect(state.core.pendingBonusDiceSettlement?.dice[0].value).toBe(4);
    state=send(state,'CONFIRM_ROLL',{},'1');
    if(state.core.pendingDamage)state=send(state,'SKIP_TOKEN_RESPONSE',{pendingDamageId:state.core.pendingDamage.id},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(1);
    expect(state.core.players['1'].resources[R.CP]).toBe(3);
    expect(state.core.pendingDamage).toBeUndefined();
 });
 it.each([{cardId:'card-thor-impenetrable',electro:2,cost:2},{cardId:'card-next-time',electro:0,cost:1}])(
  '枪手枪托击打的独立伤害可由索尔 $cardId 防止',({cardId,electro,cost})=>{
    let state=createHeroMatchup('gunslinger','thor')(['0','1'],fixedRandom);
    state.core.players['0'].abilities=state.core.players['0'].abilities.map(ability=>ability.id===FAN_THE_HAMMER_2.id?FAN_THE_HAMMER_2:ability);
    state.core.players['0'].hand=[];
    state.core.players['1'].hand=[THOR_CARDS.find(card=>card.id===cardId)!];
    state.core.players['1'].tokens[T.ELECTROKINESIS]=electro;
    state.core.players['1'].resources[R.CP]=5;
    state=send(state,'ADVANCE_PHASE');
    state=send(state,'ROLL_DICE',{},'0',createQueuedRandom([4,4,6,1,1]));
    state=send(state,'CONFIRM_ROLL');
    for(let i=0;i<4&&state.sys.responseWindow?.current;i++){
      const window=state.sys.responseWindow.current;
      state=send(state,'RESPONSE_PASS',{},window.responderQueue[window.currentResponderIndex]);
    }
    state=send(state,'SELECT_ABILITY',{abilityId:'pistol-whip'});
    state=send(state,'ADVANCE_PHASE');
    if(state.sys.interaction.current?.kind==='simple-choice'){
      state=send(state,'SYS_INTERACTION_RESPOND',{interactionId:state.sys.interaction.current.id,optionId:'option-1'});
    }
    expect(state.core.pendingDamage).toMatchObject({targetPlayerId:'1',currentDamage:1,damageScope:'direct'});
    state=send(state,'PLAY_CARD',{cardId},'1');
    expect(state.core.players['1'].tokens[T.ELECTROKINESIS]??0).toBe(0);
    if(state.core.pendingDamage)state=send(state,'SKIP_TOKEN_RESPONSE',{pendingDamageId:state.core.pendingDamage.id},'1');
    expect(state.core.players['1'].resources[R.HP]).toBe(50);
    expect(state.core.players['1'].resources[R.CP]).toBe(5-cost);
    expect(state.sys.phase).toBe('main2');
 });
});
