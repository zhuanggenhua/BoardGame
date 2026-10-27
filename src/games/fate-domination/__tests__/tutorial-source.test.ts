import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FATE_TUTORIAL_PASSAGES, fateTutorialText } from '../tutorialText';
import { buildFateTutorialPlan } from '../tutorial';
import {FATE_TUTORIAL_LESSONS} from '../tutorialLessons';

const normalize = (text:string) => text.replace(/\s+/g,'');
it('中文规则摘句能逐项在指定CHM原文转写中找到，不能以改写文案冒充摘句',()=>{
    for(const [id,passage] of Object.entries(FATE_TUTORIAL_PASSAGES)){
        if(!passage.source.startsWith('intake/'))continue;
        const source=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'..',passage.source),'utf8');
        const raw='sourceQuote' in passage ? passage.sourceQuote : passage.quote;
        expect(normalize(source),id).toContain(normalize(raw));
        if('transcription' in passage)expect(normalize(passage.quote)).toBe(normalize(raw.replace(/\s*[（(][CDJK][）)]/g,'')));
    }
});

it('每张可见课程来自登记摘句与必要功能说明，首课不要求选角，也不强制参观详情窗口',()=>{
    const plan=buildFateTutorialPlan();
    expect(plan.steps[0].hiddenAutomation?.kind).toBe('setup-precondition');
    const visible=plan.steps.filter(step=>!step.hiddenAutomation);
    expect(visible[0].id).toBe('intro');
    expect(visible.some(step=>['SELECT_MASTER','SELECT_SERVANT'].includes(step.fateCommand?.type??''))).toBe(false);
    expect(visible.some(step=>step.id.startsWith('ui-detail'))).toBe(false);
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
