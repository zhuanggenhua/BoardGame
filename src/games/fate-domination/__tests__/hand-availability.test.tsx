import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {createReplayAdapter} from '../../../engine/adapter';
import {FateDominationDomain} from '../domain';
import {FATE_ATTACK_CARDS} from '../data';
import {FateHandSurface} from '../ui/FateHandSurface';

vi.mock('../../../components/common/media/OptimizedImage',()=>({OptimizedImage:({alt}:{alt:string})=><span>{alt}</span>}));
vi.mock('../../../components/common/media/CardPreview',()=>({CardPreview:({title}:{title:string})=><span>{title}</span>}));

it('已打出且仍能发动的普通牌显示可用；进入骑乘后不能再提示或发动该能力',()=>{
 const player=createReplayAdapter(FateDominationDomain,'available-card').setup(['0','1','2']).core.players['0'];
 const card=FATE_ATTACK_CARDS[0];player.hand=[{id:'active-card',definitionId:card.id}];player.activeAttackIds=['active-card'];
 const activate=vi.fn();
 const props={player,power:0,skills:[],canSelect:false,onSelect:vi.fn(),onPlaySkill:activate,canPlayAbility:()=>true,onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props}/>);
 const button=screen.getByRole('button',{name:`发动 ${card.name}`});
 expect(button.classList.contains('is-available')).toBe(true);
 fireEvent.click(button);expect(activate).toHaveBeenCalledExactlyOnceWith('active-card');activate.mockClear();
 view.rerender(<FateHandSurface {...props} ridingChoice={{interactionId:'riding',round:1,candidateIds:[],onConfirm:vi.fn(),onCancel:vi.fn()}}/>);
 expect(button.classList.contains('is-available')).toBe(false);fireEvent.click(button);expect(activate).not.toHaveBeenCalled();
});

it('普通选牌时所有可用技能都保留可用标记，骑乘独立选牌时一起取消该标记',()=>{
 const player=createReplayAdapter(FateDominationDomain,'available-skills').setup(['0','1','2']).core.players['0'];
 const skills=player.skills.map(skill=>({skill,assetPath:'skills/'+skill.id,available:true}));
 const select=vi.fn();
 const props={player,power:0,skills,canSelect:true,onSelect:select,onPlaySkill:vi.fn(),onInspect:vi.fn()};
 const view=render(<FateHandSurface {...props}/>);
 for(const {skill} of skills)expect(screen.getByRole('button',{name:`选择 ${skill.name}`} ).classList.contains('is-available')).toBe(true);
 view.rerender(<FateHandSurface {...props} ridingChoice={{interactionId:'riding',round:1,candidateIds:[],onConfirm:vi.fn(),onCancel:vi.fn()}}/>);
 for(const {skill} of skills){const button=screen.getByRole('button',{name:`选择 ${skill.name}`});expect(button.classList.contains('is-available')).toBe(false);fireEvent.click(button);}
 expect(select).not.toHaveBeenCalled();
});
