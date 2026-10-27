import type { MatchState } from '../../src/engine/types';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';
import type { Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { getFrontendSourceHash } from '../../scripts/infra/e2e-source-identity.mjs';
import { findRuntimeById } from '../../scripts/infra/e2e-runtime-registry.js';
import { expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';


export async function shot(page: Page, info: TestInfo, name: string) {
 const path=getEvidenceScreenshotPath(info,name,{filename:`${name}.png`,format:'png',requireChineseName:true});
 await mkdir(dirname(path),{recursive:true});
 await page.mouse.move(15,15);
 await expect(page.locator('[data-testid="dice-2d"][data-roll-animation="dice2d-cube-tumble"]')).toHaveCount(0);
 await page.waitForTimeout(1150);
 await page.screenshot({path,fullPage:false});
 const snapshot=await page.evaluate(()=>{
  const state=(window as unknown as {__BG_TEST_HARNESS__:{state:{get:()=>MatchState<DiceThroneCore>}}}).__BG_TEST_HARNESS__.state.get(),core=state.core;
  const header=document.querySelector('[data-testid="dt-top-header-1"]')?.getBoundingClientRect();
  const hint=document.querySelector('[data-testid="dice-interaction-hint"]')?.getBoundingClientRect();
  const tip=document.querySelector('[data-tutorial-id="tip-board"]')?.getBoundingClientRect();
  const hintGeometry=hint?{top:hint.top,bottom:hint.bottom,left:hint.left,right:hint.right,overlapsTip:!!tip&&hint.left<tip.right&&hint.right>tip.left&&hint.top<tip.bottom&&hint.bottom>tip.top}:null;
  const scrollers=Array.from(document.querySelectorAll<HTMLElement>('*')).filter(el=>el.scrollTop!==0||el.scrollLeft!==0).map(el=>({tag:el.tagName,id:el.id,testId:el.dataset.testid,className:el.className,scrollTop:el.scrollTop,scrollLeft:el.scrollLeft}));
  return {visible:{text:document.body.innerText,hintGeometry,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},protectedHeader:header?{top:header.top,bottom:header.bottom}:null,scrollers,handCards:Array.from(document.querySelectorAll('[data-testid="hand-area"] [data-card-id]')).map(el=>el.getAttribute('data-card-id'))},authoritative:{phase:state.sys.phase,players:Object.fromEntries(Object.entries(core.players).map(([id,p])=>[id,{characterId:p.characterId,hp:p.resources.hp,cp:p.resources.cp,tokens:p.tokens,hand:p.hand.map(c=>c.id)}])),pendingAttack:core.pendingAttack,pendingBonusDiceSettlement:core.pendingBonusDiceSettlement,currentRollContext:core.currentRollContext,mjolnirThrowsThisTurn:core.mjolnirThrowsThisTurn}};
 });
 const runtime=findRuntimeById(process.env.PW_MANAGED_RUNTIME_ID);
 if(!runtime?.frontendSourceHash) throw new Error('截图必须绑定当前托管运行时的前端源码身份');
 await writeFile(path+'.state.json',JSON.stringify({sourceRevision:runtime.frontendSourceHash,workspaceSourceRevision:getFrontendSourceHash(),runtimeId:runtime.runtimeId,...snapshot},null,2));
 if(snapshot.visible.hintGeometry){expect(snapshot.visible.hintGeometry.top).toBeGreaterThanOrEqual(0);expect(snapshot.visible.hintGeometry.overlapsTip).toBe(false);}
 if(snapshot.visible.protectedHeader) expect(snapshot.visible.protectedHeader.top).toBeGreaterThanOrEqual(0);
}
