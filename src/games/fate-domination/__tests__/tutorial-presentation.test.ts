import { expect, it } from 'vitest';
import { DEFAULT_TUTORIAL_STATE } from '../../../engine/types';
import { FATE_TUTORIAL_TABLE_PROTECTION, presentFateTutorial } from '../ui/tutorialPresentation';
import { fateTutorialText, type FateTutorialCopy } from '../tutorialText';

const closed = { inspection:null,detail:null,seal:false,discard:false,deck:false,movement:false,movementTarget:false,identity:false };
const copy:FateTutorialCopy={passages:['masterDraw'],input:{text:'发动战略部署。',owner:'PLAY_SKILL'}};
const tutorial={...DEFAULT_TUTORIAL_STATE,active:true,step:{id:'play-master',fateCopy:copy,content:fateTutorialText(copy),highlightTarget:'fate-self',avoidOverlapSelectors:FATE_TUTORIAL_TABLE_PROTECTION}};
it('本人能力使用同一摘句，对手详情不显示本人的操作教学',()=>{
    const command={...tutorial,step:{...tutorial.step,fateCommand:{type:'PLAY_SKILL',payload:{skillId:'m_waver_s2:1'}}}};
    expect(presentFateTutorial(command,{...closed,detail:'1',viewerId:'0'}).step?.hideOverlay).toBe(true);
    const own=presentFateTutorial(command,{...closed,detail:'0',viewerId:'0'});
    expect(own.step?.hideOverlay).toBe(true);
    expect(own.step?.highlightTarget).toBeUndefined();
});
it('可选完整卡面检视隐藏教学浮层，返回后恢复同一规则步骤，不另写窗口布局说明',()=>{
    const inspection=presentFateTutorial(tutorial,{...closed,inspection:{name:'韦伯',source:'detail'}});
    expect(inspection.step?.hideOverlay).toBe(true);
    expect(inspection.step?.highlightTarget).toBeUndefined();
    expect(inspection.step?.id).toBe(tutorial.step.id);
    expect(presentFateTutorial(tutorial,closed).step?.content).toBe(tutorial.step.content);
});
it('令咒和弃牌面板独占当前决定，不在已选效果旁重复选择与确认',()=>{
    const seal={...tutorial,step:{...tutorial.step,fateCommand:{type:'USE_COMMAND_SPELL',payload:{effect:'mana'}}}};
    expect(presentFateTutorial(seal,{...closed,seal:true}).step?.hideOverlay).toBe(true);
    expect(presentFateTutorial(tutorial,{...closed,seal:true}).step?.hideOverlay).toBe(true);
    const discard={...tutorial,step:{...tutorial.step,id:'ui-pile-1'}};
    expect(presentFateTutorial(discard,{...closed,discard:true}).step?.hideOverlay).toBe(true);
    expect(presentFateTutorial(tutorial,{...closed,deck:true}).step?.hideOverlay).toBe(true);
    expect(presentFateTutorial(discard,{...closed,postBattle:true}).step?.hideOverlay).toBe(true);
    const publicCards={...tutorial,step:{...tutorial.step,id:'ui-public-cards-1'}};
    expect(presentFateTutorial(publicCards,{...closed,publicCards:true}).step?.hideOverlay).toBe(true);
    expect(presentFateTutorial(tutorial,{...closed,publicCards:true}).step?.hideOverlay).not.toBe(true);
});
it('移动选点前保留当前规则，选定后由正式确认承接，不追加按钮复述',()=>{
    const choosing=presentFateTutorial(tutorial,{...closed,movement:true});
    expect(choosing.step?.content).toBe(tutorial.step.content);
    const selected=presentFateTutorial(tutorial,{...closed,movement:true,movementTarget:true});
    expect(selected.step?.hideOverlay).toBe(true);
    expect(selected.step?.avoidOverlapSelectors).toContain('.fd-runtime-seat');
});
it('部署选定后让正式点位预览与确认承接，取消后恢复选点提示',()=>{
    const deployment={...tutorial,step:{...tutorial.step,fateCommand:{type:'DEPLOY_MASTER',payload:{locationId:'workshop',deploymentSlot:1}}}};
    expect(presentFateTutorial(deployment,{...closed,deploymentTarget:true}).step?.hideOverlay).toBe(true);
    expect(presentFateTutorial(deployment,{...closed,deploymentTarget:false}).step?.content).toBe(deployment.step.content);
});
it('首次改选战场时在正式确认前说明地利，取消后回到原选择且不增加教学步骤',()=>{
    const battlefieldCopy:FateTutorialCopy={lessonId:'battleDeployment',passages:['terrain']};
    const deployment={...tutorial,step:{...tutorial.step,fateCommand:{type:'DEPLOY_MASTER',payload:{locationId:'workshop',deploymentSlot:1}},fateDeploymentChoiceCopies:{miyama:battlefieldCopy,shinto:battlefieldCopy}}};
    const preview=presentFateTutorial(deployment,{...closed,deploymentTarget:true,deploymentLocation:'miyama'});
    expect(preview.step?.id).toBe(deployment.step.id);
    expect(preview.step?.highlightTarget).toBe('fate-deployment-selected');
    expect(preview.step?.content).toBe(fateTutorialText(battlefieldCopy));
    expect(preview.step?.hideOverlay).toBe(false);
    expect(presentFateTutorial(deployment,{...closed,deploymentTarget:false,deploymentLocation:null}).step?.content).toBe(deployment.step.content);
    expect(deployment.step.content).toBe(tutorial.step.content);
});
it('普通草稿和骑乘选择完成后由正式所选卡与确认承接，不再重复目标名单',()=>{
    const attack={...tutorial,step:{...tutorial.step,fateCommand:{type:'CONFIRM_ATTACK',payload:{}}}};
    expect(presentFateTutorial(attack,{...closed,attackStaged:true}).step?.hideOverlay).toBe(true);
    const riding={...tutorial,step:{...tutorial.step,fateCommand:{type:'SYS_INTERACTION_RESPOND',payload:{optionIds:['a','b','c']}}}};
    expect(presentFateTutorial(riding,{...closed,ridingSelectionCount:2}).step?.hideOverlay).not.toBe(true);
    expect(presentFateTutorial(riding,{...closed,ridingSelectionCount:3}).step?.hideOverlay).toBe(true);
});
