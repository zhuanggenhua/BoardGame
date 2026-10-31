import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FATE_TUTORIAL_PASSAGES, fateTutorialText } from '../tutorialText';
import { buildFateTutorialPlan } from '../tutorial';
import {FATE_TUTORIAL_LESSONS} from '../tutorialLessons';
import {FATE_ATTACK_BY_ID} from '../data';
import {FATE_TUTORIAL_MAP_PROTECTION} from '../ui/tutorialPresentation';

const normalize = (text:string) => text.replace(/\s+/g,'');
it('手牌课程始终保护实际卡牌、威力、身份和席位；地图关系课程另保护印刷读数',()=>{
    const steps=buildFateTutorialPlan('workshop').steps;
    const dark=steps.find(step=>step.fateCopy?.lessonId==='battlefieldDarkAttack')!;
    for(const selector of ['.fd-runtime-card','.fd-play-summary','.fd-self-dock','.fd-master-abilities','.fd-runtime-seat','.fd-runtime-map-card-hit','.fd-runtime-pawn'])expect(dark.avoidOverlapSelectors).toContain(selector);
    const movement=steps.find(step=>step.fateCopy?.lessonId==='movement')!;
    const source=steps.find(step=>step.fateCopy?.lessonId==='actionAbility')!;
    expect(FATE_TUTORIAL_MAP_PROTECTION.length).toBeGreaterThan(0);
    for(const selector of FATE_TUTORIAL_MAP_PROTECTION){
        expect(dark.avoidOverlapSelectors).not.toContain(selector);
        expect(movement.avoidOverlapSelectors).toContain(selector);
        expect(source.avoidOverlapSelectors).toContain(selector);
    }
});
it('中文规则摘句能逐项在指定CHM原文转写中找到，不能以改写文案冒充摘句',()=>{
    for(const [id,passage] of Object.entries(FATE_TUTORIAL_PASSAGES)){
        if(!passage.source.startsWith('intake/'))continue;
        const source=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'..',passage.source),'utf8');
        const raw='sourceQuote' in passage ? passage.sourceQuote : passage.quote;
        expect(normalize(source),id).toContain(normalize(raw));
        if('transcription' in passage)expect(normalize(passage.quote)).toBe(normalize(raw.replace(/\s*[（(][CDJK][）)]/g,'')));
    }
});

it('追加的普通攻击能力在移动选择前呈现实际卡文与目的地，不能按从者技能查成空白',()=>{
    const plan=buildFateTutorialPlan();
    const step=plan.steps.find(step=>step.fateCopy?.ability?.attackId==='cardSurveil');
    expect(step?.fateCommand?.type).toBe('PLAY_SKILL');
    expect(step?.fateCommand?.payload.targetLocationId).toBe('shinto');
    expect(step?.fateCopy?.passages).toContain('effectMovementCost');
    expect(step?.fateCopy?.passages).not.toContain('effectMovementEngagement');
    expect(step?.content).toContain(FATE_ATTACK_BY_ID.cardSurveil.desc);
    expect(step?.fateCopy?.input?.text).toContain('新都');
    expect(step?.hideOverlay).toBe(false);
});

it('每张可见课程来自登记摘句与必要功能说明，首课不要求选角，读卡只服务实际能力',()=>{
    const plan=buildFateTutorialPlan();
    expect(plan.steps[0].hiddenAutomation?.kind).toBe('setup-precondition');
    const visible=plan.steps.filter(step=>!step.hiddenAutomation);
    expect(visible[0].id).toBe('intro');
    expect(visible.some(step=>['SELECT_MASTER','SELECT_SERVANT'].includes(step.fateCommand?.type??''))).toBe(false);
    const reading=visible.filter(step=>step.id.startsWith('ui-detail'));
    expect(reading).toHaveLength(1);
    expect(reading[0].fateCopy?.lessonId).toBe('masterReading');
    expect(reading[0].fateUiDetailTarget).toBe('0');
    for(const step of visible){
        expect(step.fateCopy,step.id).toBeDefined();
        expect(step.fateCopy?.lessonId,step.id).toBeDefined();
        const goal=FATE_TUTORIAL_LESSONS[step.fateCopy!.lessonId!];
        expect(goal.goal&&goal.when&&goal.why,step.id).toBeTruthy();
        expect(step.content,step.id).toBe(fateTutorialText(step.fateCopy!));
        expect(step.content,step.id).not.toMatch(/上排|下排|右下|2\.5|宽限|本教程|已学过的重复|先选择御主/);
        if(step.fateCopy?.input)expect(step.fateCopy.input.owner,step.id).toBeTruthy();
    }
});

it('同一来源语义只在一个真实用途处教学，普通他席出牌不先替学员讲课',()=>{
    for(const branch of ['workshop','miyama','shinto'] as const){
        const plan=buildFateTutorialPlan(branch);
        const passages=plan.steps.flatMap(step=>step.fateCopy?.passages??[]);
        expect(new Set(passages).size,branch).toBe(passages.length);
        const firstAttack=plan.steps.find(step=>step.fateCopy?.passages.includes('attack'))!;
        expect(firstAttack.fateCommand?.type,branch).toBe('CONFIRM_ATTACK');
        const learnerAttacks=plan.steps.filter(step=>step.fateCommand?.type==='CONFIRM_ATTACK' && !(step.fateCommand.payload.faceDownIds as string[]).length);
        expect(learnerAttacks,branch).toHaveLength(1);
        expect(plan.steps.some(step=>step.id==='first-deployment-result'||step.id==='map-camera'),branch).toBe(false);
        const opening=plan.steps.find(step=>step.fateCommandOptions?.some(option=>option.type==='DEPLOY_MASTER'))!;
        expect(opening.fateDeploymentChoiceCopies?.miyama?.passages).toContain('terrain');
        expect(opening.fateDeploymentChoiceCopies?.shinto?.passages).toContain('terrain');
        if(branch!=='workshop')expect(plan.steps.filter(step=>step.fateCopy?.passages.includes('terrain'))).toHaveLength(0);
    }
});
