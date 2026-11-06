import {expectFateHandArtLoaded} from './handVisibility';
import {chooseFateIdentity} from './identitySelection';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {startSourceSession,captureEvidenceSourceIdentity,releaseSourceSession} from '../framework/sourceIdentity';
import path from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {createEvidenceScreenshotRun, getEvidenceScreenshotPathInDirectory, promoteEvidenceScreenshotRun} from '../framework/evidenceScreenshots';
import {assertNoFatalFrontendErrors, attachPageDiagnostics, initContext} from '../helpers/common';
import {FATE_ATTACK_BY_ID} from '../../src/games/fate-domination/data';
import {fateCardImageAsset} from '../../src/games/fate-domination/data/cardArtwork';

test.afterEach(async({context})=>{await releaseSourceSession(context);});

test.use({
    viewport: {width:1920,height:1080},
    launchOptions: process.env.PW_BROWSER_EXECUTABLE
        ? {executablePath:process.env.PW_BROWSER_EXECUTABLE,chromiumSandbox:true}
        : {chromiumSandbox:true},
});

type State={core:any;sys:any};
type Snapshot={visible:Record<string,any>;authoritative:Record<string,any>};
type TraceStep={id:string;action:string;before:Snapshot;after:Snapshot;assertions:Array<{name:string;actual:unknown;expected:unknown}>;chainId?:string};
type HarnessWindow=Window&{__BG_TEST_HARNESS__?:{
    state?:{get?:()=>State;patch?:(patch:unknown)=>Promise<void>;isRegistered?:()=>boolean};
    command?:{dispatch?:(command:{type:string;playerId:string;payload:Record<string,unknown>})=>Promise<void>;isRegistered?:()=>boolean};
}};

const GAME_ID='fate-domination';
// 定向重采只影响媒体；完整交互与原断言仍全部运行。
const CAPTURE_STATES=new Set((process.env.FATE_CAPTURE_STATES??'').split(',').filter(Boolean));
const CHAIN_ID=CAPTURE_STATES.size ? 'fate-inline-play-area-targeted-recapture' : 'fate-inline-play-area-restoration';
const DESKTOP_NORMAL_CHAIN_ID='fate-desktop-narrow-resting-state';
const TOUCH_NORMAL_CHAIN_ID='fate-touch-inspection-close-and-continue';
const cardAssetManifest=JSON.parse(readFileSync('public/assets/i18n/zh-CN/fate-domination/assets-manifest.json','utf8'));
const compressedAssetKey=(assetPath:string)=>{
    const relative=fateCardImageAsset(assetPath).replace('fate-domination/','');
    const slash=relative.lastIndexOf('/');
    return `${relative.slice(0,slash)}/compressed/${relative.slice(slash+1)}`;
};
const diagnoseFateAssetUrl=(rawUrl:string)=>{
    try{
        const pathname=new URL(rawUrl).pathname;
        const marker='/i18n/zh-CN/fate-domination/';
        const markerIndex=pathname.indexOf(marker);
        if(markerIndex<0)return {url:rawUrl,manifestKey:null,manifestPresent:false,localPath:null,localPresent:false};
        const relative=decodeURIComponent(pathname.slice(markerIndex+marker.length));
        const dot=relative.lastIndexOf('.');
        if(dot<=relative.lastIndexOf('/'))return {url:rawUrl,manifestKey:null,manifestPresent:false,localPath:null,localPresent:false};
        const manifestKey=relative.slice(0,dot);
        const variant=relative.slice(dot+1);
        const localPath=path.resolve('public/assets/i18n/zh-CN/fate-domination',relative);
        const manifestEntry=cardAssetManifest.files[manifestKey]??null;
        return {url:rawUrl,manifestKey,variant,manifestPresent:Boolean(manifestEntry?.variants?.[variant]),expected:manifestEntry?.variants?.[variant]??null,localPath,localPresent:existsSync(localPath)};
    }catch{return {url:rawUrl,manifestKey:null,manifestPresent:false,localPath:null,localPresent:false};}
};

async function readState(page:Page){return page.evaluate(()=>{
    const harness=(window as HarnessWindow).__BG_TEST_HARNESS__;
    if(!harness?.state?.get)throw new Error('Fate TestHarness state 未注册');
    return harness.state.get();
});}
async function dispatch(page:Page,type:string,playerId:string,payload:Record<string,unknown>={}){
    await page.evaluate(async command=>{
        const harness=(window as HarnessWindow).__BG_TEST_HARNESS__;
        if(!harness?.command?.dispatch)throw new Error('Fate TestHarness command 未注册');
        await harness.command.dispatch(command);
    },{type,playerId,payload});
}
async function patchState(page:Page,patch:unknown){
    await page.evaluate(async value=>{
        const harness=(window as HarnessWindow).__BG_TEST_HARNESS__;
        if(!harness?.state?.patch)throw new Error('Fate TestHarness state.patch 未注册');
        await harness.state.patch(value);
    },patch);
}
async function waitForState(page:Page,predicate:(state:State)=>boolean,label:string){
    await expect.poll(async()=>predicate(await readState(page)),{message:label,timeout:20000}).toBe(true);
}
function assertion(name:string,actual:unknown,expected:unknown){
    expect(actual,`trace assertion: ${name}`).toEqual(expected);
    return {name,actual,expected};
}
async function snapshot(page:Page):Promise<Snapshot>{
    const state=await readState(page);
    const actor=state.core.players['0'];
    const visible=await page.evaluate(()=>{
        const rect=(selector:string)=>{
            const element=document.querySelector<HTMLElement>(selector);if(!element)return null;
            const r=element.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
        };
        const row=document.querySelector<HTMLElement>('[data-testid="fate-played-cards"]');
        const map=document.querySelector<HTMLElement>('.fd-runtime-map-overlay');
        const mobileShell=document.querySelector<HTMLElement>('.mobile-board-shell');
        const seatList=document.querySelector<HTMLElement>('.fd-runtime-seat-list');
        const rectOf=(element:Element|null)=>{
            if(!element)return null;
            const r=element.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
        };
        const centerHits=(element:Element|null)=>{
            if(!element)return false;
            const r=element.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return Boolean(hit&&(hit===element||element.contains(hit)));
        };
        return {
            viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY},
            playedArea:rect('[data-testid="fate-play-area"]'),
            summary:rect('[data-testid="fate-play-summary"]'),
            playedRow:rect('[data-testid="fate-played-cards"]'),
            attackHand:rect('[data-testid="fate-domination-hand"]'),
            skillZone:rect('.fd-skill-hand-zone'),
            skillHand:rect('.fd-skill-cards'),
            selfDock:rect('.fd-self-dock'),
            masterAbilities:rect('.fd-master-abilities'),
            masterAbilityButtons:Array.from(document.querySelectorAll('.fd-master-ability > button')).map(rectOf),
            selfIdentity:rect('.fd-self-identity'),
            selfSeals:rect('.fd-self-seals'),
            selfSealArtwork:Array.from(document.querySelectorAll<HTMLElement>('.fd-self-seals img, .fd-self-seals [data-card-atlas-frame="true"]')).map(rectOf),
            phaseControl:rect('.fd-phase-control'),
            phaseButton:rect('.fd-phase-control .fd-runtime-primary'),
            selectionMode:document.querySelector('.fd-hand-mode')?.getAttribute('aria-pressed')??null,
            hudFabButtons:Array.from(document.querySelectorAll<HTMLElement>('[data-testid="fab-menu"] button')).filter(element=>getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).pointerEvents!=='none'&&element.getBoundingClientRect().width>0).map(rectOf),
            hudPlayerRows:Array.from(document.querySelectorAll<HTMLElement>('.fd-runtime-seat-row')).map(rectOf),
            playedCard:rect('[data-testid="fate-played-cards"] [data-card-id]'),
            handCard:rect('[data-testid="fate-domination-hand"] [data-card-id]'),
            skillCard:rect('.fd-skill-cards [data-card-id]'),
            attackHandCardCenterHit:centerHits(document.querySelector('[data-testid="fate-domination-hand"] [data-card-zone="hand"]')),
            skillHandCardCenterHit:centerHits(document.querySelector('.fd-skill-cards [data-card-zone="skill"]')),
            phaseControlCenterHit:centerHits(document.querySelector('.fd-phase-control .fd-runtime-primary')),
            phaseControlCenterTarget:(()=>{const element=document.querySelector('.fd-phase-control .fd-runtime-primary');if(!element)return null;const r=element.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,400)??null;})(),
            ridingControls:rect('[data-testid="fate-riding-controls"]'),
            powerFont:getComputedStyle(document.querySelector<HTMLElement>('.fd-play-power')!).fontSize,
            redundantHandHints:document.querySelectorAll('.fd-hand-scroll-hint,.fd-runtime-zone-label').length,
            summaryFont:document.querySelector<HTMLElement>('[data-testid="fate-play-summary"]')?getComputedStyle(document.querySelector<HTMLElement>('[data-testid="fate-play-summary"]')!).fontSize:null,
            playAreaCards:Array.from(document.querySelectorAll<HTMLElement>('[data-testid="fate-played-cards"] [data-card-id]')).map(card=>({id:card.dataset.cardId,zone:card.dataset.cardZone,label:card.getAttribute('aria-label')})),
            cardArtwork:Array.from(document.querySelectorAll<HTMLElement>('[data-testid="fate-played-cards"] [data-card-id]')).map(card=>{
                const frame=card.querySelector<HTMLElement>('[data-card-atlas-frame="true"]');
                const images=Array.from(card.querySelectorAll<HTMLImageElement>('img'));
                return {id:card.dataset.cardId,frameAtlasId:frame?.dataset.cardAtlasId??null,frameIndex:frame?.dataset.cardAtlasIndex??null,frameReady:frame?(!frame.classList.contains('atlas-shimmer')&&Boolean(frame.querySelector('img'))):null,
                    images:images.map(image=>({alt:image.alt,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,src:image.currentSrc||image.src}))};
            }),
            handCount:document.querySelectorAll('[data-testid="fate-domination-hand"] [data-card-id]').length,
            dialogCount:document.querySelectorAll('[role="dialog"]').length,
            galleryTriggerCount:document.querySelectorAll('[data-testid="fate-played-browser-trigger"]').length,
            playerRail:rect('.fd-runtime-player-rail'),
            seatList:rect('.fd-runtime-seat-list'),
            seatListScroll:seatList?{clientHeight:seatList.clientHeight,scrollHeight:seatList.scrollHeight}:null,
            opponentSeats:Array.from(document.querySelectorAll<HTMLElement>('.fd-runtime-seat-list .fd-runtime-seat')).map(seat=>{
                const r=seat.getBoundingClientRect(),list=seatList?.getBoundingClientRect();
                return {name:seat.querySelector('.fd-seat-name')?.textContent?.trim()??null,rect:rectOf(seat),summaryCenterHit:centerHits(seat.querySelector('.fd-runtime-seat-summary')),
                    fullyVisible:Boolean(list&&r.top>=list.top-1&&r.bottom<=list.bottom+1&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight)};
            }),
            inputCapabilities:{maxTouchPoints:navigator.maxTouchPoints,coarsePointer:matchMedia('(pointer: coarse)').matches,hoverPointer:matchMedia('(hover: hover) and (pointer: fine)').matches},
            rowScroll:row?{left:row.getBoundingClientRect().left,right:row.getBoundingClientRect().right,scrollLeft:row.scrollLeft,scrollWidth:row.scrollWidth,clientWidth:row.clientWidth}:null,
            mapTransform:map?.style.transform??null,
            mobileShellTransform:mobileShell?getComputedStyle(mobileShell).transform:null,
            mobileShell:rect('.mobile-board-shell'),
            mapCanvas:rect('[data-testid="fate-pixi-map-canvas"]'),
            boardHasRidingCameraMode:document.querySelector('[data-testid="fate-domination-board"]')?.hasAttribute('data-riding-choice')??false,
            mapSafeStyle:getComputedStyle(document.querySelector<HTMLElement>('.fd-runtime-map')!).getPropertyValue('--fd-map-safe-bottom').trim(),
        };
    });
    return {visible,authoritative:{phase:state.core.phase,currentPlayerId:state.core.currentPlayerId,round:state.core.round,hand:actor.hand.map((card:any)=>({id:card.id,definitionId:card.definitionId})),deckCount:actor.deck.length,selectedAttackIds:[...actor.selectedAttackIds],activeAttackIds:[...actor.activeAttackIds],activeSkills:[...actor.activeSkills],normalAttackPlayed:actor.normalAttackPlayed,interactionId:state.sys.interaction.current?.id??null,interactionSourceId:state.sys.interaction.current?.data?.sourceId??null,activeFrameId:state.sys.resolution?.activeFrameId??null}};
}
function reviewCheck(failures:string[],name:string,condition:boolean,actual:unknown,expected:unknown){
    if(!condition)failures.push(`${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}
function reviewNormalBoardVisibility(snapshot:Snapshot,failures:string[],prefix:string,expectedTouch:boolean){
    const visible=snapshot.visible as any;
    const seats=visible.opponentSeats as Array<{summaryCenterHit:boolean}>;
    reviewCheck(failures,`${prefix}-two-opponent-seats-hittable`,seats.length===2&&seats.every(seat=>seat.summaryCenterHit),seats,'two live opponent summary targets');
    reviewCheck(failures,`${prefix}-phase-control-hittable`,visible.phaseControlCenterHit,visible.phaseControlCenterHit,true);
    reviewCheck(failures,`${prefix}-attack-and-skill-hand-hit-targets`,visible.attackHandCardCenterHit&&visible.skillHandCardCenterHit,{attack:visible.attackHandCardCenterHit,skill:visible.skillHandCardCenterHit},'live attack and skill targets');
    reviewCheck(failures,`${prefix}-touch-capability-matches-scene`,expectedTouch?visible.inputCapabilities.maxTouchPoints>0&&visible.inputCapabilities.coarsePointer&&!visible.inputCapabilities.hoverPointer:visible.inputCapabilities.hoverPointer,{expectedTouch,inputCapabilities:visible.inputCapabilities},expectedTouch?'touch/coarse pointer without desktop hover':'fine hover pointer');
}
function loadedPlayedCardArt(snapshot:Snapshot){
    const cards=(snapshot.visible as any).cardArtwork as Array<{frameReady:boolean|null;images:Array<{complete:boolean;naturalWidth:number;naturalHeight:number}>}>;
    return cards.length>0&&cards.every(card=>card.frameReady===null
        ?card.images.length>0&&card.images.every(image=>image.complete&&image.naturalWidth>0&&image.naturalHeight>0)
        :card.frameReady&&card.images.length>0&&card.images.every(image=>image.complete&&image.naturalWidth>0&&image.naturalHeight>0));
}

test('Fate 攻击牌在原位打出与撤回，出牌区密集时相机仍独立',async({page,context,browser,baseURL},testInfo)=>{
    test.setTimeout(300000);
    page.setDefaultTimeout(15000);
    await initContext(context,{skipImageGate:false});
    await startSourceSession(context,baseURL!);
    const diagnostics={...attachPageDiagnostics(page),page};
    const pageImageResponses:Array<{url:string;status:number;ok:boolean;contentType:string|null}> = [];
    const pageImageFailures:Array<{url:string;error:string|null}> = [];
    const cardImageResponses:Array<{url:string;status:number;ok:boolean;contentType:string|null}> = [];
    const cardImageFailures:Array<{url:string;error:string|null}> = [];
    const isFateCardImage=(url:string)=>/\/fate-domination\/cards\//i.test(url);
    page.on('response',response=>{
        const request=response.request();
        if(request.resourceType()!=='image')return;
        const item={url:response.url(),status:response.status(),ok:response.ok(),contentType:response.headers()['content-type']??null};
        pageImageResponses.push(item);
        if(isFateCardImage(response.url()))cardImageResponses.push(item);
    });
    page.on('requestfailed',request=>{
        if(request.resourceType()!=='image')return;
        const item={url:request.url(),error:request.failure()?.errorText??null};
        pageImageFailures.push(item);
        if(isFateCardImage(request.url()))cardImageFailures.push(item);
    });
    const run=await createEvidenceScreenshotRun(testInfo,{requireChineseName:true});
    const screenshots:Array<{name:string;path:string;stepId:string;reason:string;viewport:string;chainId:string}> = [];
    const steps:TraceStep[]=[];
    const behaviorFailures:string[]=[];
    const measuredEvidence:Record<string,unknown>={};
    const capture=async(name:string,stepId:string,reason:string,viewport='desktop',capturePage:Page=page,chainId=CHAIN_ID)=>{
        if(CAPTURE_STATES.size && !CAPTURE_STATES.has(stepId))return;
        const imagePath=getEvidenceScreenshotPathInDirectory(run.stagingDir,`${name}.png`,{requireChineseName:true});
        await mkdir(path.dirname(imagePath),{recursive:true});
        await capturePage.screenshot({path:imagePath,fullPage:false,animations:'disabled'});
        const viewportClass=viewport.startsWith('mobile')?'mobile':'desktop';
        screenshots.push({name,path:imagePath,stepId,reason,viewport:viewportClass,chainId});
    };

    await page.goto(`${baseURL??''}/play/fate-domination?players=3&playerID=0&seed=iskandar-riding-ui-0&disableLocalAiAutomation=true`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{
        const harness=(window as HarnessWindow).__BG_TEST_HARNESS__;
        return harness?.state?.isRegistered?.()===true&&harness?.command?.isRegistered?.()===true;
    },undefined,{timeout:20000});
    await expect(page.getByTestId('fate-domination-board')).toBeVisible({timeout:20000});
    await chooseFateIdentity(page,'master','m_waver');
    await chooseFateIdentity(page,'servant','servant-rider');
    await page.getByTestId('fate-domination-primary-action').click();
    await waitForState(page,state=>state.core.phase==='preparation'&&state.core.currentPlayerId==='1','本人确认角色后进入下一席准备');
    await dispatch(page,'ADVANCE_PHASE','1');
    await waitForState(page,state=>state.core.phase==='preparation'&&state.core.currentPlayerId==='2','第二席准备');
    await dispatch(page,'ADVANCE_PHASE','2');
    await waitForState(page,state=>state.core.phase==='outpost'&&state.core.currentPlayerId==='0','进入前哨阶段');
    await page.getByTestId('fate-domination-location-workshop').click();
    await waitForState(page,state=>state.core.players['0'].locationId==='workshop','本人部署在魔术工房');
    const beforeUnavailable=(await readState(page)).core;
    for(const [selector,key] of [['.fd-attack-cards button','unavailable-attack-toast'],['.fd-skill-cards button','unavailable-skill-toast']]){
        const beforeAttempt=await snapshot(page);
        const box=await page.locator(selector).first().boundingBox();
        await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);
        await expect(page.getByText('请在行动阶段出牌。',{exact:true})).toBeVisible();
        expect((await readState(page)).core).toEqual(beforeUnavailable);
        const afterAttempt=await snapshot(page);
        steps.push({id:key,action:`前哨阶段点击${selector}，显示拒绝原因并保持权威状态`,before:beforeAttempt,after:afterAttempt,assertions:[assertion('authority-unchanged',afterAttempt.authoritative,beforeAttempt.authoritative),assertion('visible-rejection-reason',await page.getByText('请在行动阶段出牌。',{exact:true}).isVisible(),true)]});
        if(key==='unavailable-attack-toast')await capture('前哨不可出牌的拒绝原因',key,'普通牌与技能点击均在行为记录核对；同构阶段拒绝toast只保留一张图，权威状态不变。');
    }
    await page.getByRole('button',{name:/查看玩家\s*1详情/}).click();
    await expect(page.getByRole('dialog',{name:'韦伯·维尔维特详情'})).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button',{name:/^发动/})).toHaveCount(0);
    await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();
    const handBeforeMasterAbility=(await readState(page)).core.players['0'].hand.length;
    await page.getByRole('button',{name:'发动战略部署'}).click();
    await waitForState(page,state=>state.core.players['0'].hand.length>=handBeforeMasterAbility+2,'行动阶段前实际使用战略部署抽两张牌');
    await page.getByTestId('fate-domination-primary-action').click();
    await waitForState(page,state=>state.core.phase==='outpost'&&state.core.currentPlayerId==='1','本人结束前哨阶段');
    await dispatch(page,'DEPLOY_MASTER','1',{locationId:'workshop'});
    await dispatch(page,'ADVANCE_PHASE','1');
    await waitForState(page,state=>state.core.phase==='outpost'&&state.core.currentPlayerId==='2','第二席结束前哨阶段');
    await dispatch(page,'DEPLOY_MASTER','2',{locationId:'workshop'});
    await dispatch(page,'ADVANCE_PHASE','2');
    await waitForState(page,state=>state.core.phase==='action'&&state.core.currentPlayerId==='0','本人进入行动阶段');
    const beforeDarkSkill=await snapshot(page);
    await page.getByRole('button',{name:'暗置选牌',exact:true}).click();
    const darkSkill=await page.locator('.fd-skill-cards .fd-runtime-card').first().boundingBox();
    await page.mouse.click(darkSkill!.x+darkSkill!.width/2,darkSkill!.y+darkSkill!.height/2);
    await expect(page.getByText('技能牌不能暗置，请切回明置选牌。',{exact:true})).toBeVisible();
    const afterDarkSkill=await snapshot(page);
    expect(afterDarkSkill.authoritative).toEqual(beforeDarkSkill.authoritative);
    steps.push({id:'skill-face-down-refused',action:'切换暗置后点技能牌，显示明确拒绝原因，不静默改为明置出牌',before:beforeDarkSkill,after:afterDarkSkill,assertions:[assertion('authority-unchanged',afterDarkSkill.authoritative,beforeDarkSkill.authoritative),assertion('mode-remains-face-down',afterDarkSkill.visible.selectionMode,'true')]});
    await capture('技能不能暗置的拒绝原因','skill-face-down-refused','暗置模式点击技能牌会提示切回明置，不改变权威状态，也不静默打出。');
    await page.getByRole('button',{name:'暗置选牌',exact:true}).click();

    const empty=await snapshot(page);
    expect(empty.visible.playedArea).not.toBeNull();
    expect(empty.visible.summary).not.toBeNull();
    expect(empty.visible.playAreaCards).toEqual([]);
    expect(empty.visible.dialogCount).toBe(0);
    expect(empty.visible.galleryTriggerCount).toBe(0);
    expect(empty.visible.mapCanvas).not.toBeNull();
    measuredEvidence.emptyHandDesktop={viewport:empty.visible.viewport,playedRow:empty.visible.playedRow,selfDock:empty.visible.selfDock,phaseControl:empty.visible.phaseControl,skillZone:empty.visible.skillZone,summary:empty.visible.summary};
    await capture('行动手牌与原位出牌区','empty-play-area','行动阶段基础布局：空出牌区和固定威力读数同屏呈现，地图独立铺满视口。');

    const candidates=page.getByTestId('fate-domination-hand').locator('[data-card-zone="hand"][aria-disabled="false"]');
    if(await candidates.count()===0)throw new Error('真实手牌中无可选攻击，无法执行本体打出/撤回链');
    const card= candidates.first();
    const cardId=await card.getAttribute('data-card-id');
    if(!cardId)throw new Error('首张可选攻击缺少实例ID');
    const beforeMagnify=await snapshot(page);
    await card.hover();
    const magnify=card.locator('..').getByTestId('card-inspect-button');
    await expect(magnify).toBeVisible();
    await capture('手牌悬浮通用放大镜，卡牌主操作仍独立','desktop-card-magnifier','悬浮手牌后右上出现通用放大镜，本体仍承接选牌。');
    await magnify.click();
    await expect(page.getByRole('dialog',{name:/卡牌检视/})).toBeVisible();
    expect((await snapshot(page)).authoritative).toEqual(beforeMagnify.authoritative);
    await page.getByTestId('fate-inspection-close').click();
    await expect(page.getByRole('dialog',{name:/卡牌检视/})).toHaveCount(0);
    steps.push({id:'desktop-card-magnifier',action:'悬浮手牌并点击通用放大镜，关闭后回到同一牌桌',before:beforeMagnify,after:await snapshot(page),assertions:[assertion('magnifier-does-not-select-pay-or-activate',(await snapshot(page)).authoritative,beforeMagnify.authoritative)]});
    const beforeSelect=await snapshot(page);
    const mapBefore=beforeSelect.visible.mapTransform;
    await card.click();
    await expect(page.getByTestId('fate-played-cards').locator(`[data-card-id="${cardId}"]`)).toHaveAttribute('data-card-zone','staged');
    await expect(page.getByTestId('fate-played-cards').locator(`[data-card-id="${cardId}"]`)).toBeVisible();
    const staged=await snapshot(page);
    expect(staged.visible.playAreaCards.some((item:any)=>item.id===cardId&&item.zone==='staged')).toBe(true);
    expect(staged.visible.handCount).toBe(beforeSelect.visible.handCount as number-1);
    expect(staged.visible.mapTransform).toBe(mapBefore);
    await capture('攻击牌本体暂选于牌区','staged-card-in-place','同一张真实手牌被暂选后移动到手牌上方的攻击牌区，卡牌本体仍是撤回入口。');
    steps.push({id:'stage-real-card',action:'在真实攻击手牌点击一张可选实例',before:beforeSelect,after:staged,assertions:[
        assertion('draft-does-not-mutate-authoritative-state',staged.authoritative,beforeSelect.authoritative),
        assertion('same-instance-staged-in-play-area',staged.visible.playAreaCards.some((item:any)=>item.id===cardId&&item.zone==='staged'),true),
        assertion('instance-removed-from-unselected-hand',staged.visible.handCount,beforeSelect.visible.handCount as number-1),
        assertion('map-camera-unchanged-by-card-selection',staged.visible.mapTransform,mapBefore),
        assertion('no-gallery-window-created',staged.visible.galleryTriggerCount,0),
    ]});

    const stagedCard=page.getByTestId('fate-played-cards').locator(`[data-card-id="${cardId}"]`);
    await stagedCard.click();
    await expect(page.getByTestId('fate-domination-hand').locator(`[data-card-id="${cardId}"]`)).toHaveAttribute('data-card-zone','hand');
    await expect(page.getByTestId('fate-domination-hand').locator(`[data-card-id="${cardId}"]`)).toBeVisible();
    const retracted=await snapshot(page);
    expect(retracted.visible.playAreaCards.some((item:any)=>item.id===cardId)).toBe(false);
    expect(retracted.visible.handCount).toBe(beforeSelect.visible.handCount);
    expect(retracted.visible.mapTransform).toBe(mapBefore);
    steps.push({id:'retract-real-card',action:'点击原位暂选牌本体撤回并回到攻击手牌',before:staged,after:retracted,assertions:[
        assertion('retraction-does-not-mutate-authoritative-state',retracted.authoritative,beforeSelect.authoritative),
        assertion('instance-left-play-area',retracted.visible.playAreaCards.some((item:any)=>item.id===cardId),false),
        assertion('same-instance-returned-to-hand',retracted.visible.handCount,beforeSelect.visible.handCount),
        assertion('map-camera-still-unchanged',retracted.visible.mapTransform,mapBefore),
    ]});

    await page.getByRole('button',{name:'使用令咒'}).click();
    await expect(page.getByRole('dialog',{name:'使用令咒'})).toBeVisible();
    await page.getByRole('button',{name:'恢复魔力'}).click();
    await page.getByRole('button',{name:'确认使用'}).click();
    await waitForState(page,state=>state.core.players['0'].mana>=8,'通过真实令咒恢复魔力以激活骑乘技能');
    const riderSkillId=(await readState(page)).core.players['0'].skills.find((skill:any)=>skill.id.split(':')[0]==='sc_iskandar_1')?.id;
    if(!riderSkillId)throw new Error('当前已选伊斯坎达尔但角色牌没有骑乘技能实例');
    await page.getByRole('button',{name:'选择 骑乘'}).click();
    const attackPartners=page.getByTestId('fate-domination-hand').locator('[data-card-zone="hand"][aria-disabled="false"]');
    if(await attackPartners.count()===0)throw new Error('选入骑乘技能后没有合法基础攻击搭档');
    const riderPartnerId=await attackPartners.first().getAttribute('data-card-id');
    if(!riderPartnerId)throw new Error('可用基础攻击搭档缺少实例ID');
    await attackPartners.first().click();
    await expect(page.getByTestId('fate-domination-primary-action')).toHaveAttribute('aria-label','确认攻击');
    await page.getByTestId('fate-domination-primary-action').click();
    await waitForState(page,state=>state.core.players['0'].normalAttackPlayed
        &&state.core.players['0'].activeSkills.includes(riderSkillId),'以真实普通攻击批次激活骑乘技能');
    expect((await readState(page)).core.players['0'].activeAttackIds).toContain(riderPartnerId);
    const beforeOpenRiding=await snapshot(page);
    await page.getByRole('button',{name:'发动 骑乘'}).click();
    await expect(page.getByTestId('fate-riding-controls')).toBeVisible();
    await expect(page.getByTestId('fate-riding-confirm')).toBeVisible();
    await expect(page.getByTestId('fate-riding-cancel')).toBeVisible();
    const ridingOpen=await snapshot(page);
    expect(ridingOpen.authoritative.interactionSourceId).toBe('fate:riding-choice');
    expect(ridingOpen.authoritative.phase).toBe('action');
    expect(ridingOpen.visible.mapTransform).toBe(beforeOpenRiding.visible.mapTransform);
    await capture('发动骑乘后进入的手牌选择态','riding-choice-controls','普通攻击批次激活伊斯坎达尔的骑乘技能后，玩家在原手牌区看到多选、费用和确认/取消操作。');
    steps.push({id:'open-riding-choice',action:'通过真实攻击批次激活骑乘技能，再点击技能卡发动',before:beforeOpenRiding,after:ridingOpen,assertions:[
        assertion('riding-choice-opened-from-card',ridingOpen.authoritative.interactionSourceId,'fate:riding-choice'),
        assertion('riding-choice-remains-in-action-phase',ridingOpen.authoritative.phase,'action'),
        assertion('confirm-and-cancel-controls-present',Boolean(ridingOpen.visible.ridingControls),true),
        assertion('riding-does-not-change-map-pose',ridingOpen.visible.mapTransform,beforeOpenRiding.visible.mapTransform),
    ]});
    await page.getByTestId('fate-riding-cancel').click();
    await expect(page.getByTestId('fate-riding-controls')).toHaveCount(0);
    const afterRidingCancel=await snapshot(page);
    expect(afterRidingCancel.authoritative.interactionSourceId).toBeNull();
    expect(afterRidingCancel.authoritative.activeFrameId).toBeNull();
    steps.push({id:'cancel-riding-choice',action:'关闭骑乘选择事务后继续布局检查',before:ridingOpen,after:afterRidingCancel,assertions:[
        assertion('cancel-closes-choice-controls',Boolean(afterRidingCancel.visible.ridingControls),false),
        assertion('cancel-closes-riding-interaction',afterRidingCancel.authoritative.interactionSourceId,null),
        assertion('cancel-clears-resolution-frame',afterRidingCancel.authoritative.activeFrameId,null),
    ]});

    const state=await readState(page);
    const naturalActionPlayer=structuredClone(state.core.players['0']);
    const allCards=[...state.core.players['0'].hand,...state.core.players['0'].deck];
    const denseCards=allCards.slice(0,20);
    const missingLiveAssets=allCards.filter((item:any)=>!cardAssetManifest.files[compressedAssetKey(FATE_ATTACK_BY_ID[item.definitionId]?.assetPath??'')]);
    expect(missingLiveAssets.map((item:any)=>item.definitionId),'当前真实手牌/牌库引用的正式卡图资源').toEqual([]);
    const definitions=Object.values(FATE_ATTACK_BY_ID)
        .filter(definition=>Boolean(cardAssetManifest.files[compressedAssetKey(definition.assetPath)]))
        .map(definition=>definition.id);
    if(!definitions.length)throw new Error('当前没有可用的正式攻击牌定义');
    while(denseCards.length<20){
        const index=denseCards.length-allCards.length;
        denseCards.push({id:`layout-fixture-attack-${index+1}`,definitionId:definitions[index%definitions.length]});
    }
    const remaining=allCards.slice(Math.min(20,allCards.length));
    const beforeDense=await snapshot(page);

    await patchState(page,{core:{players:{'0':{hand:denseCards,deck:remaining,selectedAttackIds:[],activeAttackIds:denseCards.map((item:any)=>item.id),activeSkills:[],normalAttackPlayed:true}}}});
    await waitForState(page,s=>s.core.players['0'].activeAttackIds.length===20,'正式牌定义与真实实例进入密集出牌代表态');
    const dense=await snapshot(page);
    expect(dense.visible.playAreaCards).toHaveLength(20);
    expect(dense.visible.dialogCount).toBe(0);
    expect(dense.visible.galleryTriggerCount).toBe(0);
    expect(dense.visible.mapTransform).toBe(mapBefore);
    try{
        await expect.poll(async()=>loadedPlayedCardArt(await snapshot(page)),{message:'20张原位牌面全部加载正式图像且没有破图',timeout:20000}).toBe(true);
    }catch(error){
        let diagnostic:unknown;
        try{
            const finalSnapshot=await snapshot(page);
            const cardUrls=new Set((finalSnapshot.visible as any).cardArtwork.flatMap((card:any)=>card.images.map((image:any)=>image.src)));
            diagnostic={
                fixtureCards:denseCards.map((card:any)=>{
                    const assetPath=FATE_ATTACK_BY_ID[card.definitionId]?.assetPath??null;
                    const key=assetPath?compressedAssetKey(assetPath):null;
                    const manifestEntry=key?cardAssetManifest.files[key]:null;
                    const localPaths=key?Object.keys(manifestEntry?.variants??{}).map(variant=>path.resolve('public/assets/i18n/zh-CN/fate-domination',`${key}.${variant}`)):[];
                    return {instanceId:card.id,definitionId:card.definitionId,assetPath,manifestKey:key,manifestPresent:Boolean(manifestEntry),localAssetPaths:localPaths,localAssetsPresent:localPaths.map(localPath=>existsSync(localPath))};
                }),
                displayedCards:(finalSnapshot.visible as any).cardArtwork,
                allDisplayedImages:await page.evaluate(()=>Array.from(document.images).map(image=>{
                    const rect=image.getBoundingClientRect();
                    return {alt:image.alt,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,
                        src:image.currentSrc||image.src,visible:Boolean(rect.width&&rect.height&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth),
                        rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}};
                })),
                visibleAtlasFrames:await page.locator('[data-card-atlas-frame="true"]').evaluateAll(frames=>frames.map(frame=>({
                    atlasId:(frame as HTMLElement).dataset.cardAtlasId??null,
                    atlasIndex:(frame as HTMLElement).dataset.cardAtlasIndex??null,
                    className:(frame as HTMLElement).className,
                    containsImage:Boolean(frame.querySelector('img')),
                }))),
                allImageResponses:pageImageResponses.map(item=>({...item,asset:diagnoseFateAssetUrl(item.url)})),
                allImageFailures:pageImageFailures.map(item=>({...item,asset:diagnoseFateAssetUrl(item.url)})),
                matchingResponses:cardImageResponses.filter(item=>cardUrls.has(item.url)),
                matchingFailures:cardImageFailures.filter(item=>cardUrls.has(item.url)),
                allCardImageResponses:cardImageResponses,
                allCardImageFailures:cardImageFailures,
                resourceTiming:await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>/\/fate-domination\/cards\//i.test(entry.name)).map(entry=>({url:entry.name,duration:entry.duration,transferSize:(entry as PerformanceResourceTiming).transferSize,responseStatus:(entry as any).responseStatus??null}))),
                originalFailure:String(error),
            };
        }catch(captureError){diagnostic={captureError:String(captureError),originalFailure:String(error)};}
        const body=Buffer.from(JSON.stringify(diagnostic,null,2));
        await testInfo.attach('twenty-card-artwork-diagnostics.json',{body,contentType:'application/json'});
        console.error('[twenty-card-artwork-diagnostics]',body.toString('utf8'));
        throw error;
    }
    reviewCheck(behaviorFailures,'twenty-cards-have-complete-artwork',loadedPlayedCardArt(dense),(dense.visible as any).cardArtwork,'each displayed image complete with natural dimensions');
    const first=page.getByTestId('fate-played-cards').locator('[data-card-id]').first();
    const last=page.getByTestId('fate-played-cards').locator('[data-card-id]').last();
    await first.focus();
    const focusTrace:unknown[]=[];
    // 每张牌的独立放大镜也是键盘焦点；逐次 Tab 直至抵达末张牌。
    for(let index=0;index<40 && !await last.evaluate(element=>document.activeElement===element);index++){
        await page.keyboard.press('Tab');
        focusTrace.push(await page.evaluate(()=>({active:(document.activeElement as HTMLElement)?.dataset.cardId,
            cards:Array.from(document.querySelectorAll('[data-testid="fate-played-cards"] [data-card-id]')).map(card=>({id:(card as HTMLElement).dataset.cardId,tabIndex:(card as HTMLElement).tabIndex})),
        })));
    }
    await writeFile(testInfo.outputPath('dense-keyboard-focus.json'),JSON.stringify(focusTrace,null,2));
    await testInfo.attach('dense-keyboard-focus.json',{body:Buffer.from(JSON.stringify(focusTrace,null,2)),contentType:'application/json'});
    await expect(last).toBeFocused();
    const denseScrolled=await snapshot(page);
    expect(denseScrolled.visible.viewport.scrollY).toBe(0);
    const lastBox=await last.boundingBox();
    expect(lastBox).not.toBeNull();
    measuredEvidence.desktopTwentyCards={viewport:denseScrolled.visible.viewport,playedRow:denseScrolled.visible.playedRow,selfDock:denseScrolled.visible.selfDock,phaseControl:denseScrolled.visible.phaseControl,skillZone:denseScrolled.visible.skillZone,rowScroll:denseScrolled.visible.rowScroll,visibleCards:denseScrolled.visible.cardArtwork,allVisibleCardArtLoaded:loadedPlayedCardArt(denseScrolled)};
    await capture('二十张正式牌定义的出牌区容量代表态','twenty-inline-played-cards','容量代表态：20张已打出实例在同一牌区重叠，无滚动条；聚焦抬牌可读。部分实例由夹具补齐，不代表自然对局。');
    steps.push({id:'dense-direct-card-zone',action:'以真实牌库实例构造20张代表态并用键盘浏览至第20张',before:beforeDense,after:denseScrolled,assertions:[
        assertion('twenty-real-instances-in-direct-zone',denseScrolled.visible.playAreaCards.length,20),
        assertion('keyboard-reaches-card-twenty',await last.evaluate(element=>document.activeElement===element),true),
        assertion('document-does-not-scroll-on-card-focus',denseScrolled.visible.viewport.scrollY,0),
        assertion('map-camera-not-refit-by-played-count',denseScrolled.visible.mapTransform,mapBefore),
        assertion('no-gallery-window-created',denseScrolled.visible.galleryTriggerCount,0),
    ]});

    const denseState=await readState(page);
    const beforePressure=await snapshot(page);
    const pressureCards=allCards.slice(0,Math.min(10,allCards.length));
    await page.mouse.move(8,8);
    await patchState(page,{core:{players:{'0':{hand:pressureCards,deck:allCards.slice(pressureCards.length),selectedAttackIds:[],activeAttackIds:[],activeSkills:[],normalAttackPlayed:false}}}});
    const pressureRow=page.getByTestId('fate-domination-hand');
    await expect(pressureRow.locator('[data-card-id]')).toHaveCount(pressureCards.length);
    await expect(page.locator('.fd-inspection-hover')).toHaveCount(0);
    const pressureBoxes=await pressureRow.locator('[data-card-id]').evaluateAll(cards=>cards.map(card=>{const box=card.getBoundingClientRect();return {left:box.left,right:box.right,bottom:box.bottom,width:box.width};}));
    measuredEvidence.pressureHand={cards:pressureBoxes,row:await pressureRow.evaluate(element=>({scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,overflowX:getComputedStyle(element).overflowX}))};
    await capture('十张真实牌实例在手牌中重叠贴底','saturated-attack-hand','容量代表态：把本人真实牌库实例移入手牌，保持完整牌宽、重叠且卡面贴底，无横向滚动条。');
    steps.push({id:'saturated-attack-hand',action:'容量代表态：本人真实牌库中的十张实例进入手牌，核对重叠、贴底和无滚动条',before:beforePressure,after:await snapshot(page),assertions:[assertion('real-card-instance-count',pressureBoxes.length,pressureCards.length)]});
    await patchState(page,{core:{players:{'0':denseState.core.players['0']}}});
    await page.mouse.click(8,8);
    await expect(page.locator('.fd-inspection-hover')).toHaveCount(0);
    const beforeEmptyHand=await snapshot(page);
    await patchState(page,{core:{players:{'0':{hand:[],selectedAttackIds:[],activeAttackIds:[],activeSkills:[],normalAttackPlayed:true}}}});
    await waitForState(page,state=>state.core.players['0'].hand.length===0&&state.core.players['0'].activeAttackIds.length===0,'空攻击手牌状态仅用于布局几何复核');
    const emptyHand=await snapshot(page);
    const emptyArea=(emptyHand.visible as any).playedArea;
    const emptyRow=(emptyHand.visible as any).playedRow;
    await expect(page.getByText('暂无攻击手牌',{exact:true})).toBeVisible();
    await capture('空攻击手牌仍留在独立攻击区','empty-attack-hand','布局代表态：空攻击手牌时攻击区宽度仍被HUD两侧轨道约束，不扩到本人HUD或操作区。');
    steps.push({id:'empty-attack-hand',action:'以布局起点注入空攻击手牌代表态并测量同一出牌区与HUD边界',before:beforeEmptyHand,after:emptyHand,assertions:[
        assertion('empty-hand-row-does-not-block-map',await page.getByTestId('fate-played-cards').evaluate(element=>getComputedStyle(element).pointerEvents),'none'),
    ]});
    await patchState(page,{core:{players:{'0':{
        hand:denseState.core.players['0'].hand,deck:denseState.core.players['0'].deck,
        selectedAttackIds:denseState.core.players['0'].selectedAttackIds,activeAttackIds:denseState.core.players['0'].activeAttackIds,
        activeSkills:denseState.core.players['0'].activeSkills,normalAttackPlayed:denseState.core.players['0'].normalAttackPlayed,
    }}}});
    await waitForState(page,state=>state.core.players['0'].activeAttackIds.length===20,'恢复20张密集浏览代表态');

    await page.setViewportSize({width:936,height:432});
    await expect.poll(async()=>(await snapshot(page)).visible.viewport.width).toBe(936);
    const narrow=await snapshot(page);
    expect(narrow.visible.playAreaCards).toHaveLength(20);
    expect(narrow.visible.attackHand).not.toBeNull();
    expect(narrow.visible.skillZone).not.toBeNull();
    expect(narrow.visible.playedArea).not.toBeNull();
    expect(narrow.visible.dialogCount).toBe(0);
    reviewCheck(behaviorFailures,'redundant-hand-hints-removed',narrow.visible.redundantHandHints===0,narrow.visible.redundantHandHints,0);
    expect(narrow.visible.mobileShell).not.toBeNull();
    expect(narrow.authoritative.activeAttackIds).toHaveLength(20);
    reviewCheck(behaviorFailures,'mobile-twenty-cards-have-complete-artwork',loadedPlayedCardArt(narrow),(narrow.visible as any).cardArtwork,'each displayed image complete with natural dimensions');
    measuredEvidence.mobileDense={viewport:narrow.visible.viewport,playedRow:narrow.visible.playedRow,selfDock:narrow.visible.selfDock,phaseControl:narrow.visible.phaseControl,skillZone:narrow.visible.skillZone,attackHand:narrow.visible.attackHand,summary:narrow.visible.summary,skillHand:narrow.visible.skillHand,summaryFontPx:narrow.visible.summaryFont,playedCard:narrow.visible.playedCard,phaseButton:narrow.visible.phaseButton,mobileShell:narrow.visible.mobileShell,mobileShellTransform:narrow.visible.mobileShellTransform,mapTransform:narrow.visible.mapTransform,cardArtwork:narrow.visible.cardArtwork,allVisibleCardArtLoaded:loadedPlayedCardArt(narrow)};
    await capture('窄横屏手牌与出牌分区','narrow-landscape-density','936×432窄横屏使用真实视口CSS尺寸呈现；攻击与技能在各自牌区内重叠，保持可检视的真实牌宽，无滚动条。','mobile-landscape');
    steps.push({id:'narrow-viewport',action:'窗口缩至936×432并复核真实视口布局与地图相机按视口适配',before:denseScrolled,after:narrow,assertions:[
        assertion('narrow-viewport-size',narrow.visible.viewport,{width:936,height:432,scrollX:0,scrollY:0}),
        assertion('twenty-cards-still-in-play-area',narrow.visible.playAreaCards.length,20),
        assertion('attack-and-skill-zones-remain-distinct',Boolean(narrow.visible.attackHand)&&Boolean(narrow.visible.skillZone),true),
        assertion('mobile-map-pose-is-recorded-after-viewport-fit',typeof narrow.visible.mapTransform,'string'),
        assertion('no-gallery-window-created',narrow.visible.galleryTriggerCount,0),
    ]});

    const target=page.getByTestId('fate-played-cards').locator('[data-card-id]').first();
    await target.focus();
    const hoverPreviewPointerEvents=await page.locator('.fd-inspection-hover').evaluate(element=>getComputedStyle(element).pointerEvents);
    reviewCheck(behaviorFailures,'hover-preview-does-not-intercept-card-action',hoverPreviewPointerEvents==='none',hoverPreviewPointerEvents,'none');
    const targetBox=await target.boundingBox();
    expect(targetBox).not.toBeNull();
    const targetHit=await page.evaluate(({x,y})=>{
        const hit=document.elementFromPoint(x,y);const target=document.querySelector<HTMLElement>('[data-testid="fate-played-cards"] [data-card-id]');
        return Boolean(hit&&target&&(hit===target||target.contains(hit)));
    },{x:targetBox!.x+targetBox!.width/2,y:targetBox!.y+targetBox!.height/2});
    reviewCheck(behaviorFailures,'mobile-played-card-center-hits-card',targetHit,targetHit,true);
    await target.click();
    await expect(page.getByRole('dialog',{name:/卡牌检视/})).toBeVisible();
    const inspectionFace=page.getByTestId('fate-inspection-card-face');
    const inspectionBox=await inspectionFace.boundingBox();
    const inspectionClose=page.getByTestId('fate-inspection-close');
    const closeBox=await inspectionClose.boundingBox();
    const inspectionMetrics={face:inspectionBox,close:closeBox,fonts:await page.evaluate(()=>{
        const title=document.querySelector<HTMLElement>('.fd-runtime-inspection');
        const button=document.querySelector<HTMLElement>('[data-testid="fate-inspection-close"]');
        return {title:title?getComputedStyle(title).fontSize:null,button:button?getComputedStyle(button).fontSize:null};
    })};
    const inspectionImages=await inspectionFace.locator('img').evaluateAll(images=>images.map(image=>({complete:(image as HTMLImageElement).complete,width:(image as HTMLImageElement).naturalWidth,height:(image as HTMLImageElement).naturalHeight,alt:(image as HTMLImageElement).alt})));
    reviewCheck(behaviorFailures,'mobile-inspection-art-loaded',inspectionImages.length>0&&inspectionImages.every(image=>image.complete&&image.width>0&&image.height>0),inspectionImages,'complete image with natural dimensions');
    const closeHit=closeBox?await inspectionClose.evaluate(element=>{
        const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return hit===element||element.contains(hit);
    }):false;
    reviewCheck(behaviorFailures,'inspection-close-center-hits-close-button',closeHit,closeHit,true);
    if(closeBox)await page.mouse.click(closeBox.x+closeBox.width/2,closeBox.y+closeBox.height/2);
    else await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog',{name:/卡牌检视/})).toHaveCount(0);
    reviewCheck(behaviorFailures,'inspection-close-restores-source-focus',await target.evaluate(element=>document.activeElement===element),await target.evaluate(element=>document.activeElement===element),true);
    const afterInspection=await snapshot(page);
    const focusReturned=await target.evaluate(element=>document.activeElement===element);
    measuredEvidence.mobileCardInspection={viewport:narrow.visible.viewport,faceRect:inspectionBox,closeButtonRect:closeBox,titleFontPx:inspectionMetrics.fonts.title,closeButtonFontPx:inspectionMetrics.fonts.button,artwork:inspectionImages,cardCenterHit:targetHit,closeCenterHit:closeHit,hoverPreviewPointerEvents,focusReturned,mapTransformBefore:narrow.visible.mapTransform,mapTransformAfter:afterInspection.visible.mapTransform};
    reviewCheck(behaviorFailures,'inspection-does-not-refit-mobile-map',afterInspection.visible.mapTransform===narrow.visible.mapTransform,
        {before:narrow.visible.mapTransform,after:afterInspection.visible.mapTransform},'same map pose within the unchanged viewport');
    steps.push({id:'mobile-full-card-inspection',action:'在实际视口对可见出牌卡使用右键打开整卡检视，再点击真实关闭按钮返回牌区',before:narrow,after:afterInspection,assertions:[
        assertion('hover-preview-does-not-intercept-card-action',hoverPreviewPointerEvents,'none'),
        assertion('inspection-closes-and-restores-source-focus',await target.evaluate(element=>document.activeElement===element),true),
    ]});

    await patchState(page,{core:{players:{'0':naturalActionPlayer}}});
    await waitForState(page,state=>state.core.players['0'].activeAttackIds.length===naturalActionPlayer.activeAttackIds.length
        &&state.core.players['0'].hand.length===naturalActionPlayer.hand.length,'恢复真实普通行动后的攻击/技能手牌与单张已打出牌');
    const beforeDesktopNormal=await snapshot(page);
    await page.setViewportSize({width:1366,height:768});
    await expect.poll(async()=>(await snapshot(page)).visible.viewport.width).toBe(1366);
    await page.mouse.move(8,8);
    await expect(page.locator('.fd-inspection-hover')).toHaveCount(0);
    await expect(page.getByRole('dialog',{name:/卡牌检视/})).toHaveCount(0);
    await expect.poll(async()=>(await snapshot(page)).visible.phaseControlCenterHit).toBe(true);
    const desktopNormal=await snapshot(page);
    reviewNormalBoardVisibility(desktopNormal,behaviorFailures,'desktop-narrow-normal',false);
    reviewCheck(behaviorFailures,'desktop-narrow-normal-state-restores-real-hand-and-one-live-attack',desktopNormal.authoritative.hand.length===naturalActionPlayer.hand.length
        &&desktopNormal.authoritative.activeAttackIds.length===naturalActionPlayer.activeAttackIds.length,
        {hand:(desktopNormal.authoritative.hand as any[]).length,active:(desktopNormal.authoritative.activeAttackIds as string[]).length},
        {hand:naturalActionPlayer.hand.length,active:naturalActionPlayer.activeAttackIds.length});
    reviewCheck(behaviorFailures,'desktop-narrow-no-hover-after-pointer-leaves',desktopNormal.visible.dialogCount===0,desktopNormal.visible.dialogCount,0);
    measuredEvidence.desktopNarrowNormal={viewport:desktopNormal.visible.viewport,playedRow:desktopNormal.visible.playedRow,selfDock:desktopNormal.visible.selfDock,selfIdentity:desktopNormal.visible.selfIdentity,selfSeals:desktopNormal.visible.selfSeals,phaseButton:desktopNormal.visible.phaseButton,attackHand:desktopNormal.visible.attackHand,attackHandCard:desktopNormal.visible.handCard,skillHand:desktopNormal.visible.skillHand,skillCard:desktopNormal.visible.skillCard,playerRail:desktopNormal.visible.playerRail,seatList:desktopNormal.visible.seatList,opponentSeats:desktopNormal.visible.opponentSeats,inputCapabilities:desktopNormal.visible.inputCapabilities,hoverVisible:await page.locator('.fd-inspection-hover').count()===1};
    await capture('窄桌面关闭检视后的正常牌桌','desktop-narrow-normal','1366×768桌面窄窗口中指针离开卡牌、检视关闭，三个席位和行动手牌各自可达。','desktop-narrow',page,DESKTOP_NORMAL_CHAIN_ID);
    steps.push({id:'desktop-narrow-resting-state',chainId:DESKTOP_NORMAL_CHAIN_ID,action:'恢复真实行动手牌、窗口改为1366×768并将鼠标移到卡牌之外',before:beforeDesktopNormal,after:desktopNormal,assertions:[
        assertion('desktop-narrow-viewport',desktopNormal.visible.viewport,{width:1366,height:768,scrollX:0,scrollY:0}),
        assertion('pointer-leave-closes-hover-inspection',await page.locator('.fd-inspection-hover').count(),0),
        assertion('two-opponent-seats-visible-and-hittable',(desktopNormal.visible as any).opponentSeats.length===2&&(desktopNormal.visible as any).opponentSeats.every((seat:any)=>seat.summaryCenterHit),true),
        assertion('self-hud-and-primary-action-visible',Boolean((desktopNormal.visible as any).selfSeals&&(desktopNormal.visible as any).selfIdentity&&(desktopNormal.visible as any).phaseButton),true),
        assertion('both-hand-zones-have-live-hit-centers',Boolean((desktopNormal.visible as any).attackHandCardCenterHit&&(desktopNormal.visible as any).skillHandCardCenterHit),true),
    ]});

    // 公开出牌的布局代表态：只使用本局真实实例，不声称这是自然规则推进。
    const publicFixture=await readState(page);
    const peer=publicFixture.core.players['1'];
    expect(peer.hand.length).toBeGreaterThanOrEqual(2);
    await patchState(page,{core:{players:{'1':{...peer,activeAttackIds:peer.hand.slice(0,2).map((card:any)=>card.id),faceDownAttackIds:[peer.hand[1].id],isRevealed:true}}}});
    const peerAvatar=page.locator('.fd-runtime-player-rail .fd-runtime-avatar').first();
    const peerName=(await peerAvatar.getAttribute('aria-label'))!.replace(/^查看|详情$/g,'');
    const beforeRow=await snapshot(page);
    await peerAvatar.hover();
    const peerRow=page.getByLabel(`${peerName}已打出`);
    await expect(peerRow).toBeVisible();
    await expect(peerRow.getByAltText('暗置攻击牌')).toBeVisible();
    const rowStyle=await peerRow.evaluate(element=>({background:getComputedStyle(element).backgroundColor,border:getComputedStyle(element).borderTopWidth,wrap:getComputedStyle(element.querySelector('.fd-runtime-public-cards')!).flexWrap}));
    // 在开始真实离开倒计时前取坐标，避免测试查询耗时占用玩家移入牌排的宽限。
    measuredEvidence.peerRowStyle=rowStyle;
    const rowBounds=await peerRow.boundingBox();expect(rowBounds).toBeTruthy();
    await page.mouse.move(8,8);
    await page.waitForTimeout(1000);
    await page.mouse.move(rowBounds!.x+rowBounds!.width/2,rowBounds!.y+rowBounds!.height/2);
    await expect(peerRow).toBeVisible();
    await page.waitForTimeout(2700);
    await expect(peerRow).toBeVisible();
    const afterRow=await snapshot(page);
    await capture('头像悬浮单排公开牌与暗置牌背','desktop-opponent-cards-open','真实头像悬浮展开一排已打出牌，无外框；移开一秒再移入，超过收起时间仍可点牌。','desktop-narrow',page,DESKTOP_NORMAL_CHAIN_ID);
    steps.push({id:'desktop-opponent-cards-open',chainId:DESKTOP_NORMAL_CHAIN_ID,action:'悬浮头像、跨越间隙移入牌排并停留超过2.5秒',before:beforeRow,after:afterRow,assertions:[assertion('cards-visible-after-pointer-transfer',await peerRow.isVisible(),true)]});
    const publicCard=peerRow.getByRole('button').first();
    await publicCard.click();
    await expect(page.locator('.fd-runtime-inspection.is-pinned')).toBeVisible();
    const inspectedRow=await snapshot(page);
    await capture('从对方悬浮牌排点击放大卡图','desktop-opponent-card-inspection','玩家将指针移入头像旁的牌排后，点击公开牌本体打开正式完整卡面。','desktop-narrow',page,DESKTOP_NORMAL_CHAIN_ID);
    steps.push({id:'desktop-opponent-card-inspection',chainId:DESKTOP_NORMAL_CHAIN_ID,action:'点击悬浮牌排中的公开牌',before:afterRow,after:inspectedRow,assertions:[assertion('public-card-inspection-visible',await page.locator('.fd-runtime-inspection.is-pinned').isVisible(),true)]});
    await page.locator('.fd-runtime-inspection.is-pinned button').click();
    // 放大期间宽限可能已经到期；从真实头像入口重新展开，不假定旧牌排仍挂载。
    await peerAvatar.hover();
    await expect(peerRow).toBeVisible();
    await peerRow.hover();
    await page.mouse.move(8,8);
    await expect(peerRow).toBeHidden({timeout:4000});
    const beforeDetail=await snapshot(page);
    await peerAvatar.click();
    await expect(page.getByRole('dialog',{name:/详情/})).toBeVisible();
    const afterDetail=await snapshot(page);
    await capture('窄桌面对手身份详情打开','desktop-player-detail-open','对手详情打开时已揭示身份素材、公开资源与关闭入口均可辨。','desktop-narrow',page,DESKTOP_NORMAL_CHAIN_ID);
    steps.push({id:'desktop-player-detail-open',chainId:DESKTOP_NORMAL_CHAIN_ID,action:'从对手头像打开身份详情',before:beforeDetail,after:afterDetail,assertions:[assertion('player-detail-dialog-visible',await page.getByRole('dialog',{name:/详情/}).isVisible(),true)]});
    await page.getByRole('button',{name:'切换到玩家1 韦伯·维尔维特'}).click();
    const detailMetrics=await page.locator('.fd-player-detail-skills').evaluate(element=>{
        const cards=Array.from(element.querySelectorAll('button')).map(card=>card.getBoundingClientRect());
        return {gaps:cards.slice(1).map((card,index)=>Math.round(card.left-cards[index].right)),widths:cards.map(card=>Math.round(card.width))};
    });
    measuredEvidence.selfDetail=detailMetrics;
    await capture('玩家详情两排紧凑牌距','desktop-self-detail-compact','从详情内切换到本人，身份与技能保持两排；相邻技能牌实际间距约12像素，右侧保留能力说明。','desktop-narrow',page,DESKTOP_NORMAL_CHAIN_ID);
    steps.push({id:'desktop-self-detail-compact',chainId:DESKTOP_NORMAL_CHAIN_ID,action:'在正式详情弹窗中切换到本人',before:afterDetail,after:await snapshot(page),assertions:[assertion('self-details-selected',await page.getByRole('button',{name:'切换到玩家1 韦伯·维尔维特'}).getAttribute('aria-current'),'page')]});
    await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();
    const eliminatedFixture=await readState(page);
    await patchState(page,{core:{players:{'1':{...eliminatedFixture.core.players['1'],eliminated:true,locationId:null}}}});
    await peerAvatar.click();
    const eliminatedLabel=page.getByRole('dialog').getByText('已淘汰',{exact:true});
    await expect(eliminatedLabel).toBeVisible();
    await capture('淘汰玩家详情红色状态','desktop-eliminated-detail','详情布局代表态：玩家详情的已淘汰文字使用红色状态标记，不再显示未部署。','desktop-narrow',page,DESKTOP_NORMAL_CHAIN_ID);
    steps.push({id:'desktop-eliminated-detail',chainId:DESKTOP_NORMAL_CHAIN_ID,action:'打开淘汰详情代表态，核对红色状态与原卡牌布局',before:await snapshot(page),after:await snapshot(page),assertions:[assertion('eliminated-red-visible',await eliminatedLabel.isVisible(),true)]});
    await page.getByRole('button',{name:'关闭玩家详情',exact:true}).click();
    await page.mouse.move(8,8);
    await expect(page.locator('.fd-inspection-hover')).toHaveCount(0);

    const finalState=await readState(page);
    // 桌面场景已完成取证，释放其纹理后再建立独立触控场景。
    await assertNoFatalFrontendErrors([{label:'fate-inline-play-area-restoration',diagnostics}]);
    const desktopIdentity=await captureEvidenceSourceIdentity(page,GAME_ID);
    await page.close();
    const touchContext=await browser.newContext({viewport:{width:936,height:432},screen:{width:936,height:432},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    let touchIdentity:Awaited<ReturnType<typeof captureEvidenceSourceIdentity>>|undefined;
    try{
        await initContext(touchContext,{skipImageGate:false});
        await startSourceSession(touchContext,baseURL!);
        const touchPage=await touchContext.newPage();
        const touchDiagnostics={...attachPageDiagnostics(touchPage),page:touchPage};
        await touchPage.goto(`${baseURL??''}/play/fate-domination?players=3&playerID=0&seed=iskandar-riding-ui-0&disableLocalAiAutomation=true`,{waitUntil:'domcontentloaded'});
        await touchPage.waitForFunction(()=>{
            const harness=(window as HarnessWindow).__BG_TEST_HARNESS__;
            return harness?.state?.isRegistered?.()===true&&harness?.command?.isRegistered?.()===true;
        },undefined,{timeout:20000});
        await expect(touchPage.getByTestId('fate-domination-board')).toBeVisible({timeout:20000});
        await chooseFateIdentity(touchPage,'master','m_waver');
        await chooseFateIdentity(touchPage,'servant','servant-rider');
        await touchPage.getByTestId('fate-domination-primary-action').tap();
        await waitForState(touchPage,state=>state.core.phase==='preparation'&&state.core.currentPlayerId==='1','触屏牌桌本人确认角色后转至下一席准备');
        await dispatch(touchPage,'ADVANCE_PHASE','1');
        await waitForState(touchPage,state=>state.core.phase==='preparation'&&state.core.currentPlayerId==='2','触屏牌桌第二席准备');
        await dispatch(touchPage,'ADVANCE_PHASE','2');
        await waitForState(touchPage,state=>state.core.phase==='outpost'&&state.core.currentPlayerId==='0','触屏牌桌进入前哨阶段');
        await touchPage.getByTestId('fate-domination-location-workshop').tap();
        await waitForState(touchPage,state=>state.core.players['0'].locationId==='workshop','触屏玩家本人部署在魔术工房');
        await touchPage.getByTestId('fate-domination-primary-action').tap();
        await waitForState(touchPage,state=>state.core.phase==='outpost'&&state.core.currentPlayerId==='1','触屏玩家本人结束前哨阶段');
        await dispatch(touchPage,'DEPLOY_MASTER','1',{locationId:'workshop'});
        await dispatch(touchPage,'ADVANCE_PHASE','1');
        await waitForState(touchPage,state=>state.core.phase==='outpost'&&state.core.currentPlayerId==='2','触屏牌桌第二席结束前哨阶段');
        await dispatch(touchPage,'DEPLOY_MASTER','2',{locationId:'workshop'});
        await dispatch(touchPage,'ADVANCE_PHASE','2');
        await waitForState(touchPage,state=>state.core.phase==='action'&&state.core.currentPlayerId==='0','触屏牌桌本人进入行动阶段');

        const touchStart=await readState(touchPage);
        const touchBeforeLongPress=await snapshot(touchPage);
        const longPressCard=touchPage.getByTestId('fate-domination-hand').locator('[data-card-zone="hand"]').first();
        await longPressCard.scrollIntoViewIfNeeded();
        await expectFateHandArtLoaded(touchPage);
        const longPressBox=await longPressCard.boundingBox();expect(longPressBox).toBeTruthy();
        const touchPoint={x:longPressBox!.x+longPressBox!.width/2,y:longPressBox!.y+longPressBox!.height/2};
        const hit=await touchPage.evaluate(point=>({id:document.elementFromPoint(point.x,point.y)?.closest('[data-card-id]')?.getAttribute('data-card-id'),scale:visualViewport?.scale,offset:visualViewport?.offsetTop}),touchPoint);
        expect(hit.id,JSON.stringify({hit,touchPoint,longPressBox})).toBe(await longPressCard.getAttribute('data-card-id'));
        const touchSession=await touchPage.context().newCDPSession(touchPage);
        await touchPage.evaluate(()=>{(window as any).__fateTouchAudit=[];for(const name of ['pointerdown','pointerup','pointercancel','contextmenu'])document.addEventListener(name,event=>(window as any).__fateTouchAudit.push({type:event.type,pointerType:(event as PointerEvent).pointerType,target:(event.target as HTMLElement).closest('[data-card-id]')?.getAttribute('data-card-id')}),true);});
        await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchPoint]});
        await touchPage.waitForTimeout(650);
        await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touchSession.detach();
        await expect(touchPage.getByTestId('fate-runtime-inspection'),JSON.stringify(await touchPage.evaluate(()=>(window as any).__fateTouchAudit))).toBeVisible();
        expect((await readState(touchPage)).core).toEqual(touchStart.core);
        steps.push({id:'touch-hand-longpress',chainId:TOUCH_NORMAL_CHAIN_ID,action:'原生触控长按手牌、抬手后完整检视保持打开，权威状态不变',before:touchBeforeLongPress,after:await snapshot(touchPage),assertions:[
            assertion('longpress-release-keeps-inspection-open',await touchPage.getByTestId('fate-runtime-inspection').isVisible(),true),
            assertion('longpress-does-not-select-or-pay',(await readState(touchPage)).core,touchStart.core),
        ]});
        await touchPage.getByTestId('fate-inspection-close').tap();
        expect((await readState(touchPage)).core).toEqual(touchStart.core);
        await expectFateHandArtLoaded(touchPage);

        const nonAbilityAttackIds=touchStart.core.players['0'].hand
            .filter((card:any)=>!['cardPreparation','cardSurveil','cardluck'].includes(card.definitionId))
            .filter((card:any)=>Boolean(FATE_ATTACK_BY_ID[card.definitionId]))
            .slice(0,2).map((card:any)=>card.id);
        if(nonAbilityAttackIds.length!==2)throw new Error(`触屏行动阶段无两张无主动能力基础攻击用于检视链：${JSON.stringify(touchStart.core.players['0'].hand.map((card:any)=>card.definitionId))}`);
        for(const cardId of nonAbilityAttackIds){
            const card=touchPage.getByTestId('fate-domination-hand').locator(`[data-card-id="${cardId}"]`);
            await card.tap();
            await expect(touchPage.getByTestId('fate-played-cards').locator(`[data-card-id="${cardId}"]`)).toHaveAttribute('data-card-zone','staged');
            expect((await readState(touchPage)).core.players['0'].selectedAttackIds).toEqual([]);
        }
        await expect(touchPage.getByTestId('fate-domination-primary-action')).toHaveAttribute('aria-label','确认攻击');
        await touchPage.getByTestId('fate-domination-primary-action').tap();
        await waitForState(touchPage,state=>state.core.players['0'].normalAttackPlayed&&state.core.players['0'].activeAttackIds.length===2,'触屏真实确认普通攻击');
        const inspectableAttack=touchPage.getByTestId('fate-played-cards').locator('[data-card-zone="active"][aria-label^="检视 "]').first();
        await expect(inspectableAttack).toBeVisible();
        const touchBeforeInspection=await snapshot(touchPage);
        await inspectableAttack.tap();
        await expect(touchPage.getByRole('dialog',{name:/卡牌检视/})).toBeVisible();
        await expect(touchPage.locator('.fd-inspection-hover')).toHaveCount(0);
        const touchPinnedInspection=await snapshot(touchPage);
        const touchInspectionBox=await touchPage.getByTestId('fate-inspection-card-face').boundingBox();
        const touchCloseBox=await touchPage.getByTestId('fate-inspection-close').boundingBox();
        await capture('触屏点牌打开完整检视','touch-inspection-open','真实触屏场景中点已打出牌本体打开完整卡面检视。','mobile-touch',touchPage,TOUCH_NORMAL_CHAIN_ID);
        steps.push({id:'touch-inspection-open',chainId:TOUCH_NORMAL_CHAIN_ID,action:'hasTouch/isMobile场景中点击一张真实已打出的基础攻击牌打开检视',before:touchBeforeInspection,after:touchPinnedInspection,assertions:[
            assertion('touch-scene-hasTouch-and-coarse-pointer',Boolean((touchPinnedInspection.visible as any).inputCapabilities.maxTouchPoints>0&&(touchPinnedInspection.visible as any).inputCapabilities.coarsePointer),true),
            assertion('touch-inspection-is-pinned-dialog',touchPinnedInspection.visible.dialogCount,1),
            assertion('touch-open-does-not-create-desktop-hover-layer',await touchPage.locator('.fd-inspection-hover').count(),0),
            ]});

        const touchClose=touchPage.getByTestId('fate-inspection-close');
        const touchCloseHit=touchCloseBox?await touchClose.evaluate(element=>{
            const rect=element.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
            return hit===element||element.contains(hit);
        }):false;
        reviewCheck(behaviorFailures,'touch-inspection-close-center-hits-close-control',touchCloseHit,touchCloseHit,true);
        await touchClose.tap();
        await expect(touchPage.getByRole('dialog',{name:/卡牌检视/})).toHaveCount(0);
        await expect(touchPage.locator('.fd-inspection-hover')).toHaveCount(0);
        const touchNormal=await snapshot(touchPage);
        reviewNormalBoardVisibility(touchNormal,behaviorFailures,'real-touch-normal',true);
        reviewCheck(behaviorFailures,'touch-close-restores-source-focus',await inspectableAttack.evaluate(element=>document.activeElement===element),await inspectableAttack.evaluate(element=>document.activeElement===element),true);
        reviewCheck(behaviorFailures,'touch-close-leaves-no-inspection-layer',touchNormal.visible.dialogCount===0,touchNormal.visible.dialogCount,0);
        measuredEvidence.touchNormal={viewport:touchNormal.visible.viewport,selfDock:touchNormal.visible.selfDock,selfIdentity:touchNormal.visible.selfIdentity,selfSeals:touchNormal.visible.selfSeals,selfSealArtwork:touchNormal.visible.selfSealArtwork,phaseControl:touchNormal.visible.phaseControl,phaseButton:touchNormal.visible.phaseButton,attackHand:touchNormal.visible.attackHand,attackHandCard:touchNormal.visible.handCard,attackHandCardCenterHit:touchNormal.visible.attackHandCardCenterHit,skillHand:touchNormal.visible.skillHand,skillCard:touchNormal.visible.skillCard,skillHandCardCenterHit:touchNormal.visible.skillHandCardCenterHit,playerRail:touchNormal.visible.playerRail,seatList:touchNormal.visible.seatList,seatListScroll:touchNormal.visible.seatListScroll,opponentSeats:touchNormal.visible.opponentSeats,inputCapabilities:touchNormal.visible.inputCapabilities,dialogCount:touchNormal.visible.dialogCount};
        await capture('触屏关闭检视后的正常牌桌','touch-normal-after-inspection','真实触屏关闭完整卡面后，悬停层消失，本人HUD、两名对手、两类手牌和行动按钮可见可点。','mobile-touch',touchPage,TOUCH_NORMAL_CHAIN_ID);
        steps.push({id:'touch-inspection-close-normal',chainId:TOUCH_NORMAL_CHAIN_ID,action:'触屏点击检视关闭控件，回到正常可操作牌桌',before:touchPinnedInspection,after:touchNormal,assertions:[
            assertion('touch-close-removes-pinned-inspection',touchNormal.visible.dialogCount,0),
            assertion('touch-close-removes-desktop-hover-preview',await touchPage.locator('.fd-inspection-hover').count(),0),
            assertion('touch-owner-hud-and-all-seats-visible',Boolean((touchNormal.visible as any).selfSeals&&(touchNormal.visible as any).selfIdentity)&&(touchNormal.visible as any).opponentSeats.length===2&&(touchNormal.visible as any).opponentSeats.every((seat:any)=>seat.summaryCenterHit),true),
            assertion('touch-primary-action-and-both-hands-reachable',Boolean((touchNormal.visible as any).phaseControlCenterHit&&(touchNormal.visible as any).attackHandCardCenterHit&&(touchNormal.visible as any).skillHandCardCenterHit),true),
            assertion('touch-close-restores-focus-to-source-card',await inspectableAttack.evaluate(element=>document.activeElement===element),true),
        ]});

        const touchBeforePass=await snapshot(touchPage);
        await expect(touchPage.getByTestId('fate-domination-primary-action')).toHaveAttribute('aria-label','结束行动');
        await touchPage.getByTestId('fate-domination-primary-action').tap();
        await waitForState(touchPage,state=>state.core.players['0'].hasPassedAction&&state.core.currentPlayerId==='1','检视关闭后继续完成行动并移交下一席');
        await expect(touchPage.getByRole('dialog',{name:/卡牌检视/})).toHaveCount(0);
        await expect(touchPage.locator('.fd-inspection-hover')).toHaveCount(0);
        const touchAfterPass=await snapshot(touchPage);
        await capture('触屏检视关闭后继续结束行动','touch-continued-action','同一触屏链关闭检视后继续点击结束行动，真实行动权移交给下一席。','mobile-touch',touchPage,TOUCH_NORMAL_CHAIN_ID);
        steps.push({id:'touch-continue-action-after-close',chainId:TOUCH_NORMAL_CHAIN_ID,action:'关闭检视后点击结束行动，行动权交给第二席',before:touchBeforePass,after:touchAfterPass,assertions:[
            assertion('touch-normal-action-was-submitted',touchAfterPass.authoritative.currentPlayerId,'1'),
            assertion('touch-current-player-completed-action',Boolean((await readState(touchPage)).core.players['0'].hasPassedAction),true),
            assertion('touch-action-continuation-keeps-inspection-closed',touchAfterPass.visible.dialogCount,0),
        ]});
        await assertNoFatalFrontendErrors([{label:'fate-touch-inspection-close-and-continue',diagnostics:touchDiagnostics}]);
        touchIdentity=await captureEvidenceSourceIdentity(touchPage,GAME_ID);
    }finally{
        await releaseSourceSession(touchContext);
        await touchContext.close();
    }

    expect(behaviorFailures,`behavior evidence mismatches:\n${behaviorFailures.join('\n')}`).toEqual([]);
    if(CAPTURE_STATES.size)expect(screenshots.map(item=>item.stepId).sort()).toEqual([...CAPTURE_STATES].sort());
    const revision=desktopIdentity.sourceRevision;
    if(!touchIdentity)throw new Error('缺真实触控上下文的源码响应证据');
    const contextRevision=(chainId:string)=>chainId===TOUCH_NORMAL_CHAIN_ID?touchIdentity!.sourceRevision:revision;
    await writeFile(path.join(run.stagingDir,'source-identity-desktop.json'),JSON.stringify(desktopIdentity,null,2));
    await writeFile(path.join(run.stagingDir,'source-identity-touch.json'),JSON.stringify(touchIdentity,null,2));
    const behaviorStepForState:Record<string,string>={
        'empty-play-area':'stage-real-card','staged-card-in-place':'stage-real-card',
        'riding-choice-controls':'open-riding-choice','twenty-inline-played-cards':'dense-direct-card-zone',
        'narrow-landscape-density':'narrow-viewport','desktop-narrow-normal':'desktop-narrow-resting-state',
        'touch-normal-after-inspection':'touch-inspection-close-normal','touch-continued-action':'touch-continue-action-after-close',
    };
    const media=[];
    const chainSteps=new Map<string,number>();
    for(let index=0;index<screenshots.length;index++){
        const item=screenshots[index];
        const finalPath=path.join(run.stableDir,path.basename(item.path));
        const chainId=item.chainId;
        const chainStep=(chainSteps.get(chainId)??0)+1;
        chainSteps.set(chainId,chainStep);
        const uiChange=item.stepId==='touch-inspection-open'||item.stepId==='mobile-card-inspection'||item.stepId==='desktop-opponent-drawer-open'||item.stepId==='desktop-player-detail-open'?'panel'
            :item.stepId==='staged-card-in-place'||item.stepId==='riding-choice-controls'?'interaction-mode'
            :item.stepId==='touch-continue-action-after-close'?'interaction-mode':'layout';
        const requirements=chainId===TOUCH_NORMAL_CHAIN_ID
            ?['hasTouch/isMobile场景没有遗留桌面卡牌悬停层','本人令咒与身份HUD未被裁切','两名对手席位同时可见且可点','关闭检视后可继续结束行动']
            :chainId===DESKTOP_NORMAL_CHAIN_ID
                ?['1366×768桌面指针离开卡牌后没有残留检视层','本人HUD、全部对手席位、两类手牌和主动作各自可见可达']
                :['Fate攻击手牌与已打出实例位于同一直接牌区','地图相机不随HUD及出牌数量变化'];
        media.push({path:path.relative(process.cwd(),finalPath).replace(/\\/g,'/'),chainId,chainStep:String(chainStep).padStart(2,'0'),stage:'独特界面态',role:'main-flow',viewport:item.viewport,transition:item.reason,description:item.name,uiStateId:item.stepId,uiChange,uiChangeReason:item.reason,behaviorStepId:behaviorStepForState[item.stepId]??item.stepId,sourceRevision:contextRevision(chainId),requirements});
    }
    const chains=[CHAIN_ID,DESKTOP_NORMAL_CHAIN_ID,TOUCH_NORMAL_CHAIN_ID].map(id=>({id,sourceRevision:contextRevision(id),steps:steps.filter(step=>(step.chainId??CHAIN_ID)===id).map(step=>step.id)}));
    const trace={gameId:GAME_ID,evidenceCategory:'independent',chainId:CHAIN_ID,chains,sourceRun:run.runId,sourceRevision:revision,status:'PASS',outcome:'真实 Board 的行动手牌经正常准备/部署阶段进入行动；手牌本体选择后在上方原牌区暂选，卡牌本体撤回并返回手牌；真实普通攻击批次激活伊斯坎达尔骑乘，打开并取消骑乘选择后继续；密集代表态继续在原区浏览。独立桌面窄视口在指针离牌、检视关闭后核验全部席位和两类手牌；另一个同源真实 hasTouch/isMobile 上下文以真实准备、部署、基础攻击进入触屏检视，关闭后仍无悬停残留并继续提交结束行动。地图相机不随HUD、骑乘模式、出牌数量或检视窗口改变。密集状态使用真实卡牌定义，其中超过本局剩余卡数的实例由测试夹具补齐，不代表自然对局或游戏数量上限。',fixtureBoundary:{kind:'representative-layout-fixture-after-real-board-setup',ruleBehaviorClaim:false,cardDefinitionsAreReal:true,liveGameCardCount:allCards.length,layoutOnlyInstanceCount:denseCards.filter((item:any)=>item.id.startsWith('layout-fixture-attack-')).length,instanceIds:finalState.core.players['0'].activeAttackIds},measurements:measuredEvidence,behaviorFailures,steps,uiStates:screenshots.map(item=>({id:item.stepId,stepId:item.stepId,chainId:item.chainId,change:item.stepId==='staged-card-in-place'||item.stepId==='riding-choice-controls'?'interaction-mode':item.stepId==='touch-inspection-open'||item.stepId==='mobile-card-inspection'?'panel':item.stepId==='touch-continue-action-after-close'?'interaction-mode':'layout',viewport:item.viewport,sha256:createHash('sha256').update(readFileSync(item.path)).digest('hex')}))};
    await writeFile(path.join(run.stagingDir,'fate-inline-play-area-restoration.json'),`${JSON.stringify(trace,null,2)}\n`,'utf8');
    for(const chain of chains){
        const chainMedia=media.filter(item=>item.chainId===chain.id);
        const chainTrace={...trace,sourceRevision:contextRevision(chain.id),chainId:chain.id,steps:steps.filter(step=>(step.chainId??CHAIN_ID)===chain.id),
            uiStates:chainMedia.map(item=>({id:item.uiStateId,stepId:item.behaviorStepId,change:item.uiChange,viewport:item.viewport,
                sha256:createHash('sha256').update(readFileSync(screenshots.find(shot=>shot.stepId===item.uiStateId)!.path)).digest('hex')}))};
        await writeFile(path.join(run.stagingDir,`${chain.id}.trace.json`),`${JSON.stringify(chainTrace,null,2)}\n`,'utf8');
    }
    await promoteEvidenceScreenshotRun(run,{gameId:GAME_ID,evidenceCategory:'independent',capturePolicy:'distinct-ui-state',media});
});
