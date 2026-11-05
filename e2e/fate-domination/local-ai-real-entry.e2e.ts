import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {createEvidenceScreenshotRun,promoteEvidenceScreenshotRun} from '../framework/evidenceScreenshots';
import {expect,test,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {initContext,attachPageDiagnostics,assertNoFatalFrontendErrors} from '../helpers/common';
import {buildFateAiLegalActions} from '../../src/games/fate-domination/ai';
import type {MatchState} from '../../src/engine/types';
import type {FateDominationCore} from '../../src/games/fate-domination/domain';

test.use({viewport:{width:1920,height:1080}});
async function read(page:Page):Promise<MatchState<FateDominationCore>> {return page.evaluate(()=>(window as any).__BG_TEST_HARNESS__.state.get());}
const card=(id:string)=>`[data-card-id=${JSON.stringify(id)}],[data-focus-card=${JSON.stringify(`skill-0-${id}`)}]`;
async function snapshot(page:Page,current?:MatchState<FateDominationCore>){
 const state=current??await read(page);
 const visible=await page.evaluate(()=>({phase:document.querySelector('.fd-runtime-round')?.textContent??null,primary:document.querySelector('[data-testid="fate-domination-primary-action"]')?.getAttribute('aria-label')??null,opponents:document.querySelector('.fd-runtime-player-rail')?.textContent??null,publicCardsOpen:Boolean(document.querySelector('.fd-runtime-opponent-cards'))}));
 return {visible,authoritative:{round:state.core.round,phase:state.core.phase,current:state.core.currentPlayerId,normalAttacks:Object.fromEntries(state.core.playerIds.map(id=>[id,state.core.players[id].normalAttackPlayed])),interactionOwner:state.sys.interaction.current?.playerId??null}};
}

test('正式本地自动玩家独立出牌并交还真人，完成自然一轮后可继续准备',async({page,context,baseURL},testInfo)=>{
 test.setTimeout(180000);page.setDefaultTimeout(15000);
 await initContext(context,{skipImageGate:false});const diagnostics=attachPageDiagnostics(page);
 const hash=createHash('sha256');
 for(const file of readdirSync('src/games/fate-domination',{recursive:true}).map(String).filter(file=>/\.(tsx?|css)$/.test(file)&&!file.includes('__tests__')).sort()){hash.update(file);hash.update(readFileSync(path.join('src/games/fate-domination',file)));}
 const sourceRevision=`tree-sha256:${hash.digest('hex')}`;
 const run=await createEvidenceScreenshotRun(testInfo,{requireChineseName:true});const directory=run.stagingDir;await mkdir(directory,{recursive:true});const trace:any[]=[];
 await page.goto(`${baseURL}/play/fate-domination?players=3&playerID=0&seed=fate-ai-natural-1&seat0=human&seat1=local-ai&seat2=local-ai`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>(window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.(),undefined,{timeout:30000});
 await expect(page.getByTestId('fate-domination-board')).toBeVisible();
 const initial=await read(page);expect(initial.core.currentPlayerId).toBe('0');
 await page.getByTestId('fate-domination-primary-action').click();
 await expect.poll(async()=>{const s=await read(page);return s.core.phase==='outpost'&&s.core.currentPlayerId==='0';},{timeout:30000}).toBe(true);
 expect((await read(page)).core.phaseCompletedPlayerIds).toEqual([]);
 await page.getByTestId('fate-domination-location-workshop').click();await page.getByTestId('fate-domination-primary-action').click();
 await expect.poll(async()=>(await read(page)).core.players['0'].locationId).toBe('workshop');
 await page.getByTestId('fate-domination-primary-action').click();
 await expect.poll(async()=>{const s=await read(page);return s.core.phase==='action'&&s.core.currentPlayerId==='0';},{timeout:30000}).toBe(true);
 const actionState=await read(page);const beforePlay=await snapshot(page,actionState);const pair=buildFateAiLegalActions({state:actionState,playerId:'0'}).find(item=>item.commands[0].type==='CONFIRM_ATTACK');expect(pair).toBeTruthy();
 const selection=pair!.commands[0].payload as {cardIds:string[];faceDownIds:string[]};
 for(const id of selection.cardIds){const mode=page.getByRole('button',{name:'暗置选牌',exact:true});if((await mode.getAttribute('aria-pressed')==='true')!==selection.faceDownIds.includes(id))await mode.click();await page.locator(card(id)).click();}
 expect((await read(page)).core.players['0'].selectedAttackIds).toEqual([]);
 await page.getByTestId('fate-domination-primary-action').click();
 await page.getByRole('button',{name:'结束行动',exact:true}).click();
 await expect.poll(async()=>{const s=await read(page);return s.core.phase==='battle'&&s.core.currentPlayerId==='0';},{timeout:45000}).toBe(true);
 const aiPlayed=await read(page);
 for(const id of ['1','2']){expect(aiPlayed.core.players[id].normalAttackPlayed).toBe(true);expect(aiPlayed.core.players[id].selectedAttackIds).toEqual([]);}
 expect(aiPlayed.sys.interaction.current).toBeUndefined();
 const avatar=page.locator('.fd-runtime-player-rail .fd-runtime-avatar').first();
 const opponentName=(await avatar.getAttribute('aria-label'))!.replace(/^查看|详情$/g,'');
 await avatar.hover();
 const row=page.getByLabel(`${opponentName}已打出`);await expect(row).toBeVisible();await row.hover();
 await page.screenshot({path:path.join(directory,'AI自主出牌并交还真人.png'),animations:'disabled'});
 const afterPlay=await snapshot(page,aiPlayed);
 trace.push({id:'automatic-opponents-played',action:'真人实际暂选和确认攻击，自动玩家自行完成两席行动，真人悬浮检视公开出牌',before:beforePlay,after:afterPlay,assertions:[{name:'both-ai-normal-attacks-committed',actual:['1','2'].every(id=>aiPlayed.core.players[id].normalAttackPlayed),expected:true}]});
 await page.mouse.move(8,8);await expect(row).toBeHidden({timeout:4000});
 await page.getByTestId('fate-domination-primary-action').click();
 for(let n=0;n<8;n++){
  await expect.poll(async()=>{const s=await read(page);return s.core.round>1||(s.sys.interaction.current?.playerId??s.core.currentPlayerId)==='0';},{timeout:30000}).toBe(true);
  const live=await read(page);if(live.core.round>1)break;
  if(live.sys.interaction.current?.playerId==='0'){await page.getByRole('button',{name:'不恢复',exact:true}).click();await page.getByRole('button',{name:'确认选择',exact:true}).click();}
  else {
   expect(live.core.phase).toBe('battle');expect(live.core.currentPlayerId).toBe('0');
   const label=await page.getByTestId('fate-domination-primary-action').getAttribute('aria-label');
   await page.getByRole('button',{name:label!,exact:true}).click();
  }
 }
 await expect.poll(async()=>{const current=await read(page);return current.core.round===2&&current.core.currentPlayerId==='0'&&current.core.phase==='preparation';},{timeout:30000}).toBe(true);
 const next=await read(page);trace.push({id:'next-round',action:'真人结算战斗后自动玩家完成其准备并交还真人',before:afterPlay,after:await snapshot(page,next),assertions:[{name:'human-next-round-preparation',actual:next.core.currentPlayerId,expected:'0'}]});expect(next.core.currentPlayerId).toBe('0');expect(next.core.phase).toBe('preparation');
 await expect(page.getByTestId('fate-domination-primary-action')).toBeEnabled();
 await page.screenshot({path:path.join(directory,'本地AI自然换轮后真人继续准备.png'),animations:'disabled'});
 await assertNoFatalFrontendErrors([{label:'fate-local-ai',diagnostics}]);
 await writeFile(path.join(directory,'behavior-trace.json'),JSON.stringify({gameId:'fate-domination',evidenceCategory:'independent',sourceRun:run.runId,sourceRevision,chainId:'fate-local-ai-natural-round',status:'PASS',visualStatus:'pending',outcome:'正式本地AI自主出牌、结算一轮并交还真人下一轮准备',fixtureBoundary:{kind:'natural-setup-no-injection'},steps:trace,uiStates:['AI自主出牌并交还真人.png','本地AI自然换轮后真人继续准备.png'].map((name,index)=>({id:`local-ai-${index}`,stepId:index===0?'automatic-opponents-played':'next-round',change:'interaction-mode',viewport:'desktop',sha256:createHash('sha256').update(readFileSync(path.join(directory,name))).digest('hex')})),terminal:{nextRound:next.core.round,nextPhase:next.core.phase,humanControl:next.core.currentPlayerId}},null,2));
 await promoteEvidenceScreenshotRun(run,{gameId:'fate-domination',evidenceCategory:'independent',capturePolicy:'distinct-ui-state',media:['AI自主出牌并交还真人.png','本地AI自然换轮后真人继续准备.png'].map((name,index)=>({path:path.relative(process.cwd(),path.join(run.stableDir,name)).replace(/\\/g,'/'),chainId:'fate-local-ai-natural-round',chainStep:index+1,stage:'独特界面态',uiStateId:`local-ai-${index}`,uiChange:'interaction-mode',uiChangeReason:name,behaviorStepId:index===0?'automatic-opponents-played':'next-round',sourceRevision,description:name,viewport:'desktop',requirements:['正式本地AI自行选择合法命令并交还真人，下一轮可操作']}))});

});
