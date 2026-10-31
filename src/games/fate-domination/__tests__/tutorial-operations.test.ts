import {expect,it} from 'vitest';
import {buildFateTutorialPlan} from '../tutorial';
import {presentFateTutorial} from '../ui/tutorialPresentation';
import {DEFAULT_TUTORIAL_STATE} from '../../../engine/types';

it('第一次读御主资料服务紧随其后的能力使用，不能插入已经开始的移动',()=>{
 const {steps}=buildFateTutorialPlan();
 const reading=steps.findIndex(step=>step.fateCopy?.lessonId==='masterReading');
 const ability=steps.findIndex(step=>step.fateCommand?.type==='PLAY_SKILL'&&step.fateCopy?.ability?.masterId==='m_waver');
 const movement=steps.findIndex(step=>step.fateCommand?.type==='MOVE_PLAYER');
 expect(reading).toBeGreaterThan(-1);
 expect(reading).toBeLessThan(ability);
 expect(ability).toBeLessThan(movement);
 expect(steps[reading].fateUiDetailTarget).toBe('0');
 expect(steps[reading].highlightTarget).toBe('fate-self-avatar');
 expect(steps[reading].fateCopy?.input?.owner).toBe('FateSelfDock');
 expect(steps.slice(movement,steps.findIndex((s,i)=>i>movement&&s.fateCommand?.type==='CONFIRM_ATTACK')).some(s=>s.id.startsWith('ui-detail'))).toBe(false);
});

it('开始移动后焦点交给本次目的地，选定后仍等待正式确认',()=>{
 const step=buildFateTutorialPlan().steps.find(s=>s.fateCommand?.type==='MOVE_PLAYER')!;
 const tutorial={...DEFAULT_TUTORIAL_STATE,active:true,step};
 const closed={inspection:null,detail:null,seal:false,discard:false,movement:false,movementTarget:false,identity:false};
 expect(presentFateTutorial(tutorial,closed).step?.highlightTarget).toBe('fate-pawn-0');
 const choosing=presentFateTutorial(tutorial,{...closed,movement:true});
 expect(choosing.step?.highlightTarget).toBe('fate-location-'+step.fateCommand?.payload.locationId);
 expect(choosing.step?.id).toBe(step.id);
 expect(presentFateTutorial(tutorial,{...closed,movement:true,movementTarget:true}).step?.hideOverlay).toBe(true);
 expect(tutorial.step).toBe(step);
});

it('本人实操急行后，对手再次使用同一卡面不重复停下来讲效果',()=>{
 const {steps}=buildFateTutorialPlan();
 const lessons=steps.filter(s=>!s.hiddenAutomation&&s.fateCopy?.ability?.attackId==='cardSurveil');
 expect(lessons).toHaveLength(1);
 expect(lessons[0].fateCommand?.type).toBe('PLAY_SKILL');
});
