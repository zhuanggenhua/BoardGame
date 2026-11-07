import './helpers/i18n';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {FATE_ATTACK_CARDS} from '../data';
import {FateHandSurface} from '../ui/FateHandSurface';

vi.mock('../../../components/common/media/OptimizedImage',()=>({OptimizedImage:({alt}:{alt:string})=><span>{alt}</span>}));
vi.mock('../../../components/common/media/CardPreview',()=>({CardPreview:({title}:{title:string})=><span>{title}</span>}));
afterEach(()=>vi.useRealTimers());
function touch(button:HTMLElement,type:string,x=20){
 const event=new Event(type,{bubbles:true});
 Object.assign(event,{pointerType:'touch',clientX:x,clientY:20});
 fireEvent(button,event);
}
function setup(){
 vi.useFakeTimers();
 const player=createReplayAdapter(FateDominationDomain,'hand-longpress').setup(['0','1','2']).core.players['0'];
 const card=FATE_ATTACK_CARDS[0];player.hand=[{id:'touch-card',definitionId:card.id}];
 const props={player,power:0,skills:[],canSelect:true,onSelect:vi.fn(),onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props}/>);
 return {...view,props,card,button:screen.getByRole('button',{name:`选择 ${card.name}`})};
}
it('长按只打开完整卡面，抬手产生的点击不能同时选牌',()=>{
 const {button,props,card}=setup();
 touch(button,'pointerdown');act(()=>vi.advanceTimersByTime(510));
 expect(props.onInspect).toHaveBeenCalledExactlyOnceWith(card.assetPath,card.name,true);
 touch(button,'pointerup');fireEvent.click(button);
 expect(props.onSelect).not.toHaveBeenCalled();
 fireEvent.click(button);expect(props.onSelect).toHaveBeenCalledExactlyOnceWith('touch-card',undefined);
});
it('短按保持选牌，横向浏览或切换交互会取消尚未触发的长按',()=>{
 const {button,props,rerender}=setup();
 touch(button,'pointerdown');act(()=>vi.advanceTimersByTime(100));touch(button,'pointerup');fireEvent.click(button);
 expect(props.onSelect).toHaveBeenCalledOnce();
 touch(button,'pointerdown');touch(button,'pointermove',40);act(()=>vi.advanceTimersByTime(600));
 expect(props.onInspect).not.toHaveBeenCalled();
 touch(button,'pointerdown');rerender(<FateHandSurface {...props} rollbackRevision={1}/>);
 act(()=>vi.advanceTimersByTime(600));expect(props.onInspect).not.toHaveBeenCalled();
});
it('长按抬手的兼容点击落到新遮罩时，关闭后下一次真实短按仍然选牌',()=>{
 const {button,props}=setup();
 touch(button,'pointerdown');act(()=>vi.advanceTimersByTime(510));touch(button,'pointerup');
 // 浏览器把兼容点击发给新遮罩，原牌没有收到该 click。
 touch(button,'pointerdown');act(()=>vi.advanceTimersByTime(50));touch(button,'pointerup');fireEvent.click(button);
 expect(props.onSelect).toHaveBeenCalledExactlyOnceWith('touch-card',undefined);
});

it('通用放大镜与卡牌主操作分开，放大不选牌也不发动',()=>{
 const {button,props,card,container}=setup();
 const inspect=screen.getByRole('button',{name:`放大${card.name}`});
 expect(inspect.dataset.secondaryInspect).toBe('true');
 expect(button.contains(inspect)).toBe(false);
 expect(container.querySelector('button button')).toBeNull();
 fireEvent.pointerDown(inspect);fireEvent.click(inspect);
 expect(props.onInspect).toHaveBeenCalledExactlyOnceWith(card.assetPath,card.name,true);
 expect(props.onSelect).not.toHaveBeenCalled();expect(props.onPlaySkill).not.toHaveBeenCalled();
 fireEvent.click(button);expect(props.onSelect).toHaveBeenCalledExactlyOnceWith('touch-card',undefined);
});

it('技能离开手牌后保留原槽位，少于三张仍预留三个位置',()=>{
 const {props,rerender,container}=setup();
 const skills=props.player.skills.slice(0,3).map(skill=>({skill,assetPath:`skills/${skill.id}`,available:true}));
 expect(skills).toHaveLength(3);
 rerender(<FateHandSurface {...props} skills={skills}/>);
 const initial=Array.from(container.querySelectorAll('[data-skill-slot]')).map(slot=>slot.getAttribute('data-skill-slot'));
 const player={...props.player,selectedAttackIds:[skills[0].skill.id]};
 rerender(<FateHandSurface {...props} player={player} skills={skills}/>);
 const slots=Array.from(container.querySelectorAll('[data-skill-slot]'));
 expect(slots.map(slot=>slot.getAttribute('data-skill-slot'))).toEqual(initial);
 expect(slots[0].querySelector('.fd-runtime-card')).toBeNull();
 expect(slots[1].querySelector('.fd-runtime-card')).not.toBeNull();
 rerender(<FateHandSurface {...props} skills={skills.slice(0,1)}/>);
 expect(container.querySelectorAll('.fd-skill-slot')).toHaveLength(3);
});
