import { act, render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { FateDominationDomain } from '../domain';
import { FateDominationBoard } from '../Board';
import {fateTokenAsset} from '../data/identityArtwork';
import {FATE_MASTERS,FATE_SERVANTS} from '../data';
const preparedBoardState = (seed: string, playerIds = ['0', '1', '2']) => {
    const adapter = createReplayAdapter(FateDominationDomain, seed);
    let state = adapter.setup(playerIds);
    for (const playerId of playerIds) {
        const identity = state.core.players[playerId];
        state = adapter.execute(state, { type: 'SELECT_MASTER', playerId, payload: { masterId: identity.masterId } }).state;
        state = adapter.execute(state, { type: 'SELECT_SERVANT', playerId, payload: { servantId: identity.servantId } }).state;
        state = adapter.execute(state, { type: 'ADVANCE_PHASE', playerId, payload: {} }).state;
        expect(state.core.players[playerId].hand).toHaveLength(3);
    }
    expect(state.core.phase).toBe('outpost');
    return state;
};
vi.mock('../../../contexts/RematchContext', () => ({ useRematch: () => ({ state: { votes: {}, ready: false, revision: 0 }, vote: vi.fn(), registerReset: vi.fn() }) }));
vi.mock('../../../contexts/ToastContext', () => ({useToast: () => ({warning:vi.fn()})}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key === 'commands.passAction' ? '结束行动' : key, i18n: { language: 'zh-CN' } }) }));
vi.mock('../../../contexts/UndoContext', () => ({ UndoProvider: ({ children }: {
        children: React.ReactNode;
    }) => <>{children}</> }));
vi.mock('../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({ src, alt }: {
        src: string;
        alt: string;
    }) => <img src={src} alt={alt}/> }));
vi.mock('../ui/FateMapSurface', () => ({ FateMapSurface: ({ legalLocations, onPawn, onLocation }: { legalLocations: string[]; onPawn: () => void; onLocation:(id:string)=>void }) => <div data-testid="shared-map" data-legal-locations={legalLocations.join(',')}><button onClick={onPawn}>本人棋子</button>{legalLocations.map(id=><button key={id} onClick={()=>onLocation(id)}>地点{id}</button>)}</div> }));
vi.mock('../ui/FatePlayerDetail', () => ({ FatePlayerDetail: ({ playerId, onInspect, onClose }: any) => <div data-testid="detail" onKeyDown={event => {if(event.key==='Escape'){event.stopPropagation();onClose();}}}>{playerId}<button onClick={() => onInspect('fate-domination/skills/sc_saber_1','测试卡')}>检视测试卡</button></div> }));
it('正式对局使用新手牌与地图表面，选中席位展开出牌，头像打开该玩家详情', () => {
    const G = preparedBoardState('runtime-board', ['0', '1', '2']);
    G.core.phase = 'action';
    G.core.players['0'].locationId = 'miyama';
    const dispatch = vi.fn();
    render(<FateDominationBoard {...({ G, dispatch, playerID: '0', isMultiplayer: true, matchData: [] } as never)}/>);
    expect(screen.getByTestId('shared-map')).toBeTruthy();
    expect(screen.getByTestId('fate-hand-zones')).toBeTruthy();
    const seatAvatar=screen.getByRole('button',{name:'查看玩家 2详情'});
    expect(seatAvatar.querySelector('img')?.getAttribute('src')).toBe(fateTokenAsset(G.core.players['1'].masterId));
    expect(seatAvatar.querySelectorAll('img')).toHaveLength(2);
    fireEvent.pointerEnter(seatAvatar.closest('section')!);
    expect(screen.getByLabelText('玩家 2已打出')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看玩家 2详情' }));
    expect(screen.getByTestId('detail').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('fate-domination-hand').querySelector('button')!);
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('fate-play-area').querySelector(`[data-card-id="${G.core.players['0'].hand[0].id}"]`)).toBeTruthy();
});

it('首轮已完成准备的玩家只读显示角色选择，未准备的玩家仍可自行选择', () => {
 const G=createReplayAdapter(FateDominationDomain,'setup-identity-lock-ui').setup(['0','1','2']);
 G.core.phase='preparation';G.core.round=1;G.core.currentPlayerId='0';G.core.phaseCompletedPlayerIds=['0'];
 const dispatch=vi.fn();
 const base={G,dispatch,isMultiplayer:true,matchData:[]};
 const {rerender}=render(<FateDominationBoard {...({...base,playerID:'0'} as never)}/>);
 expect(screen.getByTestId('fate-identity-confirmed').textContent).toContain('角色选择已确认');
 expect(screen.queryByLabelText('御主')).toBeNull();
 expect(screen.queryByLabelText('从者')).toBeNull();

 // Setup ownership is per player: player 1 may choose while player 0 remains the current turn owner.
 rerender(<FateDominationBoard {...({...base,playerID:'1'} as never)}/>);
 expect(G.core.currentPlayerId).toBe('0');
 expect(screen.queryByTestId('fate-identity-confirmed')).toBeNull();
 expect(screen.getByLabelText('御主')).toBeTruthy();
 expect(screen.getByLabelText('从者')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('御主'),{target:{value:FATE_MASTERS[0].id}});
 expect(dispatch).toHaveBeenCalledWith('SELECT_MASTER',{masterId:FATE_MASTERS[0].id});
});

it('骑乘由 Board 从技能入口接入内联手牌事务，并在待选时锁住阶段/地图动作', () => {
 const G=preparedBoardState('riding-board-choice', ['0','1','2']);
 G.core.round=4;G.core.phase='action';G.core.currentPlayerId='0';
 const rider=FATE_SERVANTS.find(servant=>servant.trueName==='伊斯坎达尔')!;
 const actor=G.core.players['0'];actor.servantId=rider.id;actor.skills=(rider.skillCards??[]).map((skill,index)=>({...skill,id:`${skill.id}:${index}`}));
 const ridingSkillId=actor.skills.find(skill=>skill.id.startsWith('sc_iskandar_1:'))!.id;
 actor.activeSkills=[ridingSkillId];actor.usedAbilityIds=[];actor.locationId='miyama';actor.mana=5;
 actor.hand=[{id:'remote2',definitionId:'cardPreparation'},{id:'power4',definitionId:'cardB3'}];
 G.core.currentEvents={miyama:[],shinto:[]};for(const location of Object.values(G.core.battlefield))location.eventCards=[];
 G.core.battlefield.miyama.playerIds=['0'];
 const dispatch=vi.fn();const props={G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]};
 const view=render(<FateDominationBoard {...(props as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'发动 骑乘'}));
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('PLAY_SKILL',{skillId:ridingSkillId});

 const first=createSimpleChoice('fate:riding-choice:4:0:sc_iskandar_1:0','0','坐骑召唤',[
  {id:'remote2',label:'远隔操作',value:'remote2'},
 ],{sourceId:'fate:riding-choice',multi:{min:0,max:3},targetType:'hand'});
 const pending=structuredClone(G);pending.sys.interaction.current={...first,resolutionFrameId:'riding-frame'};
 view.rerender(<FateDominationBoard {...({...props,G:pending} as never)}/>);
 expect(screen.getByTestId('fate-domination-primary-action')).toBeDisabled();
 expect(screen.getByTestId('shared-map').getAttribute('data-legal-locations')).toBe('');
 expect(screen.getByRole('button',{name:'选择坐骑召唤 浑身的一击'})).toHaveAttribute('aria-disabled','true');
 fireEvent.click(screen.getByTestId('fate-riding-cancel'));
 expect(dispatch).toHaveBeenLastCalledWith('SYS_INTERACTION_CANCEL',{interactionId:first.id});

 const second=createSimpleChoice('fate:riding-choice:4:0:sc_iskandar_1:0','0','坐骑召唤',[
  {id:'remote2',label:'远隔操作',value:'remote2'},
 ],{sourceId:'fate:riding-choice',multi:{min:0,max:3},targetType:'hand'});
 const renewed=structuredClone(G);renewed.sys.interaction.current={...second,resolutionFrameId:'riding-frame'};
 view.rerender(<FateDominationBoard {...({...props,G:renewed} as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'选择坐骑召唤 远隔操作'}));
 fireEvent.click(screen.getByTestId('fate-riding-confirm'));
 expect(dispatch).toHaveBeenLastCalledWith('SYS_INTERACTION_RESPOND',{interactionId:second.id,optionIds:['remote2']});
});

it('部署目标包含魔术工房，不能误用仅战斗地点的列表', () => {
 const G=preparedBoardState('deployment-ui', ['0','1','2']);
 G.core.phase='outpost';
 render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 expect(screen.getByTestId('shared-map').getAttribute('data-legal-locations')?.split(',')).toEqual(['workshop','miyama','shinto']);
});
it('令咒先选择效果，唯一确认才发送一次领域命令', () => {
 const G=preparedBoardState('seal-ui', ['0','1','2']);G.core.phase='action';
 const dispatch=vi.fn();
 render(<FateDominationBoard {...({G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'使用令咒'}));
 fireEvent.click(screen.getByRole('button',{name:/恢复魔力/}));
 expect(dispatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'确认使用'}));
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('USE_COMMAND_SPELL',{effect:'mana'});
});
it.each(['current','queue'] as const)('令咒入口在 %s 交互阻塞时不可开启',slot=>{
 const G=preparedBoardState('seal-blocked-entry');G.core.phase='action';
 const choice=createSimpleChoice('seal-block','0','等待选择',[{id:'ok',label:'确认',value:'ok'}],{sourceId:'test:seal-block'});
 if(slot==='current')G.sys.interaction.current=choice;else G.sys.interaction.queue=[choice];
 const dispatch=vi.fn();
 render(<FateDominationBoard {...({G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 const entry=screen.getByRole('button',{name:'使用令咒'});
 expect(entry).toBeDisabled();fireEvent.click(entry);
 expect(screen.queryByRole('dialog',{name:'使用令咒'})).toBeNull();
 expect(dispatch).not.toHaveBeenCalled();
});
it('令咒打开并选择后新增交互队列，禁止确认及移动，解除后可继续',()=>{
 const G=preparedBoardState('seal-queued-after-open');G.core.phase='action';
 G.core.players['0'].locationId='miyama';
 const dispatch=vi.fn();const props={G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]};
 const view=render(<FateDominationBoard {...(props as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'使用令咒'}));
 fireEvent.click(screen.getByRole('button',{name:/恢复魔力/}));
 const blocked=structuredClone(G);
 blocked.sys.interaction.queue=[createSimpleChoice('seal-queued','0','等待选择',[{id:'ok',label:'确认',value:'ok'}],{sourceId:'test:seal-block'})];
 view.rerender(<FateDominationBoard {...({...props,G:blocked} as never)}/>);
 const confirm=screen.getByRole('button',{name:'确认使用'});
 const move=screen.getByRole('button',{name:/令咒移动.*从深山町/});
 expect(confirm).toBeDisabled();expect(move).toBeDisabled();
 expect(screen.getByRole('button',{name:/恢复魔力/})).toBeDisabled();
 fireEvent.click(confirm);fireEvent.click(move);
 expect(dispatch).not.toHaveBeenCalled();
 expect(screen.getByRole('dialog',{name:'使用令咒'})).toBeTruthy();
 view.rerender(<FateDominationBoard {...(props as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'确认使用'}));
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('USE_COMMAND_SPELL',{effect:'mana'});
});
it('回合移交即取消移动选择，下一次轮到自己不能沿用旧移动入口', () => {
 const G=preparedBoardState('movement-owner', ['0','1','2']);
 G.core.phase='action';G.core.players['0'].locationId='miyama';
 G.core.players['0'].mana=12;
 // Interaction ownership only; random event locks are covered by movement contracts.
 G.core.battlefield.miyama.eventCards=[];G.core.battlefield.shinto.eventCards=[];G.core.currentEvents={miyama:[],shinto:[]};
 const props={G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]};
 const {rerender}=render(<FateDominationBoard {...(props as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'本人棋子',exact:true}));
 expect(screen.getByTestId('shared-map').getAttribute('data-legal-locations')).not.toBe('');
 const next=structuredClone(G);next.core.currentPlayerId='1';
 rerender(<FateDominationBoard {...({...props,G:next} as never)}/>);
 expect(screen.getByTestId('shared-map').getAttribute('data-legal-locations')).toBe('');
 rerender(<FateDominationBoard {...(props as never)}/>);
 expect(screen.getByTestId('shared-map').getAttribute('data-legal-locations')).toBe('');
});
it('跳过整个行动的按钮明确叫结束行动，不伪装成只跳过能力', () => {
 const G=preparedBoardState('pass-copy', ['0','1','2']);G.core.phase='action';
 const dispatch=vi.fn();render(<FateDominationBoard {...({G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 expect(screen.queryByRole('button',{name:'不使用能力'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'结束行动',exact:true}));
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('PASS_ACTION',{});
});

it('检视大图先消费退出键，回到原详情按钮，再次退出才关闭详情', () => {
 const G=preparedBoardState('inspect-layers', ['0','1','2']);
 render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'查看玩家 2详情'}));
 const source=screen.getByRole('button',{name:'检视测试卡'});source.focus();fireEvent.click(source);
 const inspection=screen.getByRole('button',{name:'关闭测试卡大图'});
 expect(document.activeElement).toBe(inspection);
 fireEvent.keyDown(inspection,{key:'Escape'});
 expect(screen.queryByRole('button',{name:'关闭测试卡大图'})).toBeNull();
 expect(screen.getByTestId('detail')).toBeTruthy();expect(document.activeElement).toBe(source);
 fireEvent.keyDown(source,{key:'Escape'});expect(screen.queryByTestId('detail')).toBeNull();
 expect(screen.getByLabelText('玩家 2已打出')).toBeTruthy();
});
it('展开出牌不移动席位列表，收起后保留完整席位入口', () => {
 const G=preparedBoardState('seat-drawer', ['0','1','2','3','4','5','6']);
 render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 fireEvent.pointerEnter(screen.getByRole('button',{name:'查看玩家 2详情'}).closest('section')!);
 const drawer=screen.getByLabelText('玩家 2已打出');
 expect(drawer.closest('.fd-runtime-seat')).toBeNull();
 expect(document.querySelectorAll('.fd-runtime-seat-list .fd-runtime-seat')).toHaveLength(6);
 fireEvent.click(screen.getByRole('button',{name:'收起已打出卡牌'}));
 expect(screen.queryByLabelText('玩家 2已打出')).toBeNull();
 expect(document.querySelectorAll('.fd-runtime-seat-list .fd-runtime-seat')).toHaveLength(6);
});

it('保留本人席位和唯一右下阶段入口，抽屉不重复姓名或展示解释按钮', () => {
 const G=preparedBoardState('object-contract', ['0','1','2']);G.core.phase='action';
 render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 expect(screen.getByLabelText('本人席位')).toBeTruthy();
 expect(screen.getByTestId('fate-domination-primary-action').closest('.fd-phase-control')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'移动',exact:true})).toBeNull();
 expect(screen.queryByText('查看御主与从者')).toBeNull();
 fireEvent.pointerEnter(screen.getByRole('button',{name:'查看玩家 2详情'}).closest('section')!);
 const drawer=screen.getByLabelText('玩家 2已打出');
 expect(drawer.textContent).toContain('合计威力');expect(drawer.textContent).not.toContain('玩家 2');
 expect(document.querySelectorAll('.fd-phase-control button')).toHaveLength(1);
});
it('选中一张攻击时不能由阶段入口静默结束，清空选择才恢复结束行动', () => {
 const G=preparedBoardState('partial-selection', ['0','1','2']);G.core.phase='action';
 G.core.players['0'].selectedAttackIds=[G.core.players['0'].hand[0].id];
 render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 expect(screen.getByTestId('fate-domination-primary-action').hasAttribute('disabled')).toBe(true);
 expect(screen.queryByRole('button',{name:'结束行动',exact:true})).toBeNull();
});

it('本地行动权切换后不把新的本人保留在对手抽屉', () => {
 const G=preparedBoardState('hotseat-selection', ['0','1','2']);G.core.phase='action';
 const props={G,dispatch:vi.fn(),isMultiplayer:false,matchData:[]};
 const {rerender}=render(<FateDominationBoard {...(props as never)}/>);
 fireEvent.pointerEnter(screen.getByRole('button',{name:'查看玩家 2详情'}).closest('section')!);
 expect(screen.getByLabelText('玩家 2已打出')).toBeTruthy();
 const next=structuredClone(G);next.core.currentPlayerId='1';rerender(<FateDominationBoard {...({...props,G:next} as never)}/>);
 expect(screen.queryByLabelText('玩家 2已打出')).toBeNull();
});

it('已打出牌鼠标预览不抢焦点，退出键仍关闭大图', () => {
 const originalMatchMedia=window.matchMedia;
 Object.defineProperty(window,'matchMedia',{configurable:true,value:vi.fn().mockReturnValue({matches:true})});
 try {
  const G=preparedBoardState('hover-escape', ['0','1','2']);G.core.phase='action';
  G.core.players['0'].activeAttackIds=[G.core.players['0'].hand[0].id];
  render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
  fireEvent.mouseEnter(screen.getByTestId('fate-play-area').querySelector('[data-card-zone="active"]')!);
  expect(document.querySelector('.fd-inspection-hover')).toBeTruthy();
  fireEvent.keyDown(document.body,{key:'Escape'});
  expect(document.querySelector('.fd-inspection-hover')).toBeNull();
 } finally {
  Object.defineProperty(window,'matchMedia',{configurable:true,value:originalMatchMedia});
 }
});
it('桌面指针离开活动攻击牌后关闭临时预览', () => {
 const originalMatchMedia=window.matchMedia;
 Object.defineProperty(window,'matchMedia',{configurable:true,value:vi.fn().mockReturnValue({matches:true})});
 try {
  const G=preparedBoardState('hover-leave', ['0','1','2']);G.core.phase='action';
  G.core.players['0'].activeAttackIds=[G.core.players['0'].hand[0].id];
  render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
  const card=screen.getByTestId('fate-play-area').querySelector('[data-card-zone="active"]')!;
  fireEvent.mouseEnter(card);
  expect(document.querySelector('.fd-inspection-hover')).toBeTruthy();
  fireEvent.mouseLeave(card);
  expect(document.querySelector('.fd-inspection-hover')).toBeNull();
 } finally {
  Object.defineProperty(window,'matchMedia',{configurable:true,value:originalMatchMedia});
 }
});
it('桌面关闭卡牌检视并恢复焦点时不把鼠标外的源牌重新悬停', () => {
 const originalMatchMedia=window.matchMedia;
 Object.defineProperty(window,'matchMedia',{configurable:true,value:vi.fn().mockReturnValue({matches:true})});
 const originalMatches=HTMLElement.prototype.matches;
 const matchesSpy=vi.spyOn(HTMLElement.prototype,'matches').mockImplementation(function(selector){
  return selector===':focus-visible'?true:originalMatches.call(this,selector);
 });
 try {
  const G=preparedBoardState('hover-focus-restore', ['0','1','2']);G.core.phase='action';
  G.core.players['0'].activeAttackIds=[G.core.players['0'].hand[0].id];
  render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
  const card=screen.getByTestId('fate-play-area').querySelector<HTMLButtonElement>('[data-card-zone="active"]')!;
  act(()=>card.focus());
  fireEvent.contextMenu(card);
  expect(screen.getByRole('dialog',{name:/卡牌检视/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/关闭.*大图/}));
  expect(document.activeElement).toBe(card);
  expect(document.querySelector('.fd-inspection-hover')).toBeNull();
 } finally {
  matchesSpy.mockRestore();
  Object.defineProperty(window,'matchMedia',{configurable:true,value:originalMatchMedia});
 }
});
it('触屏态卡牌焦点和关闭检视后不恢复桌面悬停预览', () => {
 const originalMatchMedia=window.matchMedia;
 Object.defineProperty(window,'matchMedia',{configurable:true,value:vi.fn().mockReturnValue({matches:false})});
 try {
  const G=preparedBoardState('touch-no-hover', ['0','1','2']);G.core.phase='action';
  G.core.players['0'].activeAttackIds=[G.core.players['0'].hand[0].id];
  render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
  const card=screen.getByTestId('fate-play-area').querySelector<HTMLButtonElement>('[data-card-zone="active"]')!;
  card.focus();
  expect(document.querySelector('.fd-inspection-hover')).toBeNull();
  fireEvent.contextMenu(card);
  expect(screen.getByRole('button',{name:/关闭.*大图/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/关闭.*大图/}));
  expect(document.querySelector('.fd-inspection-hover')).toBeNull();
 } finally {
  Object.defineProperty(window,'matchMedia',{configurable:true,value:originalMatchMedia});
 }
});
it('进入令咒选择前关闭持久预览，不能覆盖新弹层', () => {
 const G=preparedBoardState('hover-seal', ['0','1','2']);G.core.phase='action';
 render(<FateDominationBoard {...({G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 fireEvent.contextMenu(screen.getByTestId('fate-domination-hand').querySelector('button')!);
 expect(document.querySelector('.fd-runtime-inspection.is-pinned')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'使用令咒'}));
 expect(document.querySelector('.fd-inspection-hover')).toBeNull();
 expect(screen.getByRole('button',{name:/恢复魔力/})).toBeTruthy();
});

it('令咒移动在地图选目的地，确认前不消耗，取消不提交',()=>{
 const G=preparedBoardState('seal-map-choice', ['0','1','2']);G.core.phase='action';G.core.players['0'].locationId='miyama';
 G.core.players['0'].mana=12;
 // Interaction ownership only; random event locks are covered by movement contracts.
 G.core.battlefield.miyama.eventCards=[];G.core.battlefield.shinto.eventCards=[];G.core.currentEvents={miyama:[],shinto:[]};G.core.players['0'].mana=12;
 const dispatch=vi.fn();render(<FateDominationBoard {...({G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'使用令咒'}));
 fireEvent.click(screen.getByRole('button',{name:/令咒移动.*从深山町/}));
 expect(screen.queryByRole('dialog',{name:'使用令咒'})).toBeNull();
 expect(dispatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'地点workshop'}));
 expect(dispatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'确认移动',exact:true}));
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('USE_COMMAND_SPELL',{effect:'move',targetLocationId:'workshop'});
});
it('已激活移动技能在地图选择合法目标，确认才提交技能目标',()=>{
 const G=preparedBoardState('skill-map-choice', ['0','1','2']);G.core.phase='action';
 const servant=FATE_SERVANTS.find(s=>(s.skillCards??[]).some(card=>card.id==='sc_cu_2'))!;
 const actor=G.core.players['0'];actor.locationId='miyama';actor.mana=9;actor.servantId=servant.id;actor.skills=servant.skillCards!.map(s=>({...s}));actor.activeSkills=['sc_cu_2'];actor.normalAttackPlayed=true;
 const dispatch=vi.fn();render(<FateDominationBoard {...({G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'发动 战斗续行'}));
 expect(screen.queryByRole('button',{name:'地点workshop'})).toBeNull();
 expect(dispatch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'地点recon'}));
 fireEvent.click(screen.getByRole('button',{name:'确认移动',exact:true}));
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('PLAY_SKILL',{skillId:'sc_cu_2',targetLocationId:'recon'});
});

it('已打出攻击牌的非移动能力仍直接派发本张实例，不打开移动选择',()=>{
 const G=preparedBoardState('active-card-ability', ['0','1','2']);
 G.core.phase='action';
 const actor=G.core.players['0'];actor.locationId='miyama';actor.mana=8;
 actor.hand=[{id:'remote-instance-0',definitionId:'cardPreparation'}];
 actor.activeAttackIds=['remote-instance-0'];actor.normalAttackPlayed=true;
 G.core.currentEvents={miyama:[],shinto:[]};
 for(const location of Object.values(G.core.battlefield))location.eventCards=[];
 const dispatch=vi.fn();
 render(<FateDominationBoard {...({G,dispatch,playerID:'0',isMultiplayer:true,matchData:[]} as never)}/>);
 fireEvent.click(screen.getByTestId('fate-play-area').querySelector('[data-card-zone="active"]')!);
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('PLAY_SKILL',{skillId:'remote-instance-0'});
 expect(screen.queryByRole('button',{name:'取消移动'})).toBeNull();
});


it('保留场景实例时，换阶段仍关闭已打开的详情',()=>{
 const G=preparedBoardState('portal-phase-reset', ['0','1','2']);G.core.phase='action';
 const props={G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]};
 const view=render(<FateDominationBoard {...(props as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'查看玩家 1详情'}));
 expect(screen.getByTestId('detail')).toBeTruthy();
 const next=structuredClone(G);next.core.phase='battle';view.rerender(<FateDominationBoard {...({...props,G:next} as never)}/>);
 expect(screen.queryByTestId('detail')).toBeNull();
});


it.each(['inspection','seal','pile'] as const)('保留场景时换阶段关闭%s临时界面',kind=>{
 const G=preparedBoardState('transient-phase-reset', ['0','1','2']);G.core.phase='action';
 const props={G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]};
 const view=render(<FateDominationBoard {...(props as never)}/>);
 if(kind==='inspection')fireEvent.contextMenu(screen.getByTestId('fate-domination-hand').querySelector('button')!);
 else if(kind==='seal')fireEvent.click(screen.getByRole('button',{name:'使用令咒'}));
 else fireEvent.click(screen.getByRole('button',{name:/抽牌堆/}));
 const selector=kind==='inspection'?'.fd-inspection-backdrop':kind==='seal'?'.fd-runtime-seal-choice':'.fd-self-pile-info';
 expect(document.querySelector(selector)).toBeTruthy();
 const next=structuredClone(G);next.core.phase='battle';view.rerender(<FateDominationBoard {...({...props,G:next} as never)}/>);
 expect(document.querySelector(selector)).toBeNull();
});
it('同玩家同阶段出现战后选择时关闭旧详情，避免遮住必要决策', async()=>{
 const {createSimpleChoice}=await import('../../../engine/systems/InteractionSystem');
 const {FATE_SEAL_RESTORE_CHOICE}=await import('../domain/postBattleChoice');
 const G=preparedBoardState('choice-modal-cleanup', ['0','1','2']);G.core.phase='battle';
 const props={G,dispatch:vi.fn(),playerID:'0',isMultiplayer:true,matchData:[]};
 const view=render(<FateDominationBoard {...(props as never)}/>);
 fireEvent.click(screen.getByRole('button',{name:'查看玩家 1详情'}));expect(screen.getByTestId('detail')).toBeTruthy();
 const next=structuredClone(G);next.sys.interaction.current=createSimpleChoice('new-reward','0','战后恢复令咒',[{id:'restore',label:'恢复一枚令咒',value:'restore'},{id:'decline',label:'不恢复',value:'decline'}],{sourceId:FATE_SEAL_RESTORE_CHOICE});
 view.rerender(<FateDominationBoard {...({...props,G:next} as never)}/>);
 expect(screen.queryByTestId('detail')).toBeNull();expect(screen.getByRole('dialog',{name:'战后恢复令咒'})).toBeTruthy();
});

it('普通选牌与撤回只预览本地，确认一次提交完整草稿，断线不丢选择',async()=>{
 const G=preparedBoardState('local-attack-draft');
 G.core.phase='action';G.core.currentPlayerId='0';
 const actor=G.core.players['0'];actor.locationId='workshop';actor.mana=12;
 actor.hand=[{id:'draft-a',definitionId:'cardB1'},{id:'draft-b',definitionId:'cardB2'}];
 const original=structuredClone(G);const dispatch=vi.fn();
 const props={G,dispatch,playerID:'0',isMultiplayer:true,isConnected:true,matchData:[]};
 const view=render(<FateDominationBoard {...(props as never)}/>);
 const card=(id:string)=>view.container.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
 fireEvent.click(card('draft-a'));
 expect(dispatch).not.toHaveBeenCalled();
 expect(card('draft-a').dataset.cardZone).toBe('staged');
 fireEvent.click(card('draft-a'));
 expect(card('draft-a').dataset.cardZone).toBe('hand');
 fireEvent.click(card('draft-a'));fireEvent.click(card('draft-b'));
 expect(dispatch).not.toHaveBeenCalled();expect(G).toEqual(original);
 view.rerender(<FateDominationBoard {...({...props,isConnected:false} as never)}/>);
 expect(screen.getByTestId('fate-domination-primary-action')).toBeDisabled();
 expect(card('draft-a').dataset.cardZone).toBe('staged');
 view.rerender(<FateDominationBoard {...(props as never)}/>);
 fireEvent.click(screen.getByTestId('fate-domination-primary-action'));
 expect(dispatch).toHaveBeenCalledExactlyOnceWith('CONFIRM_ATTACK',{cardIds:['draft-a','draft-b'],faceDownIds:[],round:G.core.round});
 // A rejected/ignored command can leave the authoritative object unchanged.
 view.rerender(<FateDominationBoard {...(props as never)}/>);
 expect(card('draft-a').dataset.cardZone).toBe('staged');
 await act(async()=>{await Promise.resolve();});
 fireEvent.click(screen.getByTestId('fate-domination-primary-action'));
 expect(dispatch).toHaveBeenCalledTimes(2);
 const confirm={type:'CONFIRM_ATTACK',playerId:'0',payload:{cardIds:['draft-a','draft-b'],faceDownIds:[],round:G.core.round}} as const;
 expect(FateDominationDomain.validate(G,confirm as never).valid).toBe(true);
 const accepted=createReplayAdapter(FateDominationDomain,'draft-ack').execute(G,confirm as never).state;
 view.rerender(<FateDominationBoard {...({...props,G:accepted} as never)}/>);
 expect(card('draft-a').dataset.cardZone).toBe('active');
 view.rerender(<FateDominationBoard {...(props as never)}/>);
 expect(card('draft-a').dataset.cardZone).toBe('hand');
 fireEvent.click(card('draft-a'));fireEvent.click(card('draft-b'));
 const removed=structuredClone(G);removed.core.players['0'].hand=removed.core.players['0'].hand.filter(item=>item.id!=='draft-a');
 view.rerender(<FateDominationBoard {...({...props,G:removed} as never)}/>);
 view.rerender(<FateDominationBoard {...(props as never)}/>);
 expect(card('draft-a').dataset.cardZone).toBe('hand');
 expect(card('draft-b').dataset.cardZone).toBe('staged');
 const interrupted=structuredClone(G);
 interrupted.sys.interaction.current=createSimpleChoice('draft-interruption','0','等待选择',[{id:'ok',label:'确认',value:'ok'}],{sourceId:'test:interruption'});
 view.rerender(<FateDominationBoard {...({...props,G:interrupted} as never)}/>);
 view.rerender(<FateDominationBoard {...(props as never)}/>);
 expect(card('draft-a').dataset.cardZone).toBe('hand');
 expect(card('draft-b').dataset.cardZone).toBe('hand');
 expect(dispatch).toHaveBeenCalledTimes(2);
});
