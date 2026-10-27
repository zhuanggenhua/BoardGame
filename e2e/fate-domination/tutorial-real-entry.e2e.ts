import {createEvidenceScreenshotRun,promoteEvidenceScreenshotRun} from '../framework/evidenceScreenshots';
import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {initContext,attachPageDiagnostics,assertNoFatalFrontendErrors} from '../helpers/common';
import {chooseFateIdentity} from './identitySelection';
import {assertFateHandCardsUnclipped} from './handVisibility';

test.use({viewport:{width:1920,height:1080}});
type State={core:any;sys:any};
async function state(page:Page):Promise<State>{return page.evaluate(()=>{const s=(window as any).__BG_TEST_HARNESS__.state.get();return {core:s.core,sys:{tutorial:{active:s.sys.tutorial.active,step:s.sys.tutorial.step,aiActions:s.sys.tutorial.aiActions,stepIndex:s.sys.tutorial.stepIndex},undo:{rollbackRevision:s.sys.undo.rollbackRevision},interaction:{current:s.sys.interaction.current},gameover:s.sys.gameover}};});}
async function waitStep(page:Page,id:string){await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id,{timeout:20000}).not.toBe(id);}
const quoted=(id:string)=>'[data-card-id='+JSON.stringify(id)+'],[data-focus-card='+JSON.stringify('skill-0-'+id)+']';
const primary=(page:Page)=>page.getByTestId('fate-domination-primary-action');
const closeInspection=(page:Page)=>page.getByTestId('fate-inspection-close').click();
function fateSourceRevision(){
 const hash=createHash('sha256');
 for(const file of readdirSync('src/games/fate-domination',{recursive:true}).map(String).filter(file=>/\.(tsx?|css)$/.test(file)&&!file.includes('__tests__')).sort()){
  hash.update(file);hash.update(readFileSync(path.join('src/games/fate-domination',file)));
 }
 for(const file of ['src/hooks/ui/useTouchLongPress.ts','src/engine/types.ts','src/components/tutorial/TutorialOverlay.tsx']){hash.update(file);hash.update(readFileSync(file));}
 return 'tree-sha256:'+hash.digest('hex');
}
async function snapshot(page:Page,current?:State){
 const s=current??await state(page);
 const visible=await page.evaluate(()=>({tutorialText:document.querySelector('[data-testid="tutorial-overlay-card"]')?.textContent??null,primaryLabel:document.querySelector('[data-testid="fate-domination-primary-action"]')?.textContent??null,dialogCount:document.querySelectorAll('[role="dialog"]').length,inspectionVisible:Boolean(document.querySelector('[data-testid="fate-runtime-inspection"]')),gameOver:Boolean(document.querySelector('[aria-label="圣杯战争结果"]')),identityVisible:Boolean(document.querySelector('.fd-identity-setup')),opponentPowers:Array.from(document.querySelectorAll('.fd-seat-power')).map(node=>node.textContent),mapStatus:document.querySelector('[data-testid="fate-pixi-map-canvas-host"]')?.getAttribute('data-map-resource-status')??null}));
 return {visible,authoritative:{round:s.core.round,phase:s.core.phase,current:s.core.currentPlayerId,gameOver:Boolean(s.sys.gameover),tutorialActive:s.sys.tutorial.active,tutorialStep:s.sys.tutorial.step?.id??null}};
}
async function readyImages(page:Page,selector:string){
 await expect.poll(()=>page.locator(selector).evaluateAll(nodes=>nodes.length>0&&nodes.every(node=>{const image=node as HTMLImageElement;return image.complete&&image.naturalWidth>0;})),{timeout:30000}).toBe(true);
}
async function resume(page:Page,id:string,core:unknown){
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'从上次继续',exact:true}).click({timeout:30000});
 await page.waitForFunction(()=>(window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.(),undefined,{timeout:30000});
 await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe(id);
 expect((await state(page)).core).toEqual(core);
}

test('Fate 正式教程：真实开局、所有学员命令、自动他席、恢复与终局',async({page,context,baseURL},testInfo)=>{
 test.setTimeout(600000);page.setDefaultTimeout(15000);
 await initContext(context,{skipImageGate:false,skipTutorial:false});
 const diagnostics=attachPageDiagnostics(page),run=await createEvidenceScreenshotRun(testInfo,{requireChineseName:true}),directory=run.stagingDir;
 await mkdir(directory,{recursive:true});
 const sourceRevision=fateSourceRevision(),trace:any[]=[],media:any[]=[],seen=new Set<string>();
 // 教学提示与其后真实结果都必须进入相册；同类重复牌名只由行为轨迹证明。
 const lessonCaptures:Record<string,string>={
  'play-5':'准备阶段首次补牌规则', 'play-9':'本人御主能力与前哨抽牌', 'play-10':'前哨阶段交还与轮序', 'play-11':'对手首次战场地利',
  'play-15':'行动阶段先移动及前往战场的目的', 'ui-inspection-14':'首次识别攻击牌费用威力与时机',
  'play-16':'使用令咒前的技能出牌魔力门槛', 'play-17':'首次普通牌与技能混合出牌规则',
  'play-18':'已激活骑乘的行动能力', 'play-19':'骑乘追加攻击的本次选择', 'play-22':'对手强化令咒公开效果',
  'ui-public-cards-26':'公开威力与查看对手出牌入口', 'play-27':'战斗阶段结束后进行战力结算', 'play-30':'实际战力结算的组成',
  'round-return-observe':'本回合结束后牌的去向', 'ui-pile-36':'弃牌堆查看权限', 'play-120':'对手真实御主的战斗能力',
  'revelation-observe':'真实从者揭示及技能公开', 'play-140':'对手暗置攻击的规则', 'play-199':'战场事件的令咒恢复选择',
 };
 const existingLessons=new Set(['intro','play-8','first-deployment-result','map-camera','elimination-observe']);
 const repeatedLessons=new Set(['play-40','play-47','play-189','play-255']);
 const modalLessons=new Set(['play-199']);
 const screenshotStates=new Set(['intro','deployment-candidates','deployment-selected','deployment-landed','detail','detail-inspection','inspection-constrained','opponent-detail-hidden','deck-count','discard','seal-cancel','seal-mana','movement-cancel','draft','riding','public-cards','opponent-detail-revealed','eliminated-observer','eliminated-detail','post-battle','terminal','after-completion','identity-constrained','identity-tokiomi',...Object.keys(lessonCaptures).map(id=>'lesson-'+id)]);
 const observedLessons=new Set<string>();
 const capture=async(key:string,name:string)=>{
  if(!screenshotStates.has(key)||seen.has(key))return;
  if(await page.locator('.fd-identity-setup').isVisible())await readyImages(page,'.fd-identity-setup img');
  else await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status','ready');
  if(await page.getByTestId('fate-runtime-inspection').isVisible())await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
  if(await page.locator('.fd-player-detail').isVisible())await expect(page.locator('.fd-player-detail')).not.toContainText('当前威力');
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  if(!modalLessons.has(key.slice(7))&&await page.getByTestId('tutorial-overlay-card').isVisible()){
   const collisions=()=>page.evaluate(()=>{
    const overlay=document.querySelector('[data-testid="tutorial-overlay-card"]');if(!overlay)return ['教程提示不可见'];
    const a=overlay.getBoundingClientRect();
    return Array.from(document.querySelectorAll('.fd-runtime-card,.fd-self-piles,.fd-event-deck-count,.fd-runtime-map-card-hit,.fd-runtime-pawn')).flatMap(element=>{
     const style=getComputedStyle(element);if(style.visibility==='hidden'||style.display==='none')return [];
     const b=element.getBoundingClientRect(),clip=element.closest('.fd-runtime-card-row')?.getBoundingClientRect();
     const left=Math.max(b.left,clip?.left??0,0),right=Math.min(b.right,clip?.right??innerWidth,innerWidth),top=Math.max(b.top,clip?.top??0,0),bottom=Math.min(b.bottom,clip?.bottom??innerHeight,innerHeight);
     return right>left&&bottom>top&&a.left<right&&a.right>left&&a.top<bottom&&a.bottom>top?[element.getAttribute('aria-label')??element.className]:[];
    });
   });
   await expect.poll(collisions,{message:`教学提示遮挡玩家对象：${key}`,timeout:5000}).toEqual([]);
  }
  if(['draft','riding','movement-cancel'].includes(key))await assertFateHandCardsUnclipped(page);
  const file=path.join(directory,String(media.length+1).padStart(2,'0')+'-'+name+'.png');
  await page.screenshot({path:file,animations:'disabled'});
  seen.add(key);
  const current=await snapshot(page),stepId='capture-'+key;
  trace.push({id:stepId,action:name,before:current,after:current,assertions:[{name:'current-formal-reading-surface-visible',actual:true,expected:true}]});
  media.push({key,path:file,stepId,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),description:name});
 };
 await page.goto(baseURL+'/play/fate-domination/tutorial',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>(window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.(),undefined,{timeout:30000});
 await expect(page.getByTestId('tutorial-overlay-card')).toBeVisible({timeout:30000});
 await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe('intro');
 await expect(page.locator('.fd-identity-setup')).toHaveCount(0);
 expect((await state(page)).core.players['0'].masterId).toBe('m_waver');
 expect((await state(page)).core.players['0'].servantId).toBe('servant-rider');
 await expect(page.locator('.fd-runtime-pawn')).toHaveCount(0);
 await capture('intro','固定身份进入规则课程，未部署且不出现选角');
 let refreshed=false,branched=false,retracted=false,backtracked=false,lateRefreshed=false;
 const optionalDetail=async(playerId:string,key:string,name:string)=>{
  await page.getByRole('button',{name:new RegExp('查看玩家\\s*'+(Number(playerId)+1)+'详情')}).click();
  await expect(page.locator('.fd-player-detail')).toBeVisible();
  await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
  await capture(key,name);
 };
 for(let iteration=0;iteration<700;iteration++){
  const before=await state(page),step=before.sys.tutorial.step,beforeSnapshot=await snapshot(page,before);
  if(!before.sys.tutorial.active&&before.sys.gameover)break;
  if(!step)throw Error('教程提前结束');
  console.log('[Fate教程步骤]',step.id,step.fateCommand?.type??'',step.aiActions?.length??0);
  await expect(page.getByTestId('tutorial-action-hint')).toHaveCount(0);
  expect(step.content).not.toMatch(/上排|下排|右下|2\.5|宽限|本教程|已学过的重复|先选择御主/);
  if(step.aiActions?.length||before.sys.tutorial.aiActions?.length){
   await expect.poll(async()=>{const s=await state(page);return s.sys.tutorial.step?.id!==step.id||(!s.sys.tutorial.step?.aiActions?.length&&!s.sys.tutorial.aiActions?.length);},{timeout:20000}).toBe(true);
   trace.push({id:step.id+'-automatic',action:'其他席正式行动或已教同类动作',before:beforeSnapshot,after:await snapshot(page),automatic:true,assertions:[{name:'authored-automation-consumed',actual:true,expected:true}]});
   continue;
  }
  if(modalLessons.has(step.id))observedLessons.add(step.id);
  if(beforeSnapshot.visible.tutorialText){
   const isCovered=Boolean(lessonCaptures[step.id])||existingLessons.has(step.id)||repeatedLessons.has(step.id);
   expect(isCovered,`未分类的可见教程步骤：${step.id}`).toBe(true);
   observedLessons.add(step.id);
   if(['play-22','play-30','play-120'].includes(step.id))await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
   if(step.id==='play-140'){
    expect(before.core.players['1'].locationId).toBe('miyama');
    await expect(page.getByTestId('tutorial-overlay-card')).toContainText('若你位于战场');
    await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('若你不位于战场');
   }
   if(lessonCaptures[step.id]&&!modalLessons.has(step.id))await capture('lesson-'+step.id,lessonCaptures[step.id]);
  }
  if(step.id==='map-camera'){
   if(!refreshed){await resume(page,step.id,before.core);refreshed=true;}
   await page.mouse.move(920,410);await page.mouse.down();await page.mouse.move(990,430,{steps:8});await page.mouse.up();await page.mouse.wheel(0,-160);
   await page.getByRole('button',{name:'复位',exact:true}).click();
   await optionalDetail('0','detail','可选本人详情保留身份、能力与令咒，不显示临时威力');
   await page.getByRole('button',{name:'检视御主能力',exact:true}).click();
   await capture('detail-inspection','完整卡面阅读时不保留底层教学窗口');
   await page.setViewportSize({width:936,height:432});
   await capture('inspection-constrained','受限横屏完整检视与关闭入口');
   await page.setViewportSize({width:1920,height:1080});await closeInspection(page);
   await page.getByRole('button',{name:/切换到玩家2/}).click();
   await capture('opponent-detail-hidden','可选对手详情保持从者及技能隐藏');
   await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();
   await page.locator('.fd-runtime-map-card-hit').first().click();await closeInspection(page);
   const deck=page.getByRole('button',{name:/抽牌堆 \d+ 张/});await deck.click();await capture('deck-count','牌堆计数与一级资源威力同帧可读');await deck.click();
   await page.getByTestId('tutorial-next-button').click();
  }else if(step.id.startsWith('ui-inspection')){
   const card=page.getByRole('button',{name:'选择 骑乘',exact:true});await card.scrollIntoViewIfNeeded();
   const box=await card.boundingBox();expect(box).toBeTruthy();
   await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2,{button:'right'});
   await expect(page.getByTestId('fate-runtime-inspection')).toBeVisible();
   await closeInspection(page);
  }else if(step.id.startsWith('ui-pile')){
   await page.getByRole('button',{name:/弃牌堆 \d+ 张/}).click();
   const discard=page.getByRole('dialog',{name:/弃牌/});await expect(discard).toBeVisible();await capture('discard','回合收牌后检视弃牌堆，只说明当前查看动作');
   await discard.getByRole('button',{name:/检视/}).first().click();await closeInspection(page);
   await page.getByRole('button',{name:/关闭弃牌/}).click();
  }else if(step.id.startsWith('ui-public-cards')){
   for(const id of before.core.playerIds.filter((id:string)=>id!=='0')){
    const power=before.core.players[id].publicView?.power;
    await expect(page.getByLabel('玩家 '+(Number(id)+1)+'合计威力')).toBeVisible();
    if(power!==undefined)await expect(page.getByLabel('玩家 '+(Number(id)+1)+'合计威力')).toContainText(String(power));
   }
   await page.getByRole('button',{name:/查看玩家\s*2详情/}).hover();
   const row=page.getByLabel('玩家 2已打出');await expect(row).toBeVisible();await row.hover();await page.waitForTimeout(2700);await expect(row).toBeVisible();
   await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
   await capture('public-cards','对手一级威力与无框单排出牌同时可比较');
   await row.getByRole('button').first().click();await closeInspection(page);await row.hover();
   await page.mouse.move(8,8);await expect(row).toBeHidden({timeout:4000});
  }else if(step.id==='revelation-observe'){
   const peer=Object.values(before.core.players).find((player:any)=>player.id!=='0'&&player.isRevealed) as any;
   expect(peer).toBeTruthy();
   await expect(page.getByTestId('tutorial-overlay-card')).toContainText('玩家 '+(Number(peer.id)+1));
   await optionalDetail(peer.id,'opponent-detail-revealed','已揭示对手的静态身份与技能可检视');
   await page.getByRole('button',{name:'检视从者',exact:true}).click();await closeInspection(page);
   await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();await page.getByTestId('tutorial-next-button').click();
  }else if(step.fateCommand){
   const {type,payload}=step.fateCommand;
   expect(['SELECT_MASTER','SELECT_SERVANT']).not.toContain(type);
   if(type==='DEPLOY_MASTER'){
    const point=page.getByTestId('fate-domination-location-'+payload.locationId);
    if(!seen.has('deployment-candidates')){
     await expect(page.locator('.fd-runtime-pawn')).toHaveCount(0);
     await capture('deployment-candidates','前哨合法部署点位与印刷收益可见');
     const revision=before.sys.undo.rollbackRevision??0;
     await page.getByTestId('fate-domination-location-miyama').click();await primary(page).click();
     await expect.poll(async()=>(await state(page)).sys.undo.rollbackRevision??0).toBe(revision+1);
     expect((await state(page)).core).toEqual(before.core);branched=true;
    }
    await point.click();expect((await state(page)).core.players['0'].locationId).toBeNull();
    if(!seen.has('deployment-selected')){
     await expect(page.locator('.fd-runtime-deployment-slot:not(:disabled)')).toHaveCount(3);
     for(const locationId of ['miyama','shinto']){
      const alternative=page.getByTestId('fate-domination-location-'+locationId);
      await expect(alternative).toBeVisible();await expect(alternative).toBeEnabled();
      await alternative.click();await expect(alternative).toHaveAttribute('aria-pressed','true');
      expect((await state(page)).core).toEqual(before.core);
     }
     await point.click();
    }
    await expect(point).toHaveAttribute('aria-pressed','true');await capture('deployment-selected','选中点位仍未提交，可取消和改选');
    await page.getByRole('button',{name:'取消部署',exact:true}).click();expect((await state(page)).core.players['0'].locationId).toBeNull();
    await point.click();await primary(page).click();
    await expect(page.getByRole('button',{name:/玩家1位于/})).toBeVisible();await capture('deployment-landed','确认后棋子才落位，保留部署后能力窗口');
   }else if(type==='CONFIRM_ATTACK'){
    for(const id of payload.cardIds){const mode=page.getByRole('button',{name:'暗置选牌',exact:true});if((await mode.getAttribute('aria-pressed')==='true')!==payload.faceDownIds.includes(id))await mode.click();await page.locator(quoted(id)).click();}
    expect((await state(page)).core.players['0'].selectedAttackIds).toEqual([]);
    if(!retracted){await page.locator(quoted(payload.cardIds[0])).click();await page.locator(quoted(payload.cardIds[0])).click();retracted=true;}
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
    await capture('draft','两张草稿及一级预计威力，确认前可撤回');await primary(page).click();
   }else if(type==='PLAY_SKILL'){
    const master=before.core.players['0'].skills.find((skill:any)=>skill.id===payload.skillId&&skill.isMasterSkill);
    if(master){
     await page.getByRole('button',{name:/查看玩家\s*1详情/}).click();
     await page.getByRole('button',{name:/切换到玩家2/}).click();await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
     await page.getByRole('button',{name:/切换到玩家1/}).click();await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);await expect(page.getByLabel('御主能力说明')).toContainText('你能支付1魔力来抽2张牌。');
     await page.getByRole('button',{name:'发动'+master.name,exact:true}).click();
    }else await page.locator(quoted(payload.skillId)).click();
    if(payload.targetLocationId){await page.getByTestId('fate-domination-location-'+payload.targetLocationId).click();await primary(page).click();}
   }else if(type==='MOVE_PLAYER'){
    if(!seen.has('movement-cancel')){
     expect(before.core.phase).toBe('action');
     expect(before.core.players['0'].locationId).toBe('workshop');
     expect(payload.locationId).toBe('miyama');
     await expect(page.getByTestId('tutorial-overlay-card')).toContainText('1.进行常规移动');
     await expect(page.getByTestId('tutorial-overlay-card')).toContainText('深山町争夺事件战果');
    }
    await page.getByRole('button',{name:/玩家1位于/}).click();await page.getByTestId('fate-domination-location-'+payload.locationId).click();
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
    if(!seen.has('movement-cancel')){
     await capture('movement-cancel','移动目标与确认分开，取消不支付');
     await page.getByRole('button',{name:'取消移动',exact:true}).click();expect((await state(page)).core.players['0'].mana).toBe(before.core.players['0'].mana);
     await page.getByRole('button',{name:/玩家1位于/}).click();await page.getByTestId('fate-domination-location-'+payload.locationId).click();
    }
    await primary(page).click();
   }else if(type==='USE_COMMAND_SPELL'){
    await page.getByRole('button',{name:'使用令咒',exact:true}).click();
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
    if(!seen.has('seal-cancel')){
     await expect(page.getByRole('button',{name:'确认使用',exact:true})).toBeDisabled();await capture('seal-cancel','令咒未选效果时不能提交');
     await page.getByRole('button',{name:'关闭令咒选择'}).click();expect((await state(page)).core.players['0'].commandSpells).toBe(before.core.players['0'].commandSpells);
     await page.getByRole('button',{name:'使用令咒',exact:true}).click();
    }
    await page.getByRole('button',{name:payload.effect==='mana'?/恢复魔力/:payload.effect==='battle'?/强化战斗/:/令咒移动/}).click();
    if(payload.effect==='move'){await page.getByTestId('fate-domination-location-'+payload.targetLocationId).click();await primary(page).click();}
    else{await capture('seal-'+payload.effect,'令咒选择效果后明确确认');await page.getByRole('button',{name:'确认使用',exact:true}).click();}
   }else if(type==='SYS_INTERACTION_CANCEL')await page.getByTestId('fate-riding-cancel').click();
   else if(type==='SYS_INTERACTION_RESPOND'){
    if(payload.optionIds){for(const id of payload.optionIds)await page.locator(quoted(id)).click();await capture('riding','骑乘候选卡面完整，轻描边区分选择与实付费用');await page.getByTestId('fate-riding-confirm').click();}
    else{
     if(!lateRefreshed){await resume(page,step.id,before.core);lateRefreshed=true;}
     await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
     await capture('lesson-'+step.id,lessonCaptures[step.id]);
     await page.getByRole('button',{name:payload.optionId==='restore'?'恢复一枚令咒':'不恢复',exact:true}).click();
     await capture('post-battle','自然战后恢复或不恢复，选择后确认');await page.getByRole('button',{name:/确认选择/}).click();
    }
   }else await primary(page).click();
  }else{
   if(step.id==='elimination-observe'){
    await expect(page.locator('.fd-avatar-elimination')).not.toHaveCount(0);
    await capture('eliminated-observer','淘汰状态在头像上显示红色斜杠，其余玩家继续');
    const eliminated=Object.values(before.core.players).find((player:any)=>player.eliminated) as any;
    await optionalDetail(eliminated.id,'eliminated-detail','淘汰详情保留静态身份，不显示临时威力');
    await page.getByRole('button',{name:'检视御主能力',exact:true}).click();await closeInspection(page);
    await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();
   }
   await page.getByTestId('tutorial-next-button').click();
  }
  await waitStep(page,step.id);
  let after=await state(page);
  if(!backtracked&&step.fateCommand?.type==='ADVANCE_PHASE'&&before.core.round===1&&before.core.phase==='preparation'){
   const once=after.core;
   await page.getByTestId('tutorial-previous-button').click();
   await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe(step.id);
   expect((await state(page)).core).toEqual(before.core);
   await primary(page).click();await waitStep(page,step.id);after=await state(page);
   expect(after.core).toEqual(once);backtracked=true;
  }
  trace.push({id:step.id,action:step.fateCommand?.type??step.id,before:beforeSnapshot,after:await snapshot(page,after),assertions:[{name:'current-rule-step-completed',actual:after.sys.tutorial.step?.id!==step.id,expected:true}]});
 }
 const terminal=await state(page);
 for(const id of [...Object.keys(lessonCaptures),...existingLessons,...repeatedLessons])expect(observedLessons.has(id),`未走到教程步骤：${id}`).toBe(true);
 for(const id of Object.keys(lessonCaptures))expect(seen.has('lesson-'+id),`缺少对应教学画面：${id}`).toBe(true);
 expect(terminal.sys.tutorial.active).toBe(false);expect(terminal.sys.gameover).toBeTruthy();
 await expect(page.getByRole('region',{name:'圣杯战争结果'})).toBeVisible();
 expect({refreshed,branched,retracted,backtracked,lateRefreshed}).toEqual({refreshed:true,branched:true,retracted:true,backtracked:true,lateRefreshed:true});
 await capture('terminal','自然十一轮终局与结果');
 const beforeCompletion=await snapshot(page);
 await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
 await page.getByTestId('rematch-play-again').click();await expect(page.getByRole('region',{name:'选择御主与从者'})).toBeVisible();
 expect((await state(page)).sys.tutorial.active).toBe(false);
 await expect(page.getByRole('combobox')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
 await chooseFateIdentity(page,'master','m_rin');await expect.poll(async()=>(await state(page)).core.players['0'].masterId).toBe('m_rin');
 const rinChoice=(await state(page)).core;
 await expect(page.getByLabel('御主关联组件')).toBeVisible();await expect(page.getByLabel('从者技能牌')).toHaveCount(0);
 await page.getByTestId('fate-identity-reference-gandr-shot').click();await expect(page.getByRole('button',{name:'放大阴炁弹',exact:true})).toBeVisible();
 expect((await state(page)).core).toEqual(rinChoice);
 await page.getByTestId('fate-identity-reference-gems').click();await page.getByRole('button',{name:'查看牌背',exact:true}).click();
 await expect(page.getByRole('button',{name:'放大宝石牌背',exact:true})).toBeVisible();expect((await state(page)).core).toEqual(rinChoice);
 await page.getByRole('button',{name:'查看正面',exact:true}).click();await capture('after-completion','凛的宝石、关联攻击与升华原卡同页，阅读不改变选择');
 await chooseFateIdentity(page,'master','m_kayneth');await expect(page.getByTestId('fate-identity-references')).toHaveAttribute('data-master-id','m_kayneth');
 await expect(page.locator('[data-reference-kind="independent-deck"]')).toHaveCount(3);await expect(page.getByRole('button',{name:'放大肯尼斯',exact:true})).toBeVisible();
 await page.setViewportSize({width:1366,height:768});
 const kaynethChoice=(await state(page)).core;
 await page.getByTestId('fate-identity-reference-fluid-dynamics').click();
 await expect(page.getByRole('button',{name:'放大流体力学',exact:true})).toBeVisible();
 expect((await state(page)).core).toEqual(kaynethChoice);
 await capture('identity-constrained','受限桌面滚至肯尼斯末张关联卡并阅读，候选及确认仍可达');await page.setViewportSize({width:1920,height:1080});
 await chooseFateIdentity(page,'master','m_tokiomi');await expect(page.locator('[data-reference-kind="item"]')).toHaveCount(4);
 await expect(page.locator('[data-reference-kind="skill-attack"]')).toHaveCount(1);await capture('identity-tokiomi','时臣四道具、追加技能攻击及升华资料不受三槽限制');
 await chooseFateIdentity(page,'servant','servant-rider');await expect.poll(async()=>(await state(page)).core.players['0'].servantId).toBe('servant-rider');
 trace.push({id:'after-completion',action:'教程退场后正式选角仍能作出新决定',before:beforeCompletion,after:await snapshot(page),assertions:[{name:'new-master-and-servant-choice-accepted',actual:true,expected:true}]});
 await assertNoFatalFrontendErrors([{label:'fate-tutorial',diagnostics}]);
 await writeFile(path.join(directory,'behavior-trace.json'),JSON.stringify({gameId:'fate-domination',evidenceCategory:'tutorial',sourceRevision,sourceRun:run.runId,chainId:'fate-tutorial-natural-11-rounds',status:'PASS',visualStatus:'pending',outcome:'固定身份从中文规则课程自然十一轮至终局；可选UI、刷新、随机回退、合法偏离、退出与正式再来一局均通过',browserContextId:'single-tutorial-context',steps:trace,uiStates:media.map(item=>({id:item.key,stepId:item.stepId,change:'panel',viewport:'desktop',viewportSize:item.key==='inspection-constrained'?'936x432':item.key==='identity-constrained'?'1366x768':'1920x1080',sha256:item.sha256})),media:media.map(item=>({...item,path:path.join(run.stableDir,path.basename(item.path))})),terminal:{expected:true,actual:true,visible:true,visibleVerifiedBeforeRematch:true}},null,2));
 await promoteEvidenceScreenshotRun(run,{gameId:'fate-domination',evidenceCategory:'tutorial',capturePolicy:'distinct-ui-state',media:media.map((item,index)=>({path:path.relative(process.cwd(),path.join(run.stableDir,path.basename(item.path))).replace(/\\/g,'/'),chainId:'fate-tutorial-natural-11-rounds',chainStep:index+1,stage:'独特界面态',role:'main-flow',transition:item.description,uiStateId:item.key,uiChange:'panel',uiChangeReason:item.description,behaviorStepId:item.stepId,sourceRevision,description:item.description,viewport:'desktop',viewportSize:item.key==='inspection-constrained'?'936x432':item.key==='identity-constrained'?'1366x768':'1920x1080',requirements:['中文原句教学、无选角首课、正式角色UI、一级威力与自然操作生命周期']}))});
});

test('教程中途从正式菜单退出，进入普通对局后教程状态与门禁不污染新决策',async({page,context,baseURL},testInfo)=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000);
 const run=await createEvidenceScreenshotRun(testInfo,{requireChineseName:true});await mkdir(run.stagingDir,{recursive:true});
 await initContext(context,{skipImageGate:false,skipTutorial:false});
 await page.goto(baseURL+'/play/fate-domination/tutorial',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>(window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.(),undefined,{timeout:30000});
 await expect(page.getByTestId('tutorial-overlay-card')).toBeVisible({timeout:30000});
 await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe('intro');
 await expect(page.getByTestId('tutorial-next-button')).toBeVisible();await page.getByTestId('tutorial-next-button').click();
 await expect.poll(async()=>(await state(page)).sys.tutorial.step?.fateCommand?.type).toBe('ADVANCE_PHASE');
 const beforeExit=await snapshot(page);
 await page.getByTestId('fab-menu').locator('button[data-fab-id]').first().click();await page.getByRole('button',{name:'离开',exact:true}).click();
 await page.getByTestId('fab-panel-exit').getByRole('button',{name:/返回大厅/}).click();await expect(page).toHaveURL(/\/$/);
 await page.goto(baseURL+'/play/fate-domination?players=3&playerID=0&seed=tutorial-exit-cleanup&disableLocalAiAutomation=true',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('region',{name:'选择御主与从者'})).toBeVisible();await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
 await chooseFateIdentity(page,'master','m_rin');await expect.poll(async()=>(await state(page)).core.players['0'].masterId).toBe('m_rin');
 await writeFile(path.join(run.stagingDir,'behavior-trace.json'),JSON.stringify({gameId:'fate-domination',evidenceCategory:'tutorial',sourceRevision:fateSourceRevision(),sourceRun:run.runId,chainId:'fate-tutorial-exit-cleanup',status:'PASS',visualStatus:'pending',outcome:'正式菜单退出后新局真实角色选择可用',steps:[{id:'exit-and-select',action:'退出教程后正式新局选择角色',before:beforeExit,after:await snapshot(page),assertions:[{name:'new-match-decision-accepted',actual:(await state(page)).core.players['0'].masterId,expected:'m_rin'}]}],uiStates:[]},null,2));
});
