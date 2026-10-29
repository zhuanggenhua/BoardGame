import type { MatchState } from '../../src/engine/types';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';
import type { Page, TestInfo } from '@playwright/test';
import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { getFrontendSourceHash, sourceIdentityMatches } from '../../scripts/infra/e2e-source-identity.mjs';
import { findRuntimeById } from '../../scripts/infra/e2e-runtime-registry.js';
import { expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';


export async function shot(page: Page, info: TestInfo, name: string) {
 const path=getEvidenceScreenshotPath(info,name,{filename:`${name}.png`,format:'png',requireChineseName:true});
 await mkdir(dirname(path),{recursive:true});
 const runtime=findRuntimeById(process.env.PW_MANAGED_RUNTIME_ID);
 if(!runtime?.frontendSourceHash) throw new Error('截图必须绑定当前托管运行时的前端源码身份');
 const sourceRevision=getFrontendSourceHash();
 expect(runtime.frontendSourceHash).toBe(sourceRevision);
 expect(sourceIdentityMatches(runtime.sourceIdentity)).toBe(true);
 await page.mouse.move(15,15);
 await expect(page.locator('[data-testid="dice-2d"][data-roll-animation="dice2d-cube-tumble"]')).toHaveCount(0);
 await page.waitForTimeout(1150);
 await page.screenshot({path,fullPage:false});
 const snapshot=await page.evaluate(()=>{
  const state=(window as unknown as {__BG_TEST_HARNESS__:{state:{get:()=>MatchState<DiceThroneCore>}}}).__BG_TEST_HARNESS__.state.get(),core=state.core;
  const header=document.querySelector('[data-testid="dt-top-header-1"]')?.getBoundingClientRect();
  const hint=document.querySelector('[data-testid="dice-interaction-hint"]')?.getBoundingClientRect();
  const handDiscardHint=document.querySelector('[data-testid="dicethrone-hand-discard-hint"]')?.getBoundingClientRect();
  const tip=document.querySelector('[data-tutorial-id="tip-board"]')?.getBoundingClientRect();
  const diceTray=document.querySelector('[data-testid="dicethrone-2d-dice-tray"]')?.getBoundingClientRect();
  const overlaps=(a:DOMRect,b:DOMRect|undefined)=>!!b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const rect=(value:DOMRect|undefined)=>value?{left:value.left,top:value.top,right:value.right,bottom:value.bottom}:null;
  const hintGeometry=hint?{top:hint.top,bottom:hint.bottom,left:hint.left,right:hint.right,insideViewport:hint.left>=0&&hint.top>=0&&hint.right<=innerWidth&&hint.bottom<=innerHeight,overlapsTip:overlaps(hint,tip),overlapsHeader:overlaps(hint,header),overlapsDiceTray:overlaps(hint,diceTray),surface:document.querySelector('[data-testid="dice-interaction-hint-anchor"]')?.getAttribute('data-anchor'),placement:document.querySelector('[data-testid="dice-interaction-hint-anchor"]')?.getAttribute('data-placement')}:null;
  const handCardRects=Array.from(document.querySelectorAll<HTMLElement>('[data-testid="hand-area"] [data-card-id]')).map(el=>({cardId:el.getAttribute('data-card-id'),bounds:el.getBoundingClientRect()}));
  const handDiscardHintGeometry=handDiscardHint&&handDiscardHint.width>0&&handDiscardHint.height>0?{top:handDiscardHint.top,bottom:handDiscardHint.bottom,left:handDiscardHint.left,right:handDiscardHint.right,insideViewport:handDiscardHint.left>=0&&handDiscardHint.top>=0&&handDiscardHint.right<=innerWidth&&handDiscardHint.bottom<=innerHeight,overlapsTip:overlaps(handDiscardHint,tip),overlapsHeader:overlaps(handDiscardHint,header),overlapsDiceTray:overlaps(handDiscardHint,diceTray),overlapsHandCards:handCardRects.some(card=>overlaps(handDiscardHint,card.bounds))}:null;
  const thorCardImages=Array.from(document.querySelectorAll<HTMLImageElement>('[data-testid="hand-area"] [data-card-id="card-thor-worthy"] [data-card-atlas-img="true"]')).map(img=>({src:img.currentSrc,complete:img.complete,width:img.naturalWidth,height:img.naturalHeight}));
  const scrollers=Array.from(document.querySelectorAll<HTMLElement>('*')).filter(el=>el.scrollTop!==0||el.scrollLeft!==0).map(el=>({tag:el.tagName,id:el.id,testId:el.dataset.testid,className:el.className,scrollTop:el.scrollTop,scrollLeft:el.scrollLeft}));
  return {visible:{text:document.body.innerText,hintGeometry,handDiscardHintGeometry,handCardRects:handCardRects.map(card=>({cardId:card.cardId,bounds:rect(card.bounds)})),thorCardImages,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},protectedHeader:rect(header),protectedTip:rect(tip),protectedDiceTray:rect(diceTray),scrollers,handCards:handCardRects.map(card=>card.cardId)},authoritative:{phase:state.sys.phase,players:Object.fromEntries(Object.entries(core.players).map(([id,p])=>[id,{characterId:p.characterId,hp:p.resources.hp,cp:p.resources.cp,tokens:p.tokens,hand:p.hand.map(c=>c.id)}])),pendingAttack:core.pendingAttack,pendingBonusDiceSettlement:core.pendingBonusDiceSettlement,currentRollContext:core.currentRollContext,mjolnirThrowsThisTurn:core.mjolnirThrowsThisTurn}};
 });
 const workspaceSourceRevision=getFrontendSourceHash();
 expect(workspaceSourceRevision).toBe(sourceRevision);
 await writeFile(path+'.state.json',JSON.stringify({sourceRevision:runtime.frontendSourceHash,workspaceSourceRevision,runtimeId:runtime.runtimeId,...snapshot},null,2));
 const hintGeometry=snapshot.visible.hintGeometry;
 if(hintGeometry){
  expect(hintGeometry.insideViewport).toBe(true);
  expect(hintGeometry.overlapsTip).toBe(false);
  expect(hintGeometry.overlapsHeader).toBe(false);
  expect(hintGeometry.overlapsDiceTray).toBe(false);
 }
 const handDiscardHintGeometry=snapshot.visible.handDiscardHintGeometry;
 if(handDiscardHintGeometry){
  expect(handDiscardHintGeometry.insideViewport).toBe(true);
  expect(handDiscardHintGeometry.overlapsTip).toBe(false);
  expect(handDiscardHintGeometry.overlapsHeader).toBe(false);
  expect(handDiscardHintGeometry.overlapsDiceTray).toBe(false);
  expect(handDiscardHintGeometry.overlapsHandCards).toBe(false);
 }
}

/** 原骰子交互提示只在其旧承载位置渲染一次：GameHints 顶部居中，效果骰贴 DiceTray。 */
export async function expectDiceHintSurface(page: Page, expectedAnchor: 'viewport' | 'dice-tray') {
 const hints=page.getByTestId('dice-interaction-hint');
 const anchors=page.getByTestId('dice-interaction-hint-anchor');
 await expect(hints).toHaveCount(1);
 await expect(anchors).toHaveCount(1);
 await expect(anchors).toHaveAttribute('data-anchor',expectedAnchor);
 await expect(anchors).toHaveAttribute('data-placement',expectedAnchor === 'viewport' ? 'top-center' : 'tray-top');
}
