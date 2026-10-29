import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildDrawnHandCards } from '../../src/games/qidahen/domain/handCardState';
import type { QidahenCore } from '../../src/games/qidahen/domain/types';
import type {} from '../../src/engine/testing/types';
import { expect, test, type Page } from '@playwright/test';
import { listRuntimes } from '../../scripts/infra/e2e-runtime-registry.js';
import { getFrontendSourceHash, sourceIdentityMatches } from '../../scripts/infra/e2e-source-identity.mjs';
import { setChineseLocale, disableAudio, disableTutorial, attachPageDiagnostics, assertNoFatalFrontendErrors } from '../helpers/common';

const dir = 'temp/qidahen-pc-proportional-20261027';
const url = '/play/qidahen?tutorialSetup=basic-opening&players=3&seat0=human&seat1=human&seat2=human&playerID=0';
const sources = ['src/games/qidahen/Board.tsx', 'src/games/qidahen/QidahenBoardShell.tsx', 'src/games/qidahen/qidahen-board.css', 'src/games/qidahen/ui/QidahenHandInteractionTray.tsx', 'src/games/qidahen/ui/QidahenMapPopulationLayer.tsx', 'src/games/qidahen/ui/populationLayout.ts', 'src/games/qidahen/data/runtime-region-graph.json'];
const hashes = () => Object.fromEntries(sources.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')]));
const selectors = ['qidahen-action-wheel','qidahen-player-float','qidahen-chronology-zone','qidahen-korea-zone','qidahen-hand-zone','qidahen-draw-anchor','qidahen-discard-anchor','qidahen-map-viewport-controls'];
type Box = { x:number; y:number; width:number; height:number; fontSize:number; lineHeight:string };
async function capture(page: Page, label: string, payment = false) {
    const ids = payment ? [...selectors,'qidahen-action-payment-panel'] : selectors;
    const data: Record<string,Box> = {};
    for (const id of ids) {
        const node=page.getByTestId(id);
        await expect(node).toBeVisible();
        data[id]=await node.evaluate(el=>{ const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return {x:r.x,y:r.y,width:r.width,height:r.height,fontSize:parseFloat(s.fontSize),lineHeight:s.lineHeight}; });
    }
    const stage=await page.getByTestId('qidahen-desktop-stage').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
    await page.mouse.move(1,1);
    await page.screenshot({path:`${dir}/${label}.png`,animations:'disabled'});
    return {stage,data,count:await page.locator('button[data-qidahen-hand-card-touch-inspect="long-press"]').count()};
}
function compare(pc:Awaited<ReturnType<typeof capture>>, mobile:Awaited<ReturnType<typeof capture>>) {
    const scale=mobile.stage.width/pc.stage.width;
    expect(mobile.stage.height/pc.stage.height).toBeCloseTo(scale,3);
    expect(mobile.count).toBe(pc.count);
    for(const [id,p] of Object.entries(pc.data)) {
        const m=mobile.data[id];
        for(const [actual, expected] of [[m.x-mobile.stage.x,(p.x-pc.stage.x)*scale],[m.y-mobile.stage.y,(p.y-pc.stage.y)*scale],[m.width,p.width*scale],[m.height,p.height*scale]] as const) {
            expect(Math.abs(actual-expected),`${id} geometry: ${actual} vs ${expected}`).toBeLessThan(2);
        }
        expect(m.fontSize,`${id} CSS font size in same design coordinates`).toBe(p.fontSize);
        expect(m.lineHeight,`${id} CSS line height in same design coordinates`).toBe(p.lineHeight);
    }
}
test('七大恨 PC 与手机同构等比：常态和支付选择',async ({page})=>{
    test.setTimeout(210000); mkdirSync(dir,{recursive:true});
    const runtime=listRuntimes().find((r: {scope: string})=>r.scope===process.env.PW_RUNTIME_SCOPE);
    expect(runtime).toBeTruthy(); expect(runtime.frontendSourceHash).toBe(getFrontendSourceHash()); expect(sourceIdentityMatches(runtime.sourceIdentity)).toBe(true);
    const before=hashes();
    await setChineseLocale(page); await disableAudio(page); await disableTutorial(page);
    await page.addInitScript(()=>{window.__E2E_TEST_MODE__=true; (window as Window & {__BG_HIDE_DEBUG_PANEL__?: boolean}).__BG_HIDE_DEBUG_PANEL__=true;});
    const diagnostics=attachPageDiagnostics(page);
    await page.setViewportSize({width:1920,height:1080}); await page.goto(url,{waitUntil:'domcontentloaded'});
    await expect(page.getByTestId('qidahen-board')).toBeVisible({timeout:90000});
    await expect(page.locator('[data-qidahen-map-population]').first()).toBeVisible();
    const pc=await capture(page,'01-桌面常态');
    await page.setViewportSize({width:2560,height:1304}); const wide=await capture(page,'06-宽屏桌面常态'); compare(pc,wide);
    await page.setViewportSize({width:740,height:342}); const small=await capture(page,'07-小屏手机常态'); compare(pc,small);
    await page.setViewportSize({width:936,height:432}); const phone=await capture(page,'02-手机常态'); compare(pc,phone);
    await page.setViewportSize({width:1920,height:1080});
    await page.getByRole('button',{name:/征召军队/}).click();
    await expect(page.getByTestId('qidahen-action-payment-panel')).toBeVisible();
    await page.locator('button[data-qidahen-hand-card-touch-inspect="long-press"]').first().click();
    await expect(page.getByTestId('qidahen-action-payment-status')).toContainText('已选 1 / 1 张');
    const pcPay=await capture(page,'03-桌面支付',true);
    await page.setViewportSize({width:936,height:432}); const phonePay=await capture(page,'04-手机支付',true); compare(pcPay,phonePay);
    await page.getByTestId('qidahen-action-payment-cancel').click();
    await expect(page.getByTestId('qidahen-action-payment-panel')).toHaveCount(0);
    await page.getByTestId('qidahen-map-zoom-in').click();
    await page.getByTestId('qidahen-map-zoom-reset').click();
    assertNoFatalFrontendErrors([{label:'同构等比代表态',diagnostics}]);
    expect(hashes()).toEqual(before);
    writeFileSync(`${dir}/geometry.json`,JSON.stringify({entry:url,representative:true,runtime,sourceHashes:before,pc,wide,small,phone,pcPay,phonePay},null,2));
});


test.describe('手机触摸与多牌代表态', () => {
    test.use({ hasTouch: true });
    test('八张支付手牌的首末张可触摸', async ({ page }) => {
        test.setTimeout(210000);
        mkdirSync(dir, { recursive: true });
        const runtime=listRuntimes().find((r: {scope: string})=>r.scope===process.env.PW_RUNTIME_SCOPE);
        expect(runtime).toBeTruthy(); expect(runtime.frontendSourceHash).toBe(getFrontendSourceHash()); expect(sourceIdentityMatches(runtime.sourceIdentity)).toBe(true);
        const before=hashes();
        await setChineseLocale(page); await disableAudio(page); await disableTutorial(page);
        await page.addInitScript(()=>{window.__E2E_TEST_MODE__=true; (window as Window & {__BG_HIDE_DEBUG_PANEL__?: boolean}).__BG_HIDE_DEBUG_PANEL__=true;});
        const diagnostics=attachPageDiagnostics(page);
        await page.setViewportSize({width:936,height:432}); await page.goto(url,{waitUntil:'domcontentloaded'});
        await expect(page.getByTestId('qidahen-board')).toBeVisible({timeout:90000});
        const state=await page.evaluate(()=>window.__BG_TEST_HARNESS__!.state.get() as {core: QidahenCore});
        state.core.handCards=buildDrawnHandCards(state.core as QidahenCore,'ming',5);
        state.core.factions.ming.handCount+=5; state.core.factions.ming.drawPileCount-=5;
        await page.evaluate(value=>window.__BG_TEST_HARNESS__!.state.set(value),state);
        const hand=state.core.handCards.filter((card)=>card.faction==='ming');
        expect(hand).toHaveLength(8);
        await page.setViewportSize({width:1920,height:1080});
        await page.getByRole('button',{name:/征召军队/}).tap();
        const pcStress=await capture(page,'08-桌面八张支付压力态',true);
        await page.setViewportSize({width:936,height:432});
        const phoneStress=await capture(page,'05-手机八张支付压力态',true); compare(pcStress,phoneStress);
        await expect(page.getByTestId('qidahen-action-payment-panel')).toBeVisible();
        const zone=page.getByTestId('qidahen-hand-zone');
        const first=page.getByTestId(`qidahen-hand-card-${hand[0].id}`);
        const last=page.getByTestId(`qidahen-hand-card-${hand[7].id}`);
        const initial=await zone.evaluate((el)=>({left:el.scrollLeft,width:el.clientWidth,scrollWidth:el.scrollWidth}));
        const zb=await zone.boundingBox(); const fb=await first.boundingBox();
        writeFileSync(`${dir}/stress-initial.json`,JSON.stringify({injectedRepresentativeState:true,initial,zone:zb,first:fb},null,2));
        expect(initial.scrollWidth).toBeGreaterThan(initial.width);
        expect(fb!.x).toBeGreaterThanOrEqual(zb!.x-1);
        await first.tap();
        await expect(page.getByTestId('qidahen-action-payment-status')).toContainText('已选 1 / 1 张');
        await first.tap();
        await zone.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
        await expect.poll(()=>zone.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
        const endZone=await zone.boundingBox(); const endCard=await last.boundingBox();
        expect(endCard!.x+endCard!.width).toBeLessThanOrEqual(endZone!.x+endZone!.width+1);
        await last.tap();
        await expect(page.getByTestId('qidahen-action-payment-status')).toContainText('已选 1 / 1 张');
        await page.getByTestId('qidahen-action-payment-cancel').tap();
        await expect(page.getByTestId('qidahen-action-payment-panel')).toHaveCount(0);
        assertNoFatalFrontendErrors([{label:'手机多牌代表态',diagnostics}]);
        expect(hashes()).toEqual(before);
    });
});


test.describe('手机地图原交互可达性', () => {
    test.use({hasTouch:true});
    test('地图平移后可检视原先被手牌覆盖的人口地区', async ({page}) => {
        test.setTimeout(210000);
        mkdirSync(dir,{recursive:true});
        const runtime=listRuntimes().find((r: {scope: string})=>r.scope===process.env.PW_RUNTIME_SCOPE);
        expect(runtime).toBeTruthy(); expect(runtime.frontendSourceHash).toBe(getFrontendSourceHash()); expect(sourceIdentityMatches(runtime.sourceIdentity)).toBe(true);
        const before=hashes();
        await setChineseLocale(page); await disableAudio(page); await disableTutorial(page);
        await page.addInitScript(()=>{window.__E2E_TEST_MODE__=true; (window as Window & {__BG_HIDE_DEBUG_PANEL__?: boolean}).__BG_HIDE_DEBUG_PANEL__=true;});
        await page.setViewportSize({width:936,height:432}); await page.goto(url,{waitUntil:'domcontentloaded'});
        await expect(page.locator('[data-qidahen-map-population]').first()).toBeVisible({timeout:90000});
        const covered=await page.locator('[data-qidahen-map-population][data-population-placement="interior"]').evaluateAll(nodes=>{
            const hand=document.querySelector('[data-testid="qidahen-hand-zone"]')!.getBoundingClientRect();
            return nodes.map(el=>{const r=el.getBoundingClientRect();return {id:el.getAttribute('data-testid')!,x:r.x,y:r.y,width:r.width,height:r.height};})
                .filter(r=>r.x>330&&r.x<600&&r.y>hand.y&&r.y<400).sort((a,b)=>a.y-b.y)[0];
        });
        expect(covered,'常态存在被手牌区域覆盖的指定人口对象').toBeTruthy();
        const marker=page.getByTestId(covered.id);
        const regionId=covered.id.replace('qidahen-map-population-','');
        await page.screenshot({path:`${dir}/09-手机地图浏览前.png`,animations:'disabled'});
        const owner=page.locator('[data-map-zoom]').first();
        const initialZoom=Number(await owner.getAttribute('data-map-zoom'));
        for(let i=0;i<3;i++) await page.getByTestId('qidahen-map-zoom-in').tap();
        await expect.poll(async()=>Number(await owner.getAttribute('data-map-zoom'))).toBeGreaterThan(initialZoom);
        const initialPan=await owner.getAttribute('data-map-pan-y');
        const touch=await page.context().newCDPSession(page);
        const handBox=(await page.getByTestId('qidahen-hand-zone').boundingBox())!;
        const gestures=[];
        for(let attempt=0;attempt<4;attempt++) {
            const rect=(await marker.boundingBox())!;
            if(rect.y+rect.height<handBox.y-20) break;
            const distance=Math.min(140,Math.max(24,rect.y+rect.height-(handBox.y-50)));
            const previousPan=await owner.getAttribute('data-map-pan-y');
            await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:450,y:240}]});
            for(let step=1;step<=12;step++) {
                await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:450,y:240-distance*step/12}]});
                await page.waitForTimeout(16);
            }
            await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
            await expect.poll(()=>owner.getAttribute('data-map-pan-y')).not.toBe(previousPan);
            gestures.push({distance,previousPan,nextPan:await owner.getAttribute('data-map-pan-y')});
        }
        let stillFrames=0;
        for(let frame=0;frame<30&&stillFrames<3;frame++) {
            const previous=Number(await owner.getAttribute('data-map-pan-y'));
            await page.waitForTimeout(100);
            const next=Number(await owner.getAttribute('data-map-pan-y'));
            stillFrames=Math.abs(next-previous)<0.05?stillFrames+1:0;
        }
        expect(stillFrames,'等待真实滑动惯性自然停止').toBe(3);
        const after=(await marker.boundingBox())!;
        const probe=await page.evaluate(({x,y})=>({hits:document.elementsFromPoint(x,y).slice(0,7).map(el=>({tag:el.tagName,id:el.getAttribute('data-testid'),role:el.getAttribute('data-ui-role')})),core:(window.__BG_TEST_HARNESS__!.state.get() as {core: QidahenCore}).core.turnPhase}),{x:after.x+after.width/2,y:after.y+after.height/2});
        writeFileSync(`${dir}/map-reachability-diagnostic.json`,JSON.stringify({regionId,covered,after,handBox,gestures,probe},null,2));
        expect(after.y+after.height).toBeLessThan(handBox.y);
        expect(after.y).toBeGreaterThan(50);
        const point={x:after.x+after.width/2,y:after.y+after.height/2};
        await page.touchscreen.tap(point.x,point.y);
        await expect(owner).toHaveAttribute('data-map-selected',regionId);
        await expect(page.getByTestId('qidahen-map-region-tip')).toBeVisible();
        await page.screenshot({path:`${dir}/10-手机地图平移检视后.png`,animations:'disabled'});
        expect(hashes()).toEqual(before);
        writeFileSync(`${dir}/map-reachability.json`,JSON.stringify({regionId,covered,after,initialZoom,finalZoom:await owner.getAttribute('data-map-zoom'),initialPan,finalPan:await owner.getAttribute('data-map-pan-y'),gestures,sourceHashes:before},null,2));
    });
});
