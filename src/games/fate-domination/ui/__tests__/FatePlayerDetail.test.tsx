import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createReplayAdapter } from '../../../../engine/adapter';
import { FateDominationDomain } from '../../domain';
import { FatePlayerDetail } from '../FatePlayerDetail';
import { projectFatePlayerView, visibleFateServantClass } from '../../domain/playerView';
vi.mock('../../../../components/common/media/OptimizedImage', () => ({ OptimizedImage: ({src,alt}: {src:string;alt:string}) => <img src={src} alt={alt}/> }));
it('详情内循环键盘焦点，七人切换入口可辨识且不穿透到牌桌', () => {
 const core=createReplayAdapter(FateDominationDomain,'detail-focus').setup(['0','1','2','3','4','5','6']).core;
 render(<><button>底层确认攻击</button><FatePlayerDetail core={core} playerId="0" viewerId="0" servantBack="back" skillBack="skillback" onPlayer={vi.fn()} onClose={vi.fn()} onInspect={vi.fn()}/></>);
 const dialog=screen.getByRole('dialog');
 const navigation=within(dialog).getByRole('navigation',{name:'切换玩家'});
 expect(within(navigation).getAllByRole('button')).toHaveLength(7);
 expect(screen.queryByText('你的御主')).toBeNull();
 expect(dialog.querySelector('.fd-player-detail-content')).toBeTruthy();
 const buttons=within(dialog).getAllByRole('button');
 buttons[0].focus();fireEvent.keyDown(buttons[0],{key:'Tab',shiftKey:true});
 expect(document.activeElement).toBe(buttons.at(-1));
 fireEvent.keyDown(buttons.at(-1)!,{key:'Tab'});
 expect(document.activeElement).toBe(buttons[0]);
 expect(within(navigation).getAllByRole('button')[1].getAttribute('aria-label')).toContain('玩家2');
});

it('恢复两排卡牌：能力说明留在令咒同列，不插入新行把技能挤出', () => {
 const core=createReplayAdapter(FateDominationDomain,'detail-rule-row').setup(['0','1','2']).core;
 const {container}=render(<FatePlayerDetail core={core} playerId="0" viewerId="0" servantBack="back" skillBack="skillback" onPlayer={vi.fn()} onClose={vi.fn()} onInspect={vi.fn()}/>);
 const copy=screen.getByRole('region',{name:'御主能力说明'});
 expect(copy.parentElement?.classList.contains('fd-player-detail-ability')).toBe(true);
 expect(copy.previousElementSibling?.classList.contains('fd-detail-seals')).toBe(true);
 expect(container.querySelector('.fd-player-detail-content')?.children).toHaveLength(2);
 expect(copy.querySelectorAll('p').length).toBeGreaterThan(0);
 expect(container.querySelector('.fd-player-detail-master .fd-detail-ability-copy')).toBeNull();
});

it('未投影旁观状态也不得展示未公开技能，公开一张时仅该张翻正',()=>{
 const core=createReplayAdapter(FateDominationDomain,'detail-public-skill').setup(['0','1','2']).core;
 const props={core,playerId:'0',viewerId:null,servantBack:'back',skillBack:'skillback',onPlayer:vi.fn(),onClose:vi.fn(),onInspect:vi.fn()};
 const view=render(<FatePlayerDetail {...props}/>);
 expect(view.container.querySelectorAll('.fd-player-detail-skills img[src="skillback"]')).toHaveLength(3);
 const changed=structuredClone(core);changed.players['0'].revealedSkillIds=[changed.players['0'].skills.find(skill=>skill.id.startsWith('sc_'))!.id];
 view.rerender(<FatePlayerDetail {...props} core={changed}/>);
 expect(view.container.querySelectorAll('.fd-player-detail-skills img[src="skillback"]')).toHaveLength(2);
});

it('监督者详情可见隐藏职阶但不揭露真名，普通玩家和旁观者看不到',()=>{
 const adapter=createReplayAdapter(FateDominationDomain,'supervisor-detail');
 let state=adapter.setup(['0','1','2']);
 state=adapter.execute(state,{type:'SELECT_MASTER',playerId:'0',payload:{masterId:'m_kirei'}}).state;
 const expected=visibleFateServantClass(state.core,'1','0')!;
 expect(expected).toBeTruthy();
 const props={core:projectFatePlayerView(state.core,'0'),playerId:'1',viewerId:'0',servantBack:'back',skillBack:'skillback',onPlayer:vi.fn(),onClose:vi.fn(),onInspect:vi.fn()};
 const view=render(<FatePlayerDetail {...props}/>);
 expect(screen.getByLabelText('已知职阶').textContent).toBe(`职阶 ${expected}`);
 expect(screen.getByRole('button',{name:'从者尚未解放'}).querySelector('img')?.getAttribute('src')).toBe('back');
 expect(view.container.querySelectorAll('.fd-player-detail-skills img[src="skillback"]')).toHaveLength(3);
 for(const viewerId of ['2',null]){
  view.rerender(<FatePlayerDetail {...props} core={projectFatePlayerView(state.core,viewerId)} viewerId={viewerId}/>);
  expect(screen.queryByLabelText('已知职阶')).toBeNull();
 }
});

it('详情读取对手时按当前观看者投影身份与技能，只有真名解放后显示正面',()=>{
 const core=createReplayAdapter(FateDominationDomain,'detail-opponent-hidden').setup(['0','1','2']).core;
 expect(core.players['1'].isRevealed).toBe(false);
 const props={core,playerId:'1',viewerId:'0',servantBack:'back',skillBack:'skillback',onPlayer:vi.fn(),onClose:vi.fn(),onInspect:vi.fn()};
 const view=render(<FatePlayerDetail {...props}/>);
 const identity=within(screen.getByRole('dialog')).getByRole('button',{name:'从者尚未解放'});
 expect(identity.querySelector('img')?.getAttribute('src')).toBe('back');
 expect(view.container.querySelectorAll('.fd-player-detail-skills img[src="skillback"]')).toHaveLength(3);
 expect(within(screen.getByRole('dialog')).getAllByRole('button',{name:/^检视暗置技能/}).every(button=>(button as HTMLButtonElement).disabled)).toBe(true);

 const revealed=structuredClone(core);
 revealed.players['1'].isRevealed=true;
 view.rerender(<FatePlayerDetail {...props} core={revealed}/>);
 expect(within(screen.getByRole('dialog')).getByRole('button',{name:'检视从者'}).querySelector('img')?.getAttribute('src')).not.toBe('back');
 expect(view.container.querySelectorAll('.fd-player-detail-skills img[src="skillback"]')).toHaveLength(0);
});
