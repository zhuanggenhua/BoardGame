import type { MatchState } from '../../src/engine/types';
import type { DiceThroneCore } from '../../src/games/dicethrone/domain/types';
import type { Page, TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { findRuntimeById } from '../../scripts/infra/e2e-runtime-registry.js';
import { captureEvidenceSourceIdentity } from '../framework/sourceIdentity';
import { expect } from '../framework';
import { getEvidenceScreenshotPath, sanitizeEvidencePathSegment } from '../framework/evidenceScreenshots';

type SourceFileHash = { path: string; hash: string };
type ThorSourceTracker = {
 runtimeId: string;
 sourceRevision: string;
 frontendFiles: Map<string, string>;
 backendFiles: Map<string, string>;
 stateFiles: Set<string>;
};

const sourceTrackers = new WeakMap<Page, ThorSourceTracker>();
const runtimeSourceTrackers = new Map<string, ThorSourceTracker>();
const debugLoggedPages = new WeakSet<Page>();

function hashThorSourceIdentity(tracker: ThorSourceTracker): string {
 const hash = createHash('sha256');
 const files = [
  ...[...tracker.frontendFiles].map(([path, fileHash]) => ({ path, hash: fileHash })),
  ...[...tracker.backendFiles].map(([path, fileHash]) => ({ path, hash: fileHash })),
 ].sort((a, b) => a.path.localeCompare(b.path));
 for (const file of files) hash.update(file.path).update('\0').update(file.hash).update('\0');
 return hash.digest('hex');
}

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
 const pageTracker = sourceTrackers.get(page);
 const tracker = runtimeSourceTrackers.get(runtimeId) ?? pageTracker ?? {
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
 tracker.sourceRevision = hashThorSourceIdentity(tracker);
 runtimeSourceTrackers.set(runtimeId, tracker);
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
 tracker.stateFiles.clear();
 return tracker.sourceRevision;
}

export async function shot(
 page: Page,
 info: TestInfo,
 name: string,
 options: {
  preservePointer?: boolean;
  settleMs?: number;
  observeSourcesBeforeScreenshot?: boolean;
  captureCardSpotlight?: boolean;
  destinationDirectory?: string;
 } = {},
) {
 const stagedFileName=`${sanitizeEvidencePathSegment(name)||'screenshot'}.png`;
 const path=options.destinationDirectory
  ? join(options.destinationDirectory,stagedFileName)
  : getEvidenceScreenshotPath(info,name,{filename:stagedFileName,format:'png',requireChineseName:true});
 await mkdir(dirname(path),{recursive:true});
 const runtime=findRuntimeById(process.env.PW_MANAGED_RUNTIME_ID);
 if(!runtime?.runtimeId) throw new Error('截图必须绑定当前托管运行时身份');
 let tracker=options.observeSourcesBeforeScreenshot === false
  ? sourceTrackers.get(page)
  : await observeThorSources(page,runtime.runtimeId);
 if (!options.preservePointer) await page.mouse.move(15,15);
 await expect(page.locator('[data-testid="dice-2d"][data-roll-animation="dice2d-cube-tumble"]')).toHaveCount(0);
 const settleMs=options.settleMs ?? 1150;
 if (settleMs > 0) await page.waitForTimeout(settleMs);
 let cardSpotlightAtCapture: {
  visible: boolean;
  cardId: string | null;
  bounds: { left: number; top: number; right: number; bottom: number } | null;
 } | null = null;
 if (options.captureCardSpotlight) {
  await expect.poll(async () => page.evaluate(() => {
   const element = document.querySelector<HTMLElement>('[data-testid="card-spotlight-overlay"]');
   if (!element) return false;
   const bounds = element.getBoundingClientRect();
   const expectedWidth = window.innerWidth * 0.16;
   return Math.abs(bounds.width - expectedWidth) <= 5
    && Math.abs((bounds.left + bounds.right) / 2 - window.innerWidth / 2) <= 5;
  }), { timeout: 2200 }).toBe(true);
  cardSpotlightAtCapture = await page.evaluate(() => {
   const element = document.querySelector<HTMLElement>('[data-testid="card-spotlight-overlay"]');
   if (!element) return { visible: false, cardId: null, bounds: null };
   const bounds = element.getBoundingClientRect();
   const style = window.getComputedStyle(element);
   return {
    visible: style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0,
    cardId: element.getAttribute('data-card-id'),
    bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
   };
  });
  expect(cardSpotlightAtCapture.visible).toBe(true);
  if (!cardSpotlightAtCapture.bounds) throw new Error('卡牌特写截图缺少可见范围');
  const expectedWidth = await page.evaluate(() => window.innerWidth * 0.16);
  const capturedWidth = cardSpotlightAtCapture.bounds.right - cardSpotlightAtCapture.bounds.left;
  const capturedCenterX = (cardSpotlightAtCapture.bounds.left + cardSpotlightAtCapture.bounds.right) / 2;
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(capturedWidth).toBeGreaterThanOrEqual(expectedWidth - 5);
  expect(Math.abs(capturedCenterX - viewportWidth / 2)).toBeLessThanOrEqual(5);
 }
 await page.screenshot({path,fullPage:false,animations:'allow'});
 let cardSpotlightAfterScreenshot: typeof cardSpotlightAtCapture = null;
 if (options.captureCardSpotlight) {
  cardSpotlightAfterScreenshot = await page.evaluate(() => {
   const element = document.querySelector<HTMLElement>('[data-testid="card-spotlight-overlay"]');
   if (!element) return { visible: false, cardId: null, bounds: null };
   const bounds = element.getBoundingClientRect();
   const style = window.getComputedStyle(element);
   return {
    visible: style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0,
    cardId: element.getAttribute('data-card-id'),
    bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
   };
  });
  expect(cardSpotlightAfterScreenshot.visible).toBe(true);
  if (!cardSpotlightAfterScreenshot.bounds) throw new Error('卡牌特写截图后缺少可见范围');
  const expectedWidth = await page.evaluate(() => window.innerWidth * 0.16);
  const capturedWidth = cardSpotlightAfterScreenshot.bounds.right - cardSpotlightAfterScreenshot.bounds.left;
  const capturedCenterX = (cardSpotlightAfterScreenshot.bounds.left + cardSpotlightAfterScreenshot.bounds.right) / 2;
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(capturedWidth).toBeGreaterThanOrEqual(expectedWidth - 5);
  expect(Math.abs(capturedCenterX - viewportWidth / 2)).toBeLessThanOrEqual(5);
 }
 tracker=await observeThorSources(page,runtime.runtimeId);
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
 await writeFile(statePath,JSON.stringify({runtimeId:runtime.runtimeId,...snapshot,...(cardSpotlightAtCapture ? { cardSpotlightAtCapture } : {}),...(cardSpotlightAfterScreenshot ? { cardSpotlightAfterScreenshot } : {})},null,2));
 tracker.stateFiles.add(statePath);
 await syncThorSourceSidecars(tracker);
 const hintGeometry=snapshot.visible.hintGeometry;
 if(hintGeometry){
  expect(hintGeometry.insideViewport).toBe(true);
 }
 const handDiscardHintGeometry=snapshot.visible.handDiscardHintGeometry;
 if(handDiscardHintGeometry){
  expect(handDiscardHintGeometry.insideViewport).toBe(true);
 }
 // 相交数据仅用于定位；实际可见性由截图审查，操作性由用例中的真实点击和状态变化验证。
}

/** 骰子交互提示只渲染一次，并按正式承载合同检查锚点和位置。 */
export async function expectDiceHintSurface(
 page: Page,
 expectedSurface: 'game-hints-top-center' | 'dice-tray-top' | 'dice-tray-left-center',
) {
 const hints=page.getByTestId('dice-interaction-hint');
 const anchors=page.getByTestId('dice-interaction-hint-anchor');
 const expectedAnchor=expectedSurface === 'game-hints-top-center' ? 'viewport' : 'dice-tray';
 const expectedPlacement=expectedSurface === 'game-hints-top-center' ? 'top-center' : expectedSurface === 'dice-tray-top' ? 'tray-top' : 'tray-left-center';
 await expect(hints).toHaveCount(1);
 await expect(anchors).toHaveCount(1);
 await expect(anchors).toHaveAttribute('data-anchor',expectedAnchor);
 await expect(anchors).toHaveAttribute('data-placement',expectedPlacement);
}

/** 等待伤害数字从动效帧收口，避免把飘字残留误当成稳定结算界面。 */
export async function waitForDamageNumbersToSettle(page: Page): Promise<void> {
 const damageNumbers = page.locator('[data-testid="damage-number-float"]');
 // The final effect can mount its float after earlier damage numbers have
 // already faded. Require a continuous hidden window after the full impact
 // sequence instead of sampling once before and once after a fixed delay.
 await page.waitForTimeout(5000);
 const readVisibleDamageNumbers = async () => {
  const visibleDamageNumbers = await damageNumbers.evaluateAll((nodes) => nodes.filter((node) => {
   let opacity = 1;
   let current: HTMLElement | null = node as HTMLElement;
   while (current) {
    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    opacity *= Number(style.opacity || 1);
    current = current.parentElement;
   }
   const bounds = node.getBoundingClientRect();
   return opacity > 0.02
    && bounds.width > 0
    && bounds.height > 0
    && bounds.right > 0
    && bounds.left < window.innerWidth
    && bounds.bottom > 0
    && bounds.top < window.innerHeight;
  }));
  return visibleDamageNumbers.map((node) => {
   const element = node as HTMLElement;
   const bounds = element.getBoundingClientRect();
   const style = window.getComputedStyle(element);
   return {
    text: element.textContent?.trim() ?? '',
    opacity: style.opacity,
    bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
   };
  });
 };
 let hiddenSince: number | null = null;
 let lastVisible: Awaited<ReturnType<typeof readVisibleDamageNumbers>> = [];
 try {
  await expect.poll(async () => {
   lastVisible = await readVisibleDamageNumbers();
   if (lastVisible.length > 0) {
    hiddenSince = null;
    return false;
   }
   hiddenSince ??= Date.now();
   return Date.now() - hiddenSince >= 1200;
  }, { timeout: 12000, intervals: [100, 200, 400] }).toBe(true);
 } catch (error) {
  console.error('[Thor damage-float wait] Visible floats at timeout:', JSON.stringify(lastVisible));
  throw error;
 }
}

/** 等待其他玩家的卡牌特写自动关闭，随后再截取不被过渡层覆盖的交互状态。 */
export async function waitForCardSpotlightToClose(page: Page): Promise<void> {
 await expect(page.getByTestId('card-spotlight-overlay')).toHaveCount(0, { timeout: 5000 });
}

/** 普通卡牌阅读现在由玩家关闭；点击卡牌外的既有遮罩，再等待队列清空。 */
export async function dismissCardSpotlightWithBackdrop(page: Page): Promise<void> {
 const spotlight = page.getByTestId('card-spotlight-overlay');
 if (await spotlight.count() === 0) return;
 const root = page.getByTestId('spotlight-container-root');
 await root.click({ position: { x: 15, y: 15 } });
 await expect(spotlight).toHaveCount(0, { timeout: 5000 });
}
