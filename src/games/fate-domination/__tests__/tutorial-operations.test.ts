import {expect,it} from 'vitest';
import {buildFateTutorialPlan} from '../tutorial';
import {presentFateTutorial} from '../ui/tutorialPresentation';
import {DEFAULT_TUTORIAL_STATE} from '../../../engine/types';

it('收牌后查看弃牌堆时明确实际入口，不让学员从清理规则猜点击动作',()=>{
 const step=buildFateTutorialPlan().steps.find(s=>s.id.startsWith('ui-pile'))!;
 expect(step.highlightTarget).toBe('fate-self-discard');
 expect(step.highlightFrame).not.toBe('none');
 expect(step.fateCopy?.input?.text).toBe('点击弃牌堆查看本轮收回的普通攻击牌。');
 expect(step.fateCopy?.input?.owner).toBe('FateSelfDock');
});

it('首屏不提前介绍他席，首次能力直接在真实按钮实操，不强制巡游详情',()=>{
 const {steps}=buildFateTutorialPlan();
 const intro=steps.find(step=>step.id==='intro')!;
 expect(intro.content).not.toMatch(/玩家2|玩家3|电脑控制/);
 expect(steps.some(step=>step.id.startsWith('ui-detail'))).toBe(false);
 const ability=steps.find(step=>step.fateCommand?.type==='PLAY_SKILL'&&step.fateCopy?.ability?.masterId==='m_waver')!;
 expect(ability.highlightTarget).toContain('fate-master-ability-');
 expect(ability.fateCopy?.input?.owner).toBe('PLAY_SKILL');
 expect(ability.fateCopy?.passages).toContain('outpostAbility');
 const tutorial={...DEFAULT_TUTORIAL_STATE,active:true,step:ability};
 const shown=presentFateTutorial(tutorial,{inspection:null,detail:null,seal:false,discard:false,movement:false,movementTarget:false,identity:false,masterAbilityTip:true});
 expect(shown.step?.hideOverlay).not.toBe(true);
 expect(shown.step?.content).toBe(ability.content);
});

it('开始移动后焦点交给本次目的地，目的地点选即执行',()=>{
 const step=buildFateTutorialPlan().steps.find(s=>s.fateCommand?.type==='MOVE_PLAYER')!;
 const tutorial={...DEFAULT_TUTORIAL_STATE,active:true,step};
 const closed={inspection:null,detail:null,seal:false,discard:false,movement:false,movementTarget:false,identity:false};
 expect(presentFateTutorial(tutorial,closed).step?.highlightTarget).toBe('fate-pawn-0');
 const choosing=presentFateTutorial(tutorial,{...closed,movement:true});
 expect(choosing.step?.highlightTarget).toBe('fate-location-'+step.fateCommand?.payload.locationId);
 expect(choosing.step?.id).toBe(step.id);
 expect(tutorial.step).toBe(step);
});

it('本人实操急行后，对手再次使用同一卡面不重复停下来讲效果',()=>{
 const {steps}=buildFateTutorialPlan();
 const lessons=steps.filter(s=>!s.hiddenAutomation&&s.fateCopy?.ability?.attackId==='cardSurveil');
 expect(lessons).toHaveLength(1);
 expect(lessons[0].fateCommand?.type).toBe('PLAY_SKILL');
});
