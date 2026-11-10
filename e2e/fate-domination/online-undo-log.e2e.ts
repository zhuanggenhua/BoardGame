import {expect, test, type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {GameTransportClient} from '../../src/engine/transport/client';
import {initContext, getGameServerBaseURL, joinMatchViaAPI, seedMatchCredentials} from '../helpers/common';
import {getMatchState} from '../helpers/state-injection';
import {chooseFateIdentity} from './identitySelection';
import {captureEvidenceSourceIdentity,releaseSourceSession,startSourceSession} from '../framework/sourceIdentity';
import {FATE_ATTACK_BY_ID} from '../../src/games/fate-domination/data';

test.use({trace:'retain-on-failure',video:'retain-on-failure',viewport:{width:1366,height:768}});

async function openPanel(page:Page,id:string){
 const panel=page.getByTestId(`fab-panel-${id}`);
 if(await panel.isVisible())return panel;
 const button=page.locator(`button[data-fab-id="${id}"]`);
 if(!await button.isVisible())await page.getByTestId('fab-menu').locator('button').first().click();
 await expect(button).toBeVisible();
 await button.click();
 await expect(panel).toBeVisible();
 return panel;
}

test('Fate 真实双人页面撤回申请、取消、拒绝、同意及日志',async({browser,page,context,baseURL})=>{
 test.setTimeout(240000);
 await initContext(context,{skipImageGate:false});
 const secondContext=await browser.newContext({viewport:{width:1366,height:768}});
 const evidenceDir=path.resolve('evidence/fate-domination/online-undo-log-runs',`${Date.now()}-${process.pid}`);
 await mkdir(evidenceDir,{recursive:true});
 await initContext(secondContext,{skipImageGate:false});
 await startSourceSession(context,baseURL!);
 await startSourceSession(secondContext,baseURL!);
 const second=await secondContext.newPage();
 const base=getGameServerBaseURL(),guest=`fate-undo-ui-${Date.now()}`;
 const createdResponse=await page.request.post(`${base}/games/fate-domination/create`,{data:{numPlayers:3,setupData:{guestId:guest,ownerKey:`guest:${guest}`,ownerType:'guest'}}});
 expect(createdResponse.ok()).toBe(true);
 const created=await createdResponse.json(),matchId=created.matchID as string;
 const firstCredential=created.ownerCredentials??await joinMatchViaAPI(page,'fate-domination',matchId,'0','甲',guest);
 const secondCredential=await joinMatchViaAPI(page,'fate-domination',matchId,'1','乙',`${guest}-1`);
 const thirdCredential=await joinMatchViaAPI(page,'fate-domination',matchId,'2','丙',`${guest}-2`);
 await seedMatchCredentials(context,'fate-domination',matchId,'0',firstCredential);
 await seedMatchCredentials(secondContext,'fate-domination',matchId,'1',secondCredential);
 const peerErrors:string[]=[];
 const peer=new GameTransportClient({server:base,matchID:matchId,playerID:'2',credentials:thirdCredential,onError:error=>peerErrors.push(error)});
 const actor=new GameTransportClient({server:base,matchID:matchId,playerID:'0',credentials:firstCredential,onError:error=>peerErrors.push(error)});
 const read=async()=>await getMatchState(matchId,undefined,{playerId:'0',credentials:firstCredential}) as any;
 const trace:Array<Record<string,unknown>>=[];
 const record=async(step:string)=>{
  const state=await read();
  trace.push({step,at:new Date().toISOString(),round:state.core.round,phase:state.core.phase,currentPlayerId:state.core.currentPlayerId,
   pending:state.sys.undo.pendingRequest??null,rollbackRevision:state.sys.undo.rollbackRevision??0,
   log:(state.sys.actionLog?.entries??[]).map((entry:any)=>({kind:entry.kind,actorId:entry.actorId,timestamp:entry.timestamp}))});
 };
 try{
  peer.connect();actor.connect();await expect.poll(()=>peer.isConnected&&peer.latestState&&actor.isConnected&&actor.latestState,{timeout:30000}).toBeTruthy();
  await Promise.all([page.goto(`/play/fate-domination/match/${matchId}?playerID=0`),second.goto(`/play/fate-domination/match/${matchId}?playerID=1`)]);
  await expect(page.getByTestId('fate-domination-board')).toBeVisible({timeout:45000});
  await expect(second.getByTestId('fate-domination-board')).toBeVisible({timeout:45000});
  await chooseFateIdentity(page,'master','m_waver');
  await chooseFateIdentity(page,'servant','servant-rider');
  await page.getByTestId('fate-domination-primary-action').click();
  await expect.poll(async()=>(await read()).core.currentPlayerId).toBe('1');
  await second.getByTestId('fate-domination-primary-action').click();
  await expect.poll(async()=>(await read()).core.currentPlayerId).toBe('2');
  expect(peer.sendCommand('ADVANCE_PHASE',{})).toBe(true);
  await expect.poll(async()=>(await read()).core.phase).toBe('outpost');
  await expect.poll(()=>(actor.latestState as any)?.core?.phase,{timeout:15000}).toBe('outpost');
  const privateCard=(await read()).core.players['0'].hand[0].id;
  const version=actor.lastReceivedStateID;
  expect(actor.sendCommand('INSPECT_CARD',{cardId:privateCard})).toBe(true);
  await expect.poll(()=>actor.lastReceivedStateID,{timeout:15000}).toBeGreaterThan(version!);
  await expect.poll(async()=>(await read()).sys.actionLog.entries.some((entry:any)=>entry.kind==='INSPECT_CARD'),{timeout:15000}).toBe(true);
  await expect.poll(()=>second.evaluate(()=>JSON.stringify((window as any).__BG_TEST_HARNESS__?.state?.get()?.sys?.actionLog??{})),{timeout:15000}).toContain('查看卡牌');
  const otherView=await second.evaluate(()=>{const state=(window as any).__BG_TEST_HARNESS__.state.get();return JSON.stringify({log:state.sys.actionLog,events:state.sys.eventStream});});
  expect(otherView).not.toContain(privateCard);
  await page.getByRole('button',{name:'部署到魔术工房第1点位'}).click();
  await expect.poll(async()=>(await read()).core.players['0'].locationId).toBe('workshop');
  const before=await read();
  await record('准备完成并打开操作日志');
  const log=await openPanel(page,'action-log');
  const logRows=log.getByTestId('hud-action-log-row');
  await expect.poll(()=>logRows.count()).toBeGreaterThan(0);
  const text=await logRows.allInnerTexts();
  const entries=[...(before.sys.actionLog?.entries??[])].sort((a:any,b:any)=>b.timestamp-a.timestamp);
  expect(entries.filter((entry:any)=>entry.kind==='INSPECT_CARD' && entry.actorId==='0')).toHaveLength(1);
  for(const id of ['0','1','2'])expect(entries.filter((entry:any)=>entry.kind==='ADVANCE_PHASE' && entry.actorId===id)).toHaveLength(1);
  expect(text).toHaveLength(entries.length);
  for(let index=0;index<entries.length;index++){
   const content=(entries[index].segments??[]).filter((segment:any)=>segment.type==='text').map((segment:any)=>segment.text).join(' ');
   if(content)expect(text[index]).toContain(content);
  }
  const ownCard=before.core.players['0'].hand.find((card:any)=>card.id===privateCard);
  expect(text.join('\n')).toContain(FATE_ATTACK_BY_ID[ownCard.definitionId].name);
  expect(text.join('\n')).not.toContain(privateCard);
  await page.screenshot({path:path.join(evidenceDir,'01-正式联机操作日志.png')});
  const otherLog=await openPanel(second,'action-log');
  const otherRows=otherLog.getByTestId('hud-action-log-row');
  await expect(otherRows).toHaveCount(entries.length);
  const otherText=await otherRows.allInnerTexts();
  expect(otherText.join('\n')).not.toContain(privateCard);
  expect(otherText.join('\n')).not.toContain(FATE_ATTACK_BY_ID[ownCard.definitionId].name);
  const request=async()=>{
   const panel=await openPanel(page,'undo-request');
   await panel.getByRole('button',{name:'申请撤回',exact:true}).click();
   await expect.poll(async()=>(await read()).sys.undo.pendingRequest?.requesterId).toBe('0');
  };
  await request();
  await record('申请撤回');
  await page.screenshot({path:path.join(evidenceDir,'02-撤回申请等待对方.png')});
  const waiting=await openPanel(page,'undo-request');
  await waiting.getByRole('button',{name:'取消申请',exact:true}).click();
  await expect.poll(async()=>(await read()).sys.undo.pendingRequest).toBeUndefined();
  expect((await read()).core).toEqual(before.core);
  await record('申请者取消');
  await request();
  const reject=await openPanel(second,'undo-review');
  // 展开全局工具栏时，玩家姓名和资源数值仍须完整露出。
  const overlaps=await second.evaluate(()=>{
   const summaries=Array.from(document.querySelectorAll('.fd-runtime-seat-summary'));
   const buttons=Array.from(document.querySelectorAll('[data-testid="fab-menu"] button')).filter(element=>{
    const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
    return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.pointerEvents!=='none';
   });
   return summaries.flatMap(summary=>buttons.filter(button=>{
    const a=summary.getBoundingClientRect(),b=button.getBoundingClientRect();
    return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   }).map(button=>({summary:summary.textContent,button:button.getAttribute('data-fab-id')})));
  });
  expect(overlaps).toEqual([]);
  await second.screenshot({path:path.join(evidenceDir,'03-对方收到撤回审批.png')});
  await reject.getByRole('button',{name:'拒绝',exact:true}).click();
  await expect.poll(async()=>(await read()).sys.undo.pendingRequest).toBeUndefined();
  expect((await read()).core).toEqual(before.core);
  await record('对方拒绝');
  await request();
  const approve=await openPanel(second,'undo-review');
  await approve.getByRole('button',{name:'同意',exact:true}).click();
  await expect.poll(async()=>(await read()).sys.undo.rollbackRevision??0).toBeGreaterThan(before.sys.undo.rollbackRevision??0);
  const after=await read();
  expect(after.core).not.toEqual(before.core);
  await record('对方同意并恢复状态');
  await second.screenshot({path:path.join(evidenceDir,'04-同意撤回后的正式状态.png')});
  const afterLog=await openPanel(second,'action-log');
  const afterRows=afterLog.getByTestId('hud-action-log-row');
  await expect.poll(()=>second.evaluate(()=>(window as any).__BG_TEST_HARNESS__.state.get().sys.undo.rollbackRevision??0),{timeout:15000}).toBe(after.sys.undo.rollbackRevision??0);
  const afterEntries=await second.evaluate(()=>(window as any).__BG_TEST_HARNESS__.state.get().sys.actionLog.entries);
  afterEntries.sort((a:any,b:any)=>b.timestamp-a.timestamp);
  await expect(afterRows).toHaveCount(afterEntries.length);
  const afterText=await afterRows.allInnerTexts();
  for(let index=0;index<afterEntries.length;index++){
   const content=(afterEntries[index].segments??[]).filter((segment:any)=>segment.type==='text').map((segment:any)=>segment.text).join(' ');
   if(content)expect(afterText[index]).toContain(content);
  }
  for(const player of Object.values(after.core.players) as any[])for(const card of player.hand??[])expect(afterText.join('\n')).not.toContain(card.id);
  await second.screenshot({path:path.join(evidenceDir,'05-撤回后的公开日志.png')});
  expect(peerErrors).toEqual([]);
  const identities=await Promise.all([captureEvidenceSourceIdentity(page,'fate-domination'),captureEvidenceSourceIdentity(second,'fate-domination')]);
  await writeFile(path.join(evidenceDir,'source-identity.json'),JSON.stringify(identities,null,2));
  await writeFile(path.join(evidenceDir,'behavior-trace.json'),JSON.stringify({gameId:'fate-domination',kind:'online-undo-log',steps:trace},null,2));
 }finally{peer.disconnect();actor.disconnect();await releaseSourceSession(context);await releaseSourceSession(secondContext);await secondContext.close();}
});
