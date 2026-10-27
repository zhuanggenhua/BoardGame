import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { getFrontendSourceHash } from '../../scripts/infra/e2e-source-identity.mjs';
import { findRuntimeById } from '../../scripts/infra/e2e-runtime-registry.js';
import type { MatchState } from '../../src/engine/types';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';
import { test, expect } from '../framework';
import { clearEvidenceScreenshotsForTest, getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';
import { getGameServerBaseURL } from '../helpers/common';
import { cleanupDTMatch, closeDebugPanelIfOpen, readyAndStartGame, readDiceThroneHarnessState, selectCharacter, setupOnlineMatch, waitForGameBoard } from '../helpers/dicethrone';

test('索尔可在真实双人房间选择并以实施中状态开局',async({browser},info)=>{
 test.setTimeout(180000);await clearEvidenceScreenshotsForTest(info);
 const match=await setupOnlineMatch(browser,info.project.use.baseURL as string??getGameServerBaseURL(),{skipImageGate:true,characterSelectionTimeout:120000});
 expect(match,'必须真实创建双人房间').toBeTruthy();
 if(!match)throw Error('房间创建失败');
 try{
  await match.hostPage.setViewportSize({width:1920,height:1080});
  await selectCharacter(match.hostPage,'thor');await selectCharacter(match.guestPage,'monk');
  await expect(match.hostPage.getByTestId('character-badge-thor-implementation_in_progress')).toHaveCount(1);
  async function shot(name:string){
   const path=getEvidenceScreenshotPath(info,name,{filename:`${name}.png`,format:'png',requireChineseName:true});await mkdir(dirname(path),{recursive:true});
   await match!.hostPage.mouse.move(15,15);await match!.hostPage.waitForTimeout(1150);await match!.hostPage.screenshot({path,fullPage:false});
   const state=await readDiceThroneHarnessState<MatchState<DiceThroneCore>>(match!.hostPage);
   const visible={text:await match!.hostPage.locator('body').innerText()};
   const authoritative={phase:state.sys.phase,selectedCharacters:state.core.selectedCharacters,hostStarted:state.core.hostStarted,players:Object.fromEntries(Object.entries(state.core.players).map(([id,p])=>[id,{characterId:p.characterId,hand:p.hand.map(c=>c.id)}]))};
   const runtime=findRuntimeById(process.env.PW_MANAGED_RUNTIME_ID);
   if(!runtime?.frontendSourceHash)throw new Error('截图必须绑定当前托管运行时的前端源码身份');
   await writeFile(path+'.state.json',JSON.stringify({sourceRevision:runtime.frontendSourceHash,workspaceSourceRevision:getFrontendSourceHash(),runtimeId:runtime.runtimeId,visible,authoritative},null,2));
  }
  await shot('01-索尔真实双人选角与实施中标记');
  await readyAndStartGame(match.hostPage,match.guestPage);
  await waitForGameBoard(match.hostPage);await waitForGameBoard(match.guestPage);
  await closeDebugPanelIfOpen(match.hostPage);
  await expect(match.hostPage.getByTestId('player-board-surface')).toHaveAttribute('data-character-id','thor');
  for(const [slot,id]of Object.entries({fist:'thor-hammer',chi:'thor-mighty-summon',sky:'thor-odinforce',lotus:'thor-chain-lightning',combo:'thor-thunder-strike',lightning:'thor-bottled-lightning',calm:'thor-power-of-thunder',meditate:'thor-thunder-wheel',ultimate:'thor-for-asgard'})){
   await expect(match.hostPage.locator(`[data-ability-slot="${slot}"]`).first()).toHaveAttribute('data-base-ability-id',id);
  }
  await expect(match.hostPage.locator('[data-testid="hand-area"] [data-card-id]')).toHaveCount(4);
  await expect.poll(async()=>match.hostPage.getByTestId('player-board-surface').locator('img').first().evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>100)).toBe(true);
  await expect(match.hostPage.locator('[data-testid="hand-area"] [data-is-flipped="true"]')).toHaveCount(4);
  await expect(match.hostPage.locator('[data-testid="hand-area"] .atlas-shimmer')).toHaveCount(0);
  await shot('02-索尔在线开局角色板九槽与手牌');
 }finally{await cleanupDTMatch(match);}
});
