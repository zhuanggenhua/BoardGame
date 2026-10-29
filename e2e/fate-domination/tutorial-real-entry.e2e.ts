import {createEvidenceScreenshotRun,promoteEvidenceScreenshotRun} from '../framework/evidenceScreenshots';
import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {mkdir,unlink,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {buildLocalMatchSnapshotKey} from '../../src/engine/transport/localSession';
import {initContext,attachPageDiagnostics,assertNoFatalFrontendErrors} from '../helpers/common';
import {chooseFateIdentity} from './identitySelection';
import {assertFateHandCardsUnclipped} from './handVisibility';

test.use({viewport:{width:1920,height:1080}});
type State={core:any;sys:any;tutorialContext:any};
async function state(page:Page):Promise<State>{return page.evaluate(()=>{const w=window as any;const s=w.__BG_TEST_HARNESS__.state.get();return {core:s.core,sys:{tutorial:{active:s.sys.tutorial.active,step:s.sys.tutorial.step,aiActions:s.sys.tutorial.aiActions,stepIndex:s.sys.tutorial.stepIndex,selectedBranch:s.sys.tutorial.selectedBranch},undo:{rollbackRevision:s.sys.undo.rollbackRevision},interaction:{current:s.sys.interaction.current},gameover:s.sys.gameover},tutorialContext:w.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__??null};});}
async function waitStep(page:Page,id:string){await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id,{timeout:20000}).not.toBe(id);}
const quoted=(id:string)=>'[data-card-id='+JSON.stringify(id)+'],[data-focus-card='+JSON.stringify('skill-0-'+id)+']';
const primary=(page:Page)=>page.getByTestId('fate-domination-primary-action');
const closeInspection=(page:Page)=>page.getByTestId('fate-inspection-close').click();
async function clickVisibleMapLocation(page:Page,locationId:string,onMapPan?:()=>Promise<void>){
 const target=page.getByTestId('fate-domination-location-'+locationId);
 await expect(target).toBeVisible();await expect(target).toBeEnabled();
 const findPosition=()=>target.evaluate(element=>{
  const rect=element.getBoundingClientRect();
  const touchOffsets=[[-20,-20],[0,-20],[20,-20],[-20,0],[0,0],[20,0],[-20,20],[0,20],[20,20]] as const;
  // 检查正式地点的整个可见面，不为固定比例采样点改变棋盘构图。
  for(let y=Math.max(22,rect.top+22);y<=Math.min(innerHeight-22,rect.bottom-22);y+=12){
   for(let x=Math.max(22,rect.left+22);x<=Math.min(innerWidth-22,rect.right-22);x+=12){
   if(touchOffsets.every(([dx,dy])=>{
    const hit=document.elementFromPoint(x+dx,y+dy);
    return hit===element||Boolean(hit&&element.contains(hit));
   }))return {x:x-rect.left,y:y-rect.top,viewportX:x,viewportY:y};
   }
  }
  return null;
 });
 let position=await findPosition();
 if(!position){
  // 较大手牌覆盖棋盘下沿时，沿正式地图拖动路径显露地点，不改默认构图。
  const point=await findSafeMapGesturePoint(page,320);
  await page.mouse.move(point.x,point.y);await page.mouse.down();
  await page.mouse.move(point.x,Math.max(24,point.y-280),{steps:20});await page.mouse.up();
  await onMapPan?.();
  position=await findPosition();
 }
 expect(position,`${locationId}地图目标应保留一个未被手牌、牌检视或教程提示遮挡的44px触控区`).not.toBeNull();
 await target.click({position:{x:position!.x,y:position!.y}});
 return {x:position!.viewportX,y:position!.viewportY};
}
async function findSafeMapGesturePoint(page:Page,minY=0){
 const point=await page.evaluate(minY=>{
  const map=document.querySelector<HTMLElement>('.fd-runtime-map');
  const bounds=map?.getBoundingClientRect();
  if(!map||!bounds)return null;
  const tooltip=document.querySelector('[data-testid="tutorial-overlay-card"]')?.getBoundingClientRect();
  const blocked=Array.from(document.querySelectorAll('.fd-runtime-map-card-hit,.fd-runtime-location,.fd-runtime-movement-exit,.fd-runtime-pawn,.fd-runtime-camera-controls,.fd-runtime-top,.fd-runtime-player-rail,.fd-runtime-card,.fd-phase-control,.fd-self-dock'))
   .map(element=>element.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
  for(let y=Math.max(bounds.top+32,minY);y<bounds.bottom-32;y+=24)for(let x=bounds.left+32;x<bounds.right-32;x+=24){
   if(x<0||x>=innerWidth||y<0||y>=innerHeight)continue;
   if(tooltip&&x+100>=tooltip.left&&x-100<=tooltip.right&&y+45>=tooltip.top&&y-45<=tooltip.bottom)continue;
   if(blocked.some(rect=>x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom))continue;
   const hit=document.elementFromPoint(x,y);
   if(hit&&map.contains(hit))return {x,y};
  }
  return null;
 },minY);
 expect(point,'教程地图手势必须从未被提示、牌面、棋子或其它 UI 覆盖的真实地图画布区域开始').not.toBeNull();
 return point!;
}
async function expectDeploymentChoicesUnobscured(page:Page){
 const overlay=page.getByTestId('tutorial-overlay-card');
 const layout=await page.evaluate(()=>{
  const tooltip=document.querySelector('[data-testid="tutorial-overlay-card"]')?.getBoundingClientRect();
  const options=Array.from(document.querySelectorAll<HTMLButtonElement>('.fd-runtime-deployment-slot:not(:disabled)')).map(element=>{
   const rect=element.getBoundingClientRect();
   const style=getComputedStyle(element);
   return {label:element.getAttribute('aria-label'),pressed:element.getAttribute('aria-pressed'),borderColor:style.borderTopColor,borderWidth:style.borderTopWidth,backgroundColor:style.backgroundColor,boxShadow:style.boxShadow,rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}};
  });
  return {tooltip:tooltip?{left:tooltip.left,top:tooltip.top,right:tooltip.right,bottom:tooltip.bottom}:null,options};
 });
 await expect(overlay).toBeVisible();
 const workshopOptions=layout.options.filter(option=>option.label?.includes('魔术工房'));
 expect(workshopOptions,`三个合法工房点位都应同时可选且有明确高亮：${JSON.stringify(layout)}`).toHaveLength(3);
 expect(workshopOptions.filter(option=>option.pressed==='true').length).toBeLessThanOrEqual(1);
 expect(workshopOptions.every(option=>option.pressed==='true'?option.borderColor==='rgb(241, 218, 176)':option.borderColor==='rgb(234, 210, 143)'),`三个合法点位必须分别呈现候选描边与已选强调色：${JSON.stringify(workshopOptions)}`).toBe(true);
 const expectedLegalChoices=['部署到魔术工房第2点位','部署到魔术工房第3点位','部署到魔术工房第4点位','部署到深山町第1点位','部署到新都第1点位'];
 expect(layout.options.map(option=>option.label).sort(),`本局所有当前合法部署点都要同时有可见、可操作的候选高亮：${JSON.stringify(layout.options)}`).toEqual(expectedLegalChoices.sort());
 expect(layout.options.every(option=>option.borderWidth==='2px'&&option.boxShadow!=='none'&&option.backgroundColor!=='rgba(0, 0, 0, 0)'),`每个合法部署点都必须具有候选填色与外发光，不能只在工房点位高亮：${JSON.stringify(layout.options)}`).toBe(true);
 for(const option of layout.options){
  const tooltip=layout.tooltip,rect=option.rect;
  const overlap=tooltip?Math.max(0,Math.min(tooltip.right,rect.right)-Math.max(tooltip.left,rect.left))*Math.max(0,Math.min(tooltip.bottom,rect.bottom)-Math.max(tooltip.top,rect.top)):0;
  expect(overlap,`教程提示必须完整避开合法部署点位 ${option.label}；定位=${JSON.stringify(layout)}`).toBe(0);
 }
 const landmarkRects=await page.locator('.fd-runtime-map-landmark:not([data-tutorial-map-landmark="battle-track"])').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {id:element.getAttribute('data-tutorial-map-landmark'),left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom};}));
 for(const landmark of landmarkRects){
  const tooltip=layout.tooltip;
  const overlap=tooltip?Math.max(0,Math.min(tooltip.right,landmark.right)-Math.max(tooltip.left,landmark.left))*Math.max(0,Math.min(tooltip.bottom,landmark.bottom)-Math.max(tooltip.top,landmark.top)):0;
  expect(overlap,`教程提示必须避开地图上的标题与地利信息 ${landmark.id}；定位=${JSON.stringify({tooltip,landmark})}`).toBe(0);
 }
}
function fateSourceRevision(){
 const hash=createHash('sha256');
 for(const file of readdirSync('src/games/fate-domination',{recursive:true}).map(String).filter(file=>/\.(tsx?|css)$/.test(file)&&!file.includes('__tests__')).sort()){
  hash.update(file);hash.update(readFileSync(path.join('src/games/fate-domination',file)));
 }
 for(const file of ['src/hooks/ui/useTouchLongPress.ts','src/engine/types.ts','src/engine/pipeline.ts','src/engine/systems/TutorialSystem.ts','src/contexts/TutorialContext.tsx','src/pages/matchRoomBridges.tsx','src/components/tutorial/TutorialOverlay.tsx']){hash.update(file);hash.update(readFileSync(file));}
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
async function startFreshTutorialSession(context:BrowserContext,attemptKey:string){
 const snapshotPrefix=buildLocalMatchSnapshotKey('fate-domination','tutorial-progress:v1:fate-domination:fate-domination-foundation');
 await context.addInitScript(({prefix,attemptKey})=>{
  const marker='__fate_full_tutorial_acceptance_fresh__'+attemptKey;
  if(sessionStorage.getItem(marker))return;
  sessionStorage.setItem(marker,'1');
  for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key);
 },{prefix:snapshotPrefix,attemptKey});
}

test('Fate 正式教程：真实开局、所有学员命令、自动他席、恢复与终局',async({page,context,baseURL},testInfo)=>{
 // 整课包含多轮和完整界面采集；动作等待仍各自受 20 秒/5 秒断言约束。
 test.setTimeout(900000);page.setDefaultTimeout(15000);
 await initContext(context,{skipImageGate:false,skipTutorial:false});
 await startFreshTutorialSession(context,`${testInfo.testId}-${testInfo.retry}`);
 const diagnostics=attachPageDiagnostics(page),run=await createEvidenceScreenshotRun(testInfo,{requireChineseName:true}),directory=run.stagingDir;
 await mkdir(directory,{recursive:true});
 const sourceRevision=fateSourceRevision(),trace:any[]=[],media:any[]=[],seen=new Set<string>(),seenHashes=new Map<string,string>();
 // 教学提示与其后真实结果都必须进入相册；同类重复牌名只由行为轨迹证明。
 const lessonCaptures:Record<string,string>={
  preparation:'准备阶段补牌规则',deployment:'先手占用工房 +2 后的真实落位',deploymentChoice:'工房三个 +1 点位与其他合法地点',outpost:'实际部署后的前哨能力窗口',
  masterAbility:'御主能力与行动入口',phaseOrder:'准备、前哨、行动与战斗的轮序',navigation:'地图拖动、缩放与局势检视',
  movement:'先移动再出牌及移动目的',engagement:'抵达交战战场后无法常规移动的原因',cardReading:'攻击牌费用、威力与时机',sealMana:'技能出牌门槛与令咒恢复魔力',
  mixedAttack:'普通牌与技能牌混合出牌',riding:'已激活骑乘的行动能力',ridingChoice:'骑乘追加攻击选择与费用',actionAbility:'发动已打出的急行，以效果移动前往新都',
  publicPower:'公开总威力与对手出牌查看',battle:'战斗阶段结束后的战力结算',settlement:'真实战力结算组成',
  roundReturn:'回合结束时技能牌与弃牌的去向',discard:'随时查看自己的弃牌堆',sealBattle:'战斗强化令咒效果',sealMove:'令咒效果移动与常规移动的交战限制不同',
  normalAttack:'两张明置普通攻击的本次选择',battleDeployment:'战场空位与地利点位',battlefieldDarkAttack:'位于战场时的暗置限制',
  postBattle:'战后恢复令咒选择',revelation:'真实从者揭示与技能公开',elimination:'第十日淘汰状态',
 };
 const expectedLessonIds=new Set(['opening',...Object.keys(lessonCaptures)]);
 const capturedLessonIds=new Set<string>();
 const capturedAbilityIds=new Set<string>();
 const observedLessons=new Set<string>();
 const modalLessons=new Set(['postBattle']);
 const screenshotStates=new Set(['intro','cards-wide-desktop','master-ability-tooltip','deployment-candidates','deployment-selected','deployment-landed','deployment-landed-workshop-third-option','deployment-landed-miyama','deployment-landed-shinto','navigation-zoomed','detail','detail-inspection','inspection-constrained','opponent-detail-hidden','deck-count','discard','seal-cancel','seal-mana','movement-cancel','draft','riding','public-cards','opponent-detail-revealed','eliminated-observer','eliminated-detail','post-battle','terminal','after-completion','identity-constrained','identity-tokiomi',...Object.keys(lessonCaptures).map(id=>'lesson-'+id)]);
 screenshotStates.add('deployment-map-pan');
 screenshotStates.add('dark-mode');screenshotStates.add('dark-draft');
 const capture=async(key:string,name:string)=>{
  if(!screenshotStates.has(key)||seen.has(key))return;
  if(await page.locator('.fd-identity-setup').isVisible())await readyImages(page,'.fd-identity-setup img');
  else await expect(page.getByTestId('fate-pixi-map-canvas-host')).toHaveAttribute('data-map-resource-status','ready');
  if(await page.getByTestId('fate-runtime-inspection').isVisible())await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
  if(await page.locator('.fd-player-detail').isVisible())await expect(page.locator('.fd-player-detail')).not.toContainText('当前威力');
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  if(!modalLessons.has(key.slice(7))&&await page.getByTestId('tutorial-overlay-card').isVisible()){
   const protectedPrintedMap=((await state(page)).sys.tutorial.step?.avoidOverlapSelectors??[]).filter((selector:string)=>selector.includes('fd-runtime-map-landmark'));
   const collisions=()=>page.evaluate((protectedPrintedMap:string[])=>{
    const overlay=document.querySelector('[data-testid="tutorial-overlay-card"]');if(!overlay)return ['教程提示不可见'];
    const a=overlay.getBoundingClientRect();
    const protectedSelectors=['.fd-runtime-card','.fd-play-summary','.fd-self-dock','.fd-self-piles','.fd-self-stats','.fd-master-abilities','.fd-phase-control','.fd-runtime-seat','.fd-event-deck-count','.fd-runtime-map-card-hit','.fd-runtime-deployment-slot:not(:disabled)','.fd-runtime-pawn','.fd-riding-controls'];
    protectedSelectors.push(...protectedPrintedMap);
    return Array.from(document.querySelectorAll(protectedSelectors.join(','))).flatMap(element=>{
     const style=getComputedStyle(element);if(style.visibility==='hidden'||style.display==='none')return [];
     const b=element.getBoundingClientRect(),clip=element.closest('.fd-runtime-card-row')?.getBoundingClientRect();
     const left=Math.max(b.left,clip?.left??0,0),right=Math.min(b.right,clip?.right??innerWidth,innerWidth),top=Math.max(b.top,clip?.top??0,0),bottom=Math.min(b.bottom,clip?.bottom??innerHeight,innerHeight);
     const collision=right>left&&bottom>top&&a.left<right&&a.right>left&&a.top<bottom&&a.bottom>top;
     return collision?[{label:element.getAttribute('aria-label')??element.className,overlay:{left:a.left,top:a.top,right:a.right,bottom:a.bottom},protected:{left,right,top,bottom}}]:[];
    });
   },protectedPrintedMap);
   await expect.poll(collisions,{message:`教学提示遮挡玩家对象：${key}`,timeout:5000}).toEqual([]);
  }
  if(['draft','dark-mode','dark-draft','riding','movement-cancel'].includes(key))await assertFateHandCardsUnclipped(page);
  const file=path.join(directory,String(media.length+1).padStart(2,'0')+'-'+name+'.png');
  await page.screenshot({path:file,animations:'disabled'});
  seen.add(key);
  const current=await snapshot(page),stepId='capture-'+key;
  const sha256=createHash('sha256').update(readFileSync(file)).digest('hex');
  const duplicateOf=seenHashes.get(sha256);
  if(duplicateOf){
   await unlink(file);
   trace.push({id:stepId,action:name,before:current,after:current,captureDeduplicatedInto:duplicateOf,assertions:[{name:'identical-current-ui-state-linked-to-first-capture',actual:sha256,expected:sha256}]});
   return;
  }
  seenHashes.set(sha256,key);
  trace.push({id:stepId,action:name,before:current,after:current,assertions:[{name:'current-formal-reading-surface-visible',actual:true,expected:true}]});
  media.push({key,path:file,stepId,sha256,description:name});
 };
 await page.goto(baseURL+'/play/fate-domination/tutorial',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>(window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.(),undefined,{timeout:30000});
 await expect(page.getByTestId('tutorial-overlay-card')).toBeVisible({timeout:30000});
 await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe('intro');
 expect((await state(page)).core.round,'正式教程必须从全新第一回合开始').toBe(1);
 expect((await state(page)).core.turnOrder,'真实教程开局顺序必须和正式复演计划一致').toEqual(['1','0','2']);
 expect((await state(page)).core.currentPlayerId,'学员应处于第二顺位').toBe('1');
 await expect(page.locator('.fd-identity-setup')).toHaveCount(0);
 expect((await state(page)).core.players['0'].masterId).toBe('m_waver');
 expect((await state(page)).core.players['0'].servantId).toBe('servant-rider');
 await expect(page.locator('.fd-runtime-pawn')).toHaveCount(0);
 await capture('intro','固定身份进入规则课程，未部署且不出现选角');
 await readyImages(page,'.fd-skill-hand-zone .fd-runtime-card img');
 const phaseButton=page.locator('.fd-phase-control .fd-runtime-primary');
 const measurePhaseLayout=()=>page.evaluate(()=>{
  const button=document.querySelector('.fd-phase-control .fd-runtime-primary')!.getBoundingClientRect();
  const skills=document.querySelector('.fd-skill-hand-zone')!.getBoundingClientRect();
  return {button:{x:button.x,y:button.y,width:button.width,height:button.height},skillHeight:skills.height};
 });
 const loadedLayout=await measurePhaseLayout();expect(loadedLayout.skillHeight).toBeGreaterThan(100);
 const missingSkillZone=await page.addStyleTag({content:'.fd-skill-hand-zone{display:none!important}'});
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
 const missingLayout=await measurePhaseLayout();
 expect(missingLayout.skillHeight).toBe(0);
 expect(missingLayout.button).toEqual(loadedLayout.button);
 const phaseSnapshot=await snapshot(page);
 trace.push({id:'phase-control-stability',action:'技能牌区缺席时推进按钮位置不漂移',before:{visible:loadedLayout,authoritative:phaseSnapshot.authoritative},after:{visible:missingLayout,authoritative:phaseSnapshot.authoritative},assertions:[{name:'phase-control-position-stable',actual:missingLayout.button,expected:loadedLayout.button},{name:'skill-zone-absent',actual:missingLayout.skillHeight,expected:0}]});
 await missingSkillZone.evaluate(style=>style.remove());
 let refreshed=false,branched=false,retracted=false,backtracked=false,lateRefreshed=false,deploymentMapPanned=false;
 const optionalDetail=async(playerId:string,key:string,name:string)=>{
  await page.getByRole('button',{name:new RegExp('查看玩家\\s*'+(Number(playerId)+1)+'详情')}).click();
  await expect(page.locator('.fd-player-detail')).toBeVisible();
  await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
  await capture(key,name);
 };
 for(let iteration=0;iteration<700;iteration++){
  const before=await state(page),step=before.sys.tutorial.step,beforeSnapshot=await snapshot(page,before);
  if(before.sys.gameover){
   if(before.sys.tutorial.active)await expect.poll(async()=>(await state(page)).sys.tutorial.active,{message:`终局后教程未退场：${JSON.stringify({tutorial:before.sys.tutorial,tutorialContext:before.tutorialContext})}`,timeout:10000}).toBe(false);
   break;
  }
  if(!step)throw Error('教程提前结束');
  console.log('[Fate教程步骤]',step.id,step.fateCommand?.type??'',step.aiActions?.length??0,step.highlightTarget??'');
  await expect(page.getByTestId('tutorial-action-hint')).toHaveCount(0);
  expect(step.content).not.toMatch(/上排|下排|右下|2\.5|宽限|本教程|已学过的重复|先选择御主/);
  if(step.aiActions?.length||before.sys.tutorial.aiActions?.length){
   try{
    await expect.poll(async()=>{const s=await state(page);return s.sys.tutorial.step?.id!==step.id||(!s.sys.tutorial.step?.aiActions?.length&&!s.sys.tutorial.aiActions?.length);},{timeout:20000}).toBe(true);
   }catch(error){
     await writeFile(testInfo.outputPath('tutorial-automation-failure.json'),JSON.stringify({step,before:beforeSnapshot,beforeState:before,after:await snapshot(page),afterState:await state(page)},null,2));
    throw error;
   }
   trace.push({id:step.id+'-automatic',action:'其他席正式行动或已教同类动作',before:beforeSnapshot,after:await snapshot(page),automatic:true,assertions:[{name:'authored-automation-consumed',actual:true,expected:true}]});
   continue;
  }
  const lessonId=step.fateCopy?.lessonId;
  if(lessonId==='battleDeployment'){
   const placementContext=await page.evaluate(()=>{
    const state=(window as any).__BG_TEST_HARNESS__.state.get(),step=state.sys.tutorial.step,targetId=step?.highlightTarget;
    const target=targetId?document.querySelector(`[data-tutorial-id="${targetId}"]`):null;
    const rect=target?.getBoundingClientRect();
    return {tutorialStep:step?.id,targetId,targetFound:Boolean(target),targetRect:rect?{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}:null,round:state.core.round,phase:state.core.phase,currentPlayerId:state.core.currentPlayerId,players:Object.values(state.core.players).map((player:any)=>({id:player.id,locationId:player.locationId,deploymentSlot:player.deploymentSlot,eliminated:player.eliminated})),deploymentButtons:Array.from(document.querySelectorAll('.fd-runtime-deployment-slot')).map((element:any)=>({label:element.getAttribute('aria-label'),disabled:element.disabled}))};
   });
   console.log('[Fate战场部署提示定位]',JSON.stringify(placementContext));
  }
  if(lessonId==='postBattle')observedLessons.add(lessonId);
  if(beforeSnapshot.visible.tutorialText){
   if(lessonId==='actionAbility'&&step.fateCommand?.type==='PLAY_SKILL'){
    const sourceCard=page.locator(quoted(String(step.fateCommand.payload.skillId)));
    await expect.poll(()=>sourceCard.evaluate(card=>{
     const row=card.closest('.fd-runtime-card-row');if(!row)return false;
     const box=card.getBoundingClientRect(),clip=row.getBoundingClientRect();
     return box.left>=clip.left-1&&box.right<=clip.right+1&&box.top>=clip.top-1&&box.bottom<=clip.bottom+1;
    }),{message:'首次发动急行前，教程应在原牌区显露完整来源卡，不能由测试点击时自动滚入'}).toBe(true);
   }
   expect(lessonId&&expectedLessonIds.has(lessonId),`未分类的可见教程规则：${step.id} / ${lessonId??'无 lessonId'}`).toBeTruthy();
   observedLessons.add(lessonId!);
   if(step.highlightFrame==='none')await expect(page.getByTestId('tutorial-highlight-ring')).toHaveCount(0);
   if(lessonId==='battlefieldDarkAttack'){
    const taughtPlayerId=step.fateCopy?.observer?.playerId??step.aiActions?.[0]?.playerId??(step.fateCommand?before.core.currentPlayerId:undefined);
    expect(taughtPlayerId,`${step.id} 必须标明规则对应的实际玩家`).toBeTruthy();
    const taughtPlayer=before.core.players[taughtPlayerId!];
    expect(['miyama','shinto'],`${step.id} 的规则对象玩家${Number(taughtPlayerId)+1}应位于战场，当前局面：${JSON.stringify({observer:step.fateCopy?.observer,currentPlayerId:before.core.currentPlayerId,players:Object.values(before.core.players).map((player:any)=>({id:player.id,locationId:player.locationId,eliminated:player.eliminated}))})}`).toContain(taughtPlayer.locationId);
    await expect(page.getByTestId('tutorial-overlay-card')).toContainText('若你位于战场');
    await expect(page.getByTestId('tutorial-overlay-card')).not.toContainText('若你不位于战场');
   }
   if(lessonCaptures[lessonId!]&&!capturedLessonIds.has(lessonId!)&&!modalLessons.has(lessonId!)){
    const key='lesson-'+lessonId!;screenshotStates.add(key);
    await capture(key,lessonCaptures[lessonId!]);capturedLessonIds.add(lessonId!);
    if(lessonId==='masterAbility'&&step.fateCopy?.ability)capturedAbilityIds.add(JSON.stringify(step.fateCopy.ability));
   }else if(lessonId==='sealMana'&&step.fateCommand){
    const key='lesson-sealMana-'+step.id;screenshotStates.add(key);await capture(key,'继续补足技能门槛前的实际魔力与第二枚令咒决定');
   }else if(lessonId==='masterAbility'&&step.fateCopy?.ability){
    const abilityId=JSON.stringify(step.fateCopy.ability);
    if(!capturedAbilityIds.has(abilityId)){
     const ability=step.fateCopy.ability,key=`lesson-masterAbility-${ability.masterId??ability.servantId}-${ability.skillId}`;
     screenshotStates.add(key);await capture(key,'另一御主首次使用的实际能力及玩家归属');capturedAbilityIds.add(abilityId);
    }
   }
  }
  if(step.id==='map-camera'){
   if(!refreshed){await resume(page,step.id,before.core);refreshed=true;}
   const readCamera=()=>page.evaluate(()=>({zoom:document.querySelector('.fd-runtime-camera-controls span')?.textContent?.trim()??null,transform:document.querySelector('.fd-runtime-map-overlay')?.getAttribute('style')??null}));
   const cameraBefore=await readCamera(),cameraBeforeSnapshot=await snapshot(page);
   const gesturePoint=await findSafeMapGesturePoint(page);
   await page.mouse.move(gesturePoint.x,gesturePoint.y);await page.mouse.down();await page.mouse.move(gesturePoint.x+70,gesturePoint.y+20,{steps:8});await page.mouse.up();
   const wheelPoint=await findSafeMapGesturePoint(page);
   await page.mouse.move(wheelPoint.x,wheelPoint.y);await page.mouse.wheel(0,-160);
   await expect.poll(async()=>(await readCamera()).zoom,{message:'地图缩放手势后，界面必须显示改变后的缩放比例'}).not.toBe(cameraBefore.zoom);
   const cameraAfter=await readCamera(),cameraAfterSnapshot=await snapshot(page);
   expect(cameraAfter.transform,'拖动与滚轮必须改变地图实际视野变换').not.toBe(cameraBefore.transform);
   await capture('navigation-zoomed','地图平移与缩放后的视野变化');
   trace.push({id:'map-camera-gesture',action:'在无 UI 遮挡的地图画布上拖动并滚轮缩放，再恢复原视野',before:{...cameraBeforeSnapshot,visible:{...cameraBeforeSnapshot.visible,camera:cameraBefore}},after:{...cameraAfterSnapshot,visible:{...cameraAfterSnapshot.visible,camera:cameraAfter,gesturePoint}},assertions:[{name:'zoom-indicator-changed',actual:cameraAfter.zoom!==cameraBefore.zoom,expected:true},{name:'map-transform-changed',actual:cameraAfter.transform!==cameraBefore.transform,expected:true}]});
   await page.getByRole('button',{name:'复位',exact:true}).click();
   await expect.poll(async()=>(await readCamera()).zoom,{message:'复位应恢复手势前的缩放比例'}).toBe(cameraBefore.zoom);
   await optionalDetail('0','detail','可选本人详情保留身份、能力与令咒，不显示临时威力');
   await page.getByRole('button',{name:'检视御主能力',exact:true}).click();
   await capture('detail-inspection','完整卡面阅读时不保留底层教学窗口');
   await page.setViewportSize({width:936,height:432});
   await capture('inspection-constrained','受限横屏完整检视与关闭入口');
   await page.setViewportSize({width:1920,height:1080});await closeInspection(page);
   const hiddenPeer=Object.values((await state(page)).core.players).find((player:any)=>player.id!=='0'&&!player.isRevealed) as any;
   expect(hiddenPeer,'隐藏信息截图必须选择实际尚未真名解放的对手').toBeTruthy();
   await page.getByRole('button',{name:new RegExp('切换到玩家'+(Number(hiddenPeer.id)+1))}).click();
   const hiddenDetail=page.getByRole('dialog');
   await expect(hiddenDetail.getByAltText('未解放从者牌背')).toBeVisible();
   const hiddenSkills=hiddenDetail.getByRole('button',{name:/^检视暗置技能/});
   await expect(hiddenDetail.locator('.fd-player-detail-skills button')).toHaveCount(3);
   await expect(hiddenDetail.locator('.fd-player-detail-skills button:not([disabled])')).toHaveCount(0);
   await expect(hiddenDetail.locator('.fd-player-detail-identity .fd-detail-art img[alt="未解放从者牌背"]')).toHaveCount(1);
   expect(await hiddenSkills.count()).toBe(3);
   for(const skill of await hiddenSkills.all())await expect(skill).toBeDisabled();
   await capture('opponent-detail-hidden','可选对手详情保持从者及技能隐藏');
   await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();
   await page.locator('.fd-runtime-map-card-hit').first().click();await closeInspection(page);
   const deck=page.getByRole('button',{name:/抽牌堆 \d+ 张/});await deck.click();await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);await capture('deck-count','牌堆计数与一级资源威力同帧可读');await deck.click();
   await page.getByTestId('tutorial-next-button').click();
  }else if(step.id.startsWith('ui-inspection')){
   const card=page.locator('.fd-attack-hand-zone [data-card-zone=hand]').first();await card.scrollIntoViewIfNeeded();
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
   if(type.startsWith('SYS_INTERACTION_'))expect(before.sys.interaction.current?.playerId,`${step.id} 的真实交互 owner 必须是学员席`).toBe('0');
   else expect(before.core.currentPlayerId,`${step.id} 的操作提示必须与当前权威行动席一致：${JSON.stringify({type,round:before.core.round,phase:before.core.phase,turnOrder:before.core.turnOrder,phaseCompletedPlayerIds:before.core.phaseCompletedPlayerIds})}`).toBe('0');
   if(type==='DEPLOY_MASTER'){
    const point=page.getByTestId('fate-domination-location-'+payload.locationId);
    if(!seen.has('deployment-candidates')){
     expect(before.core.players['1'].locationId).toBe('workshop');
     expect(before.core.players['1'].deploymentSlot).toBe(0);
     expect(before.core.players['0'].locationId).toBeNull();
     await expect(page.getByRole('button',{name:/玩家2位于魔术工房/})).toBeVisible();
     await capture('deployment-candidates','先手占据 +2 后，工房三个 +1 与其他合法点位同时可选');
     await expectDeploymentChoicesUnobscured(page);
     const workshopOptions=step.fateCommandOptions?.filter(option=>option.type==='DEPLOY_MASTER'&&option.payload.locationId==='workshop')??[];
     expect(workshopOptions.map(option=>option.payload.deploymentSlot)).toEqual([1,2,3]);
     expect([...new Set(step.fateCommandOptions?.map(option=>String(option.payload.locationId))??[])].sort()).toEqual(['miyama','shinto','workshop']);
     for(const locationId of ['miyama','shinto'] as const){const candidate=page.getByTestId('fate-domination-location-'+locationId);await expect(candidate).toBeVisible();await expect(candidate).toBeEnabled();}
     for(const slot of [1,2,3]){
      const candidate=page.getByRole('button',{name:`部署到魔术工房第${slot+1}点位`});
      await expect(candidate).toBeVisible();await expect(candidate).toBeEnabled();
      await expectDeploymentChoicesUnobscured(page);
      await candidate.click();await expect(candidate).toHaveAttribute('aria-pressed','true');
      await expectDeploymentChoicesUnobscured(page);
      expect((await state(page)).core).toEqual(before.core);
      await expect(page.locator('.fd-runtime-deployment-slot[aria-pressed="true"]')).toHaveCount(1);
      if(slot===1)await capture('deployment-selected','选中工房第二点位后仍未提交，可撤回或改选');
     }
     await page.getByRole('button',{name:'取消部署',exact:true}).click();
     expect((await state(page)).core).toEqual(before.core);
     for(const slot of [1,2,3]){
      const candidate=page.getByRole('button',{name:`部署到魔术工房第${slot+1}点位`});
      await expectDeploymentChoicesUnobscured(page);
      await candidate.click();await expect(candidate).toHaveAttribute('aria-pressed','true');
      expect((await state(page)).core).toEqual(before.core);
      await primary(page).click();
      await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).not.toBe(step.id);
      const placed=await state(page);
      expect(placed.core.players['0']).toMatchObject({locationId:'workshop',deploymentSlot:slot});
      expect(placed.sys.tutorial.selectedBranch).toBe('workshop');
      if(slot===3)await capture('deployment-landed-workshop-third-option','确认后棋子落在三处合法 +1 点位中的第三处');
      await page.getByTestId('tutorial-previous-button').click();
      await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe(step.id);
      const restored=await state(page);expect(restored.core).toEqual(before.core);expect(restored.sys.tutorial.selectedBranch).toBeFalsy();
     }
     for(const locationId of ['miyama','shinto'] as const){
      const alternative=page.getByTestId('fate-domination-location-'+locationId);
      await clickVisibleMapLocation(page,locationId,async()=>{deploymentMapPanned=true;await capture('deployment-map-pan','拖动地图显露被底部卡牌覆盖的合法部署点位');});await expect(alternative).toHaveAttribute('aria-pressed','true');
      expect((await state(page)).core).toEqual(before.core);
      const locationName={miyama:'深山町',shinto:'新都'}[locationId];
      await primary(page).click();
      await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).not.toBe(step.id);
      const placed=await state(page);expect(placed.core.players['0'].locationId).toBe(locationId);
      expect(placed.sys.tutorial.selectedBranch).toBe(locationId);
      await capture('deployment-landed-'+locationId,`确认后棋子实际落位${locationName}，教程继续`);
      await page.getByTestId('tutorial-previous-button').click();
      await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe(step.id);
      const restored=await state(page);expect(restored.core).toEqual(before.core);expect(restored.sys.tutorial.selectedBranch).toBeFalsy();
     }
     await page.getByRole('button',{name:'复位',exact:true}).click();
     branched=true;
    }
    const deploymentLocation=payload.locationId as 'workshop'|'miyama'|'shinto';
    const deploymentLocationName={workshop:'魔术工房',miyama:'深山町',shinto:'新都'}[deploymentLocation];
    const deploymentSlot=typeof payload.deploymentSlot==='number'?payload.deploymentSlot:0;
    expect(await point.getAttribute('aria-label')).toBe(`部署到${deploymentLocationName}第${deploymentSlot+1}点位`);
    await point.click();expect((await state(page)).core.players['0'].locationId).toBeNull();
    if(!seen.has('deployment-selected')){
     await expect(page.getByRole('button',{name:/部署到魔术工房第3点位/})).toBeEnabled();
     await page.getByRole('button',{name:'取消部署',exact:true}).click();expect((await state(page)).core).toEqual(before.core);
     await point.click();
    }
    await expect(point).toHaveAttribute('aria-pressed','true');await capture('deployment-selected','选中工房点位仍未提交，可取消和改选');
    await page.getByRole('button',{name:'取消部署',exact:true}).click();expect((await state(page)).core.players['0'].locationId).toBeNull();
    await point.click();await primary(page).click();
    const deployed=await state(page);expect(deployed.core.players['0'].locationId).toBe(deploymentLocation);expect(deployed.core.players['0'].deploymentSlot).toBe(deploymentSlot);
    await expect(page.getByRole('button',{name:new RegExp('玩家1位于'+deploymentLocationName)})).toBeVisible();await capture('deployment-landed',`确认后棋子才落在已选${deploymentLocationName}点位`);
   }else if(type==='CONFIRM_ATTACK'){
    for(const id of payload.cardIds){
     const mode=page.getByRole('button',{name:'暗置选牌',exact:true});
     if((await mode.getAttribute('aria-pressed')==='true')!==payload.faceDownIds.includes(id))await mode.click();
     if(payload.faceDownIds.includes(id))await capture('dark-mode','切换到暗置选牌，尚未选中暗置牌');
     await page.locator(quoted(id)).click();
    }
    expect((await state(page)).core.players['0'].selectedAttackIds).toEqual([]);
    if(!retracted){await page.locator(quoted(payload.cardIds[0])).click();await page.locator(quoted(payload.cardIds[0])).click();retracted=true;}
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
    await capture('draft','两张草稿及一级预计威力，确认前可撤回');
    if(payload.faceDownIds.length)await capture('dark-draft','明暗混合草稿与暗置标记，确认前仍可撤回');
    if(!seen.has('cards-wide-desktop')){
     await page.setViewportSize({width:2560,height:1225});await page.mouse.move(2,2);
     await assertFateHandCardsUnclipped(page);
     for(const selector of ['.fd-attack-cards .fd-runtime-card','.fd-skill-cards .fd-runtime-card']){
      const card=page.locator(selector).first();
      await expect.poll(async()=>(await card.boundingBox())!.width).toBeGreaterThanOrEqual(230);
      const cardBox=await card.boundingBox();
      expect(cardBox!.height/1225).toBeGreaterThanOrEqual(.25);
     }
     const stagedBox=await page.locator('.fd-played-cards .fd-runtime-card').first().boundingBox();
     expect(stagedBox!.width,'暂存排维持改造前尺寸，不跟随可选手牌放大').toBeCloseTo(120);
     const playedRow=await page.getByTestId('fate-played-cards').boundingBox(),handRow=await page.getByTestId('fate-domination-hand').boundingBox(),summary=await page.getByTestId('fate-play-summary').boundingBox();
     expect(playedRow!.y+playedRow!.height).toBeLessThanOrEqual(handRow!.y);
     expect(summary!.y+summary!.height).toBeLessThanOrEqual(handRow!.y);
     expect(summary!.x+summary!.width).toBeLessThanOrEqual(playedRow!.x);
     await capture('cards-wide-desktop','2560桌面的大牌、一级威力与常显技能区');
     await page.setViewportSize({width:1920,height:1080});await page.mouse.move(2,2);
    }
    await primary(page).click();
   }else if(type==='PLAY_SKILL'){
    const master=before.core.players['0'].skills.find((skill:any)=>skill.id===payload.skillId&&skill.isMasterSkill);
    if(master){
     await page.getByRole('button',{name:/查看玩家\s*1详情/}).click();
     await page.getByRole('button',{name:/切换到玩家2/}).click();await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
     await page.getByRole('button',{name:/切换到玩家1/}).click();await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);await expect(page.getByLabel('御主能力说明')).toContainText('你能支付1魔力来抽2张牌。');
     await expect(page.getByRole('dialog').getByRole('button',{name:/^发动/})).toHaveCount(0);
     await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();
     const abilityButton=page.getByRole('button',{name:'发动'+master.name,exact:true});
     await abilityButton.hover();
     await expect(page.getByTestId('info-tooltip')).toContainText('你能支付1魔力来抽2张牌。');
     await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
     const tipBox=await page.getByTestId('info-tooltip').boundingBox(),buttonBox=await abilityButton.boundingBox();
     expect(tipBox!.x).toBeGreaterThanOrEqual(buttonBox!.x+buttonBox!.width);
     await capture('master-ability-tooltip','御主能力直接位于角色旁，右侧只读说明，不打开详情发动');
     await abilityButton.click();
    }else await page.locator(quoted(payload.skillId)).click();
    if(payload.targetLocationId){await clickVisibleMapLocation(page,payload.targetLocationId);await primary(page).click();}
   }else if(type==='MOVE_PLAYER'){
    if(!seen.has('movement-cancel')){
     expect(before.core.phase).toBe('action');
     expect(before.core.players['0'].locationId).toBe('workshop');
     expect(['miyama','shinto']).toContain(payload.locationId);
     await expect(page.getByTestId('tutorial-overlay-card')).toContainText('1.进行常规移动');
     const destination=before.core.battlefield[payload.locationId].label;
     await expect(page.getByTestId('tutorial-overlay-card')).toContainText(`本次前往${destination}争夺事件战果`);
    }
    await page.getByRole('button',{name:/玩家1位于/}).click();const movementTargetPoint=await clickVisibleMapLocation(page,payload.locationId);
    await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
    if(!seen.has('movement-cancel')){
     trace.push({id:'movement-map-hit-area',action:'在地图可见且未被遮挡的目标区域开始移动',before:beforeSnapshot,after:await snapshot(page),clickPoint:movementTargetPoint,assertions:[{name:'44px-map-target-available',actual:true,expected:true}]});
     await capture('movement-cancel','移动目标与确认分开，取消不支付');
     await page.getByRole('button',{name:'取消移动',exact:true}).click();expect((await state(page)).core.players['0'].mana).toBe(before.core.players['0'].mana);
     await page.getByRole('button',{name:/玩家1位于/}).click();await clickVisibleMapLocation(page,payload.locationId);
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
    if(payload.effect==='move'){await clickVisibleMapLocation(page,payload.targetLocationId);await primary(page).click();}
    else{await capture('seal-'+payload.effect,'令咒选择效果后明确确认');await page.getByRole('button',{name:'确认使用',exact:true}).click();}
   }else if(type==='SYS_INTERACTION_CANCEL')await page.getByTestId('fate-riding-cancel').click();
   else if(type==='SYS_INTERACTION_RESPOND'){
    if(payload.optionIds){for(const id of payload.optionIds)await page.locator(quoted(id)).click();await capture('riding','骑乘候选卡面完整，轻描边区分选择与实付费用');await page.getByTestId('fate-riding-confirm').click();}
    else{
     if(!lateRefreshed){await resume(page,step.id,before.core);lateRefreshed=true;}
     await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
     const choice=page.getByRole('dialog',{name:'战后恢复令咒'});
     await expect(choice).toBeVisible();
     await expect(choice.getByRole('button',{name:'恢复一枚令咒',exact:true})).toBeVisible();
     await expect(choice.getByRole('button',{name:'确认选择',exact:true})).toBeDisabled();
     await capture('lesson-postBattle',lessonCaptures.postBattle);
     const selectedChoice=choice.getByRole('button',{name:payload.optionId==='restore'?'恢复一枚令咒':'不恢复',exact:true});
     await selectedChoice.click();await expect(selectedChoice).toHaveAttribute('aria-pressed','true');
     expect((await state(page)).core).toEqual(before.core);
     await expect(choice.getByRole('button',{name:'确认选择',exact:true})).toBeEnabled();
     await capture('post-battle','选择恢复后仍需确认，当前令咒尚未变化');
     await choice.getByRole('button',{name:'确认选择',exact:true}).click();
     const resolvedChoice=await state(page);
     expect(resolvedChoice.core.players['0'].commandSpells).toBe(before.core.players['0'].commandSpells+(payload.optionId==='restore'?1:0));
    }
   }else{
    await expect(primary(page),`教程推进按钮不可用：${JSON.stringify({authoritative:await state(page),visible:await snapshot(page)})}`).toBeEnabled();
    await primary(page).click();
   }
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
 for(const id of expectedLessonIds)expect(observedLessons.has(id),`未走到中文规则课程：${id}`).toBe(true);
 for(const id of Object.keys(lessonCaptures))expect(seen.has('lesson-'+id),`缺少对应教学画面：${id}`).toBe(true);
 expect(terminal.sys.tutorial.active,`终局权威状态仍显示教程活动：${JSON.stringify({tutorial:terminal.sys.tutorial,tutorialContext:terminal.tutorialContext})}`).toBe(false);expect(terminal.sys.gameover).toBeTruthy();
 await expect(page.getByRole('region',{name:'圣杯战争结果'})).toBeVisible();
 expect({refreshed,branched,retracted,backtracked,lateRefreshed}).toEqual({refreshed:true,branched:true,retracted:true,backtracked:true,lateRefreshed:true});
 await capture('terminal','自然十一轮终局与结果');
 const beforeCompletion=await snapshot(page);
 await expect(page.getByTestId('tutorial-overlay-card'),`终局仍显示教程浮层：${JSON.stringify({authoritative:terminal.sys.tutorial,tutorialContext:terminal.tutorialContext,visible:beforeCompletion.visible})}`).toHaveCount(0);
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
 if(deploymentMapPanned)expect(seen.has('deployment-map-pan'),'真实发生的部署拖图必须有独立画面，不能被截图白名单静默漏掉').toBe(true);
 expect(fateSourceRevision(),'完整教程运行期间产品源码指纹必须保持一致').toBe(sourceRevision);
 await writeFile(path.join(directory,'behavior-trace.json'),JSON.stringify({gameId:'fate-domination',evidenceCategory:'tutorial',sourceRevision,sourceRun:run.runId,chainId:'fate-tutorial-natural-11-rounds',status:'PASS',visualStatus:'pending',outcome:'固定身份从中文规则课程自然十一轮至终局；可选UI、刷新、随机回退、合法偏离、退出与正式再来一局均通过',browserContextId:'single-tutorial-context',steps:trace,uiStates:media.map(item=>({id:item.key,stepId:item.stepId,change:'panel',viewport:'desktop',viewportSize:item.key==='cards-wide-desktop'?'2560x1225':item.key==='inspection-constrained'?'936x432':item.key==='identity-constrained'?'1366x768':'1920x1080',sha256:item.sha256})),media:media.map(item=>({...item,path:path.join(run.stableDir,path.basename(item.path))})),terminal:{expected:true,actual:true,visible:true,visibleVerifiedBeforeRematch:true}},null,2));
 await promoteEvidenceScreenshotRun(run,{gameId:'fate-domination',evidenceCategory:'tutorial',capturePolicy:'distinct-ui-state',media:media.map((item,index)=>({path:path.relative(process.cwd(),path.join(run.stableDir,path.basename(item.path))).replace(/\\/g,'/'),chainId:'fate-tutorial-natural-11-rounds',chainStep:index+1,stage:'独特界面态',role:'main-flow',transition:item.description,uiStateId:item.key,uiChange:'panel',uiChangeReason:item.description,behaviorStepId:item.stepId,sourceRevision,description:item.description,viewport:'desktop',viewportSize:item.key==='cards-wide-desktop'?'2560x1225':item.key==='inspection-constrained'?'936x432':item.key==='identity-constrained'?'1366x768':'1920x1080',requirements:['中文原句教学、无选角首课、正式角色UI、一级威力与自然操作生命周期']}))});
});

test('教程中途从正式菜单退出，进入普通对局后教程状态与门禁不污染新决策',async({page,context,baseURL},testInfo)=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000);
 const run=await createEvidenceScreenshotRun(testInfo,{requireChineseName:true});await mkdir(run.stagingDir,{recursive:true});
 await initContext(context,{skipImageGate:false,skipTutorial:false});
 await startFreshTutorialSession(context,`${testInfo.testId}-${testInfo.retry}`);
 await page.goto(baseURL+'/play/fate-domination/tutorial',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>(window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.(),undefined,{timeout:30000});
 await expect(page.getByTestId('tutorial-overlay-card')).toBeVisible({timeout:30000});
 await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).toBe('intro');
 expect((await state(page)).core.round,'退出场景教程也必须从全新第一回合开始').toBe(1);
 await expect(page.getByTestId('tutorial-next-button')).toBeVisible();await page.getByTestId('tutorial-next-button').click();
 await expect.poll(async()=>(await state(page)).sys.tutorial.step?.id).not.toBe('intro');
 expect((await state(page)).core.round,'进入第一条可见规则步骤后仍处于第一回合').toBe(1);
 const beforeExit=await snapshot(page);
 await page.getByTestId('fab-menu').locator('button[data-fab-id]').first().click();await page.getByRole('button',{name:'离开',exact:true}).click();
 await page.getByTestId('fab-panel-exit').getByRole('button',{name:/返回大厅/}).click();await expect(page).toHaveURL(/\/$/);
 await page.goto(baseURL+'/play/fate-domination?players=3&playerID=0&seed=tutorial-exit-cleanup&disableLocalAiAutomation=true',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('region',{name:'选择御主与从者'})).toBeVisible();await expect(page.getByTestId('tutorial-overlay-card')).toHaveCount(0);
 await chooseFateIdentity(page,'master','m_rin');await expect.poll(async()=>(await state(page)).core.players['0'].masterId).toBe('m_rin');
 await writeFile(path.join(run.stagingDir,'behavior-trace.json'),JSON.stringify({gameId:'fate-domination',evidenceCategory:'tutorial',sourceRevision:fateSourceRevision(),sourceRun:run.runId,chainId:'fate-tutorial-exit-cleanup',status:'PASS',visualStatus:'pending',outcome:'正式菜单退出后新局真实角色选择可用',steps:[{id:'exit-and-select',action:'退出教程后正式新局选择角色',before:beforeExit,after:await snapshot(page),assertions:[{name:'new-match-decision-accepted',actual:(await state(page)).core.players['0'].masterId,expected:'m_rin'}]}],uiStates:[]},null,2));
});
