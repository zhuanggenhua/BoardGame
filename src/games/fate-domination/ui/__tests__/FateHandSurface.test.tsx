import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {useState} from 'react';
import {expect, it, vi} from 'vitest';
import {createReplayAdapter} from '../../../../engine/adapter';
import {FateDominationDomain} from '../../domain';
import {FATE_ATTACK_BY_ID} from '../../data';
import {FateHandSurface} from '../FateHandSurface';

vi.mock('react-i18next', async () => {
 const {createInstance}=await import('i18next');
 const {default:zh}=await import('../../../../../public/locales/zh-CN/game-fate-domination.json');
 const i18n=createInstance();
 await i18n.init({lng:'zh-CN',resources:{'zh-CN':{'game-fate-domination':zh}}});
 return {useTranslation:()=>({t:i18n.getFixedT('zh-CN','game-fate-domination'),i18n})};
});

vi.mock('../../../../components/common/media/OptimizedImage', () => ({OptimizedImage: ({src, alt}: {src: string; alt: string}) => <img src={src} alt={alt}/> }));

const preparedHandCore = (seed: string, servantId?: string) => {
 const adapter=createReplayAdapter(FateDominationDomain,seed);
 let state=adapter.setup(['0','1','2']);
 for(const playerId of ['0','1','2']) {
  const identity=state.core.players[playerId];
  state=adapter.execute(state,{type:'SELECT_MASTER',playerId,payload:{masterId:identity.masterId}}).state;
  state=adapter.execute(state,{type:'SELECT_SERVANT',playerId,payload:{servantId:playerId==='0' && servantId ? servantId : identity.servantId}}).state;
  state=adapter.execute(state,{type:'ADVANCE_PHASE',playerId,payload:{}}).state;
  expect(state.core.players[playerId].hand).toHaveLength(3);
 }
 expect(state.core.phase).toBe('outpost');
 return state.core;
};

it('本人攻击牌区直接显示暂选与已打出实例，零张时仍显示合计威力', () => {
 const core=preparedHandCore('inline-played-cards');
 const player=core.players['0'];
 const first=player.hand[0];
 const second=player.hand[1];
 const props={power:7,player,skills:[],canSelect:true,onSelect:vi.fn(),onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props}/>);
 expect(screen.getByTestId('fate-play-area').previousElementSibling?.getAttribute('data-testid')).not.toBe('fate-played-browser-trigger');
 expect(screen.getByText('已打出 · 0')).toBeTruthy();
 expect(screen.getByText('合计威力 7')).toBeTruthy();

 view.rerender(<FateHandSurface {...props} player={{...player,selectedAttackIds:[first.id],activeAttackIds:[second.id]}}/>);
 const playArea=screen.getByTestId('fate-play-area');
 expect(playArea.querySelectorAll('[data-card-id]')).toHaveLength(2);
 expect(playArea.querySelector(`[data-card-id="${first.id}"]`)?.getAttribute('data-card-zone')).toBe('staged');
 expect(playArea.querySelector(`[data-card-id="${second.id}"]`)?.getAttribute('data-card-zone')).toBe('active');
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.queryByTestId('fate-played-browser-trigger')).toBeNull();
});

it('待打出攻击由卡牌本体撤回到原手牌，检视不会更改选择，随后可再次选择', () => {
 const core=preparedHandCore('staged-card-retract');
 const player=core.players['0'];
 const stagedCard=player.hand[0];
 const definition=FATE_ATTACK_BY_ID[stagedCard.definitionId];
 const onInspect=vi.fn();
 function StatefulHand() {
  const [selectedIds,setSelectedIds]=useState([stagedCard.id]);
  return <FateHandSurface power={definition.basePower} player={{...player,selectedAttackIds:selectedIds}} skills={[]} canSelect onSelect={id=>setSelectedIds(previous=>previous.includes(id)?previous.filter(value=>value!==id):[...previous,id])} onPlaySkill={vi.fn()} onInspect={onInspect}/>;
 }
 render(<StatefulHand/>);
 const original=screen.getByTestId('fate-play-area').querySelector<HTMLButtonElement>(`[data-card-id="${stagedCard.id}"]`)!;
 expect(original.getAttribute('data-card-zone')).toBe('staged');
 fireEvent.contextMenu(original);
 expect(onInspect).toHaveBeenLastCalledWith(definition.assetPath,definition.name,true);
 expect(screen.getByTestId('fate-play-area').querySelector(`[data-card-id="${stagedCard.id}"]`)).not.toBeNull();
 fireEvent.click(original);
 const restored=screen.getByTestId('fate-domination-hand').querySelector<HTMLButtonElement>(`[data-card-id="${stagedCard.id}"]`)!;
 expect(restored.getAttribute('data-card-zone')).toBe('hand');
 fireEvent.click(restored);
 expect(screen.getByTestId('fate-play-area').querySelector(`[data-card-id="${stagedCard.id}"]`)?.getAttribute('data-card-zone')).toBe('staged');
});

it('0/2/5/10/20 张牌都留在同一直接牌区中，不复制成弹窗牌册', () => {
 const core=preparedHandCore('inline-played-density');
 const props={power:0,player:core.players['0'],skills:[],canSelect:false,onSelect:vi.fn(),onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props}/>);
 expect(screen.getByTestId('fate-played-cards').querySelectorAll('[data-card-id]')).toHaveLength(0);
 for (const count of [2,5,10,20]) {
  const cards=Array.from({length:count},(_,index)=>({id:`played-${index+1}`,definitionId:'cardA1'}));
  view.rerender(<FateHandSurface {...props} player={{...core.players['0'],hand:cards,activeAttackIds:cards.map(card=>card.id)}} power={count*2}/>);
  const row=screen.getByTestId('fate-played-cards');
  expect(row.querySelectorAll('[data-card-id]')).toHaveLength(count);
  expect(Array.from(row.querySelectorAll<HTMLElement>('[data-card-id]')).map(card=>card.dataset.cardId)).toEqual(cards.map(card=>card.id));
  expect(screen.getByText(`合计威力 ${count*2}`)).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
 }
});

it('普通技能继续在技能牌区选择，已激活技能在原位牌面发动',async()=>{
 const core=preparedHandCore('inline-active-skill');
 const player=core.players['0'];
 const skills=[{skill:{id:'skill-a',name:'技能甲'},assetPath:'skill-a',available:true,abilityAvailable:true},{skill:{id:'skill-b',name:'技能乙'},assetPath:'skill-b',available:true}];
 const onPlaySkill=vi.fn();
 const props={power:7,player,skills,canSelect:false,onSelect:vi.fn(),onPlaySkill,onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props}/>);
 expect(view.container.querySelectorAll('[data-card-zone="skill"]')).toHaveLength(2);
 view.rerender(<FateHandSurface {...props} player={{...player,activeSkills:['skill-a']}}/>);
 await waitFor(()=>expect(view.container.querySelectorAll('[data-card-zone="skill"]')).toHaveLength(1));
 const active=screen.getByRole('button',{name:'发动 技能甲'});
 expect(screen.getByTestId('fate-play-area').contains(active)).toBe(true);
 fireEvent.click(active);
 expect(onPlaySkill).toHaveBeenCalledExactlyOnceWith('skill-a');
});

it('骑乘仍在本人原攻击手牌中选择并以内联确认/取消提交',()=>{
 const core=preparedHandCore('riding-inline-hand');
 const player={...core.players['0'],mana:2,hand:[{id:'b1-instance',definitionId:'cardB1'},{id:'remote-instance',definitionId:'cardPreparation'},{id:'power4-instance',definitionId:'cardB3'}]};
 const confirm=vi.fn(),cancel=vi.fn(),select=vi.fn();
 const ridingChoice={interactionId:'riding-1',round:2,candidateIds:['b1-instance','remote-instance'],onConfirm:confirm,onCancel:cancel};
 const view=render(<FateHandSurface power={0} player={player} skills={[]} canSelect onSelect={select} onPlaySkill={vi.fn()} onInspect={vi.fn()} ridingChoice={ridingChoice}/>);
 const remote=screen.getByRole('button',{name:'选择坐骑召唤 远隔操作'});
 fireEvent.click(remote);
 expect(screen.getByTestId('fate-riding-controls').textContent).toContain('已选 1/3 · 实付 1/2 魔力');
 expect(select).not.toHaveBeenCalled();
 fireEvent.click(screen.getByTestId('fate-riding-confirm'));
 expect(confirm).toHaveBeenCalledWith(['remote-instance']);
 fireEvent.click(screen.getByTestId('fate-riding-cancel'));
 expect(cancel).toHaveBeenCalledOnce();
 expect(view.container.querySelectorAll('[data-card-id="remote-instance"]')).toHaveLength(1);
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('骑乘可确认零张，interaction 更新或关闭后清理临时多选',async()=>{
 const core=preparedHandCore('riding-zero-choice');
 const player={...core.players['0'],mana:4,hand:[{id:'b1-instance',definitionId:'cardB1'}]};
 const first={interactionId:'riding-1',round:2,candidateIds:['b1-instance'],onConfirm:vi.fn(),onCancel:vi.fn()};
 const props={power:0,player,skills:[],canSelect:false,onSelect:vi.fn(),onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props} ridingChoice={first}/>);
 expect(screen.getByTestId('fate-riding-confirm')).toBeEnabled();
 fireEvent.click(screen.getByTestId('fate-riding-confirm'));
 expect(first.onConfirm).toHaveBeenCalledWith([]);
 fireEvent.click(screen.getByRole('button',{name:'选择坐骑召唤 迫击'}));
 view.rerender(<FateHandSurface {...props} ridingChoice={{...first,interactionId:'riding-2',round:3}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'选择坐骑召唤 迫击'}).getAttribute('aria-pressed')).toBe('false'));
 view.rerender(<FateHandSurface {...props}/>);
 expect(screen.queryByTestId('fate-riding-controls')).toBeNull();
});

it('选牌焦点随实例从手牌移动到原位出牌区',()=>{
 const core=preparedHandCore('focus-inline-play-area');
 const player=core.players['0'];
 const props={power:7,player,skills:[],canSelect:true,onSelect:vi.fn(),onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props}/>);
 const handCard=view.container.querySelector<HTMLButtonElement>('[data-card-zone="hand"]')!;
 handCard.focus();
 view.rerender(<FateHandSurface {...props} player={{...player,selectedAttackIds:[player.hand[0].id]}}/>);
 expect(document.activeElement?.getAttribute('data-card-zone')).toBe('staged');
});

const preparePlayer = (seed: string, servantId = 'servant-saber') => preparedHandCore(seed, servantId).players['0'];
it('焦点主动移到地图后，手牌状态更新不会抢回焦点',()=>{
 const player=preparePlayer('focus-map-does-not-steal');
 const props={power:7,player,skills:[],canSelect:true,onSelect:vi.fn(),onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<><div data-testid="fate-map-focus-target" tabIndex={0}>地图</div><FateHandSurface {...props}/></>);
 const handCard=view.container.querySelector<HTMLButtonElement>('[data-card-zone="hand"]')!;
 const mapTarget=screen.getByTestId('fate-map-focus-target');
 handCard.focus();
 mapTarget.focus();
 view.rerender(<><div data-testid="fate-map-focus-target" tabIndex={0}>地图</div><FateHandSurface {...props} player={{...player,selectedAttackIds:[player.hand[0].id]}}/></>);
 expect(document.activeElement).toBe(mapTarget);
});

it('技能跨区后保留焦点，但不抢走已转移到外部操作的焦点',()=>{
 const player=preparePlayer('focus-skill-cross-zone');
 const skill=player.skills[0];
 expect(skill).toBeDefined();
 const skills=[{skill:skill!,assetPath:'skill-a',available:true,abilityAvailable:true}];
 const props={power:7,player,skills,canSelect:false,onSelect:vi.fn(),onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<><button type="button">外部操作</button><FateHandSurface {...props}/></>);
 view.container.querySelector<HTMLButtonElement>('[data-card-zone="skill"]')!.focus();
 view.rerender(<><button type="button">外部操作</button><FateHandSurface {...props} player={{...player,activeSkills:[skill!.id]}}/></>);
 const activeSkill=screen.getByRole('button',{name:`发动 ${skill!.name}`});
 expect(document.activeElement).toBe(activeSkill);
 const outside=screen.getByRole('button',{name:'外部操作'});
 outside.focus();
 view.rerender(<><button type="button">外部操作</button><FateHandSurface {...props}/></>);
 expect(document.activeElement).toBe(outside);
});

it('骑乘取消后同回合以相同交互标识重开时清空暂存牌',()=>{
 const player=preparePlayer('riding-cancel-reopen-same-id','servant-rider');
 const card=player.hand.find(item=>(FATE_ATTACK_BY_ID[item.definitionId]?.manaCost??Infinity)<=player.mana);
 expect(card).toBeDefined();
 const onConfirm=vi.fn();
 const onCancel=vi.fn();
 function ControlledRiderChoice() {
  const [open,setOpen]=useState(true);
  const ridingChoice=open?{interactionId:'fate:riding-choice:2:0:0:sc_iskandar_1',round:2,candidateIds:[card!.id],onConfirm,onCancel:()=>{onCancel();setOpen(false);}}:undefined;
  return <><button type="button" onClick={()=>setOpen(true)}>重开骑乘选择</button><FateHandSurface power={0} player={player} skills={[]} canSelect={false} onSelect={vi.fn()} onPlaySkill={vi.fn()} onInspect={vi.fn()} ridingChoice={ridingChoice}/></>;
 }
 render(<ControlledRiderChoice/>);
 const cardName=FATE_ATTACK_BY_ID[card!.definitionId].name;
 const candidate=screen.getByRole('button',{name:`选择坐骑召唤 ${cardName}`});
 fireEvent.click(candidate);
 expect(screen.getByRole('button',{name:`取消骑乘选择 ${cardName}`}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByTestId('fate-riding-cancel'));
 expect(onCancel).toHaveBeenCalledOnce();
 expect(screen.queryByTestId('fate-riding-controls')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'重开骑乘选择'}));
 expect(screen.getByRole('button',{name:`选择坐骑召唤 ${cardName}`}).getAttribute('aria-pressed')).toBe('false');
 expect(screen.getByTestId('fate-riding-confirm').textContent).toBe('确认打出（0）');
 fireEvent.click(screen.getByTestId('fate-riding-confirm'));
 expect(onConfirm).toHaveBeenCalledExactlyOnceWith([]);
});
