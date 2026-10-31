import type { MatchState } from '../../src/engine/types';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';
import type { Page, TestInfo } from '@playwright/test';
import { dirname, relative } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { findRuntimeById } from '../../scripts/infra/e2e-runtime-registry.js';
import { captureEvidenceSourceIdentity } from '../framework/sourceIdentity';
import { expect } from '../framework';
import { getEvidenceScreenshotPath } from '../framework/evidenceScreenshots';

type SourceFileHash = { path: string; hash: string };
type ThorSourceTracker = {
 runtimeId: string;
 sourceRevision: string;
 frontendFiles: Map<string, string>;
 backendFiles: Map<string, string>;
 stateFiles: Set<string>;
};

const sourceTrackers = new WeakMap<Page, ThorSourceTracker>();
const debugLoggedPages = new WeakSet<Page>();

async function observeThorSources(page: Page, runtimeId: string) {
 const captured = await captureEvidenceSourceIdentity(page, 'dicethrone');
 if (process.env.PW_E2E_SOURCE_IDENTITY_DEBUG === '1' && !debugLoggedPages.has(page)) {
  debugLoggedPages.add(page);
  const frontendFiles = captured.frontendSourceIdentity.files as SourceFileHash[];
  const otherGameFiles = frontendFiles
   .map(file => relative(process.cwd(), file.path).replaceAll('\\', '/'))
   .filter(file => /^(?:src|public)\/(?:games|assets)\//.test(file)
    && !file.startsWith('src/games/dicethrone/')
    && !file.startsWith('public/assets/i18n/zh-CN/dicethrone/'));
  const summarize = (scope: typeof captured.frontendSourceIdentity.scope) => ({
   entries: scope.graphEntries.map(file => relative(process.cwd(), file).replaceAll('\\', '/')),
   graphFileCount: scope.graphFiles.length,
   foreignGameCounts: Object.fromEntries([...new Set(scope.foreignGameFiles.map(file => file.gameId))]
    .map(gameId => [gameId, scope.foreignGameFiles.filter(file => file.gameId === gameId).length])),
   foreignGamePaths: scope.foreignGameFiles.map(file => ({
    file: relative(process.cwd(), file.file).replaceAll('\\', '/'),
    via: file.importPath.map(path => relative(process.cwd(), path).replaceAll('\\', '/')),
   })),
   registrationBranches: scope.registrationBranches.map(branch => ({
    file: relative(process.cwd(), branch.file).replaceAll('\\', '/'),
    boundary: branch.boundary,
    availableCount: branch.availableImports.length,
    selected: branch.selectedImports.map(file => relative(process.cwd(), file).replaceAll('\\', '/')),
   })),
  });
  console.log('[thor-source-identity]', JSON.stringify({
   frontendFiles: frontendFiles.length,
   otherGameFileCount: otherGameFiles.length,
   frontendScope: summarize(captured.frontendSourceIdentity.scope),
   backendScope: summarize(captured.backendSourceIdentity.scope),
  }));
 }
 const tracker = sourceTrackers.get(page) ?? {
  runtimeId,
  sourceRevision: captured.sourceRevision,
  frontendFiles: new Map<string, string>(),
  backendFiles: new Map<string, string>(),
  stateFiles: new Set<string>(),
 };
 if (tracker.runtimeId !== runtimeId || captured.runtimeId !== runtimeId) throw new Error('同一条 Thor 行为链不能切换 E2E runtime');
 const frontend = captured.frontendSourceIdentity.files as SourceFileHash[];
 const backend = captured.backendSourceIdentity.files as SourceFileHash[];
 for (const file of frontend) {
  const previous = tracker.frontendFiles.get(file.path);
  if (previous && previous !== file.hash) throw new Error('Thor 前端依赖在采集期间变化: ' + file.path);
  tracker.frontendFiles.set(file.path, file.hash);
 }
 for (const file of backend) {
  const previous = tracker.backendFiles.get(file.path);
  if (previous && previous !== file.hash) throw new Error('Thor 后端依赖在采集期间变化: ' + file.path);
  tracker.backendFiles.set(file.path, file.hash);
 }
 tracker.sourceRevision = captured.sourceRevision;
 sourceTrackers.set(page, tracker);
 return tracker;
}

async function syncThorSourceSidecars(tracker: ThorSourceTracker) {
 const sourceRevision = tracker.sourceRevision;
 const frontendSourceFiles = [...tracker.frontendFiles].map(([path, sha256]) => ({ path, sha256 }));
 const backendSourceFiles = [...tracker.backendFiles].map(([path, sha256]) => ({ path, sha256 }));
 for (const statePath of tracker.stateFiles) {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  await writeFile(statePath, JSON.stringify({ ...state, sourceRevision, frontendSourceFiles, backendSourceFiles }, null, 2));
 }
}

export async function finalizeThorEvidenceSourceIdentity(page: Page) {
 const tracker = sourceTrackers.get(page);
 if (!tracker) return;
 const runtime = findRuntimeById(process.env.PW_MANAGED_RUNTIME_ID);
 if (!runtime?.runtimeId || runtime.runtimeId !== tracker.runtimeId) throw new Error('Thor 证据收口时 runtime 身份发生变化');
 await observeThorSources(page, runtime.runtimeId);
 await syncThorSourceSidecars(tracker);
}

export async function shot(page: Page, info: TestInfo, name: string) {
 const path=getEvidenceScreenshotPath(info,name,{filename:`${name}.png`,format:'png',requireChineseName:true});
 await mkdir(dirname(path),{recursive:true});
 const runtime=findRuntimeById(process.env.PW_MANAGED_RUNTIME_ID);
 if(!runtime?.runtimeId) throw new Error('截图必须绑定当前托管运行时身份');
 const tracker=await observeThorSources(page,runtime.runtimeId);
 await page.mouse.move(15,15);
 await expect(page.locator('[data-testid="dice-2d"][data-roll-animation="dice2d-cube-tumble"]')).toHaveCount(0);
 await page.waitForTimeout(1150);
 await page.screenshot({path,fullPage:false});
 await observeThorSources(page,runtime.runtimeId);
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
 const statePath=path+'.state.json';
 await writeFile(statePath,JSON.stringify({runtimeId:runtime.runtimeId,...snapshot},null,2));
 tracker.stateFiles.add(statePath);
 await syncThorSourceSidecars(tracker);
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

/** 骰子交互提示只渲染一次：普通选骰位于视口左侧垂直居中，效果骰贴 DiceTray。 */
export async function expectDiceHintSurface(page: Page, expectedAnchor: 'viewport' | 'dice-tray') {
 const hints=page.getByTestId('dice-interaction-hint');
 const anchors=page.getByTestId('dice-interaction-hint-anchor');
 await expect(hints).toHaveCount(1);
 await expect(anchors).toHaveCount(1);
 await expect(anchors).toHaveAttribute('data-anchor',expectedAnchor);
 await expect(anchors).toHaveAttribute('data-placement',expectedAnchor === 'viewport' ? 'left-center' : 'tray-top');
}
