// Migrated from the verified v82 external collector; one runtime evidence owner.
const { chromium } = require(require.resolve('playwright', {paths:[process.env.FATE_REPO || process.cwd()]}));
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const OUT = process.env.FATE_OUT || path.join(__dirname, 'run-01-players3');
const TARGET3 = process.env.FATE_TARGET || 'https://boardgame-betrayal-local-verification.blushbison1024.chatgpt.site/play/fate-domination/local';
const ENTRY = process.env.FATE_ENTRY;
const EXPECTED = process.env.FATE_ENTRY_SHA256;
const SOURCE_REVISION = process.env.FATE_SOURCE_REVISION;
const CATEGORY = process.env.FATE_CATEGORY || 'independent';
if (!ENTRY || !/^[a-f0-9]{64}$/.test(EXPECTED || '') || !SOURCE_REVISION || !['golden','independent'].includes(CATEGORY)) throw new Error('Explicit bundle path/SHA, source revision and valid evidence category required');
const SCENARIO = process.env.FATE_SCENARIO || 'players7';
const EXPECTED_PLAYERS = Number(process.env.FATE_EXPECTED_PLAYERS || 7);
const INITIAL_VIEWPORT = process.env.FATE_VIEWPORT === '1366x768' ? { width: 1366, height: 768 } : { width: 1920, height: 1080 };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const safeUrl = raw => { try { const u = new URL(raw); return u.origin + u.pathname; } catch { return raw; } };
const UI_INPUT_TIMEOUT_MS = 30000;
const BROWSER_ARGS = ['--use-angle=swiftshader', ...(process.env.FATE_DISABLE_GPU === 'true' ? ['--disable-gpu'] : [])];
const isPlayerInput = command => /^(?:NEXT$|CLICKTEXT |CLICKEXACT |CLICK |SELECT |PRESS |MOVE |DRAG |WHEEL |RELOAD$)/.test(command);
function pendingInputChecks(command, step) {
  if (!isPlayerInput(command) || !step) return [];
  return ['visible','authoritative'].filter(scope => !step.assertions.some(assertion =>
    assertion.path?.[0] === 'after' && assertion.path?.[1] === scope &&
    require('node:util').isDeepStrictEqual(assertion.actual, assertion.expected)));
}
// Narrow before-action test oracle for the primary control; settlement/choices stay explicit.
function nextPrimaryExpectation(before, primaryName) {
  const actor=before.currentPlayerId, player=before.players[actor], order=before.turnOrder;
  if(!player || player.eliminated || !Array.isArray(order) || before.pendingChoice)return null;
  const expectedName=before.phase==='preparation'?'完成准备':before.phase==='outpost'?'结束我的前哨阶段':before.phase==='battle'?'结束我的战斗阶段':before.phase==='action'?(player.selectedAttackIds.length?'确认攻击':'结束行动'):undefined;
  if(primaryName!==undefined&&primaryName!==expectedName)return null;
  if(['preparation','outpost'].includes(before.phase) || (before.phase==='battle'&&!before.battleResolution)){
    const next=order.find(id=>!before.players[id].eliminated&&id!==actor&&!before.phaseCompletedPlayerIds.includes(id));
    if(next)return {phase:before.phase,currentPlayerId:next};
    if(before.phase==='battle')return {phase:'battle',currentPlayerId:actor,resolutionStep:'locations'};
    return {phase:before.phase==='preparation'?'outpost':'action',currentPlayerId:order.find(id=>!before.players[id].eliminated)};
  }
  if(before.phase!=='action')return null;
  if(player.selectedAttackIds.length){
    if(player.selectedAttackIds.length!==2)return null;
    return {phase:'action',currentPlayerId:actor,playerChanges:{
      selectedAttackIds:[],selectedFaceDownIds:[],normalAttackPlayed:true,
      activeAttackIds:[...player.activeAttackIds,...player.selectedAttackIds.filter(id=>player.handIds.includes(id))],
      activeSkills:[...player.activeSkills,...player.selectedAttackIds.filter(id=>!player.handIds.includes(id))],
    }};
  }
  const active=order.filter(id=>before.players[id].locationId&&!before.players[id].eliminated);
  const next=active.find(id=>id!==actor&&!before.players[id].hasPassedAction);
  return {phase:next?'action':'battle',currentPlayerId:next??active[0],playerChanges:{hasPassedAction:true}};
}

const log = {
  gameId:'fate-domination', evidenceCategory:CATEGORY, acceptanceMode:'behavioral-chain', capturePolicy:'distinct-ui-state',
  chainId:crypto.randomUUID(), sourceRun:crypto.randomUUID(), sourceRevision:SOURCE_REVISION, browserContextId:crypto.randomUUID(),
  status:'RUNNING', outcome:'Not completed', steps:[], uiStates:[],
  startedAt: new Date().toISOString(),
  target3: TARGET3,
  expectedEntry: { path: ENTRY, sha256: EXPECTED },
  browser: { headless: true, chromiumSandbox: true, angle: 'swiftshader', isolatedContext: true, launchArgs:BROWSER_ARGS },
  taskScope: { kind: 'external-public-site', localRuntimePorts: [], allowedParallel: false, noPlayerID: true, statePatchAllowed: false },
  statePatchCount: 0,
  fixtureJsonLoaded: false,
  scenarios: {},
  bundleResponses: [],
  actions: [],
  stateTrail: [],
  screenshots: [],
  screenshotSkips: [],
  assetChecks: [],
  commandErrors: [],
  blockedInputs: [],
  network: [],
  console: [],
  pageErrors: [],
  viewportChanges: [],
  closedAt: null,
};

let outputReady = false;
const writeLog = async () => {
  if(!outputReady)return;
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'fate-action-flow-log.json'), JSON.stringify(log, null, 2), 'utf8');
};

const pageSummary = p => ({ url: p.url, title: p.title, readyState: p.readyState, viewport: p.viewport, canvasCount: p.canvasCount, canvasTrees: p.canvasTrees, state: p.state, controls: p.controls, images: p.images.map(i => ({ src: safeUrl(i.src), complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, visible: i.visible, opacity: i.opacity })), finiteRunningAnimations: p.finiteRunningAnimations, harnessRegistered: p.harnessRegistered, assetCache: p.assetCache, focus: p.focus });

const compactState = state => {
  const c = state?.core || state || {};
  const source = c.players;
  const entries = Array.isArray(source)
    ? source.map((p, i) => [String(p?.id ?? c.playerIds?.[i] ?? i), p])
    : Object.entries(source || {});
  const players = Object.fromEntries(entries.map(([id, p]) => [String(id), {
    masterId: p?.masterId ?? null,
    servantId: p?.servantId ?? null,
    locationId: p?.locationId ?? null,
    mana: p?.mana ?? null, commandSpells:p?.commandSpells??null, eliminated:p?.eliminated??false, normalAttackPlayed:p?.normalAttackPlayed??false,
    victoryPoints: p?.victoryPoints ?? null,
    handIds: Array.isArray(p?.hand) ? p.hand.map(x => x?.id ?? x?.cardId ?? null) : [],
    handCount: Array.isArray(p?.hand) ? p.hand.length : null,
    selectedAttackIds: p?.selectedAttackIds ?? [],
    selectedFaceDownIds: p?.selectedFaceDownIds ?? [],
    activeAttackIds: p?.activeAttackIds ?? [],
    activeSkills: p?.activeSkills ?? [],
    hasPassedAction: p?.hasPassedAction ?? false,
    discardIds: Array.isArray(p?.discard) ? p.discard.map(x => x?.id ?? x?.cardId ?? null) : [],
    deckCount: Array.isArray(p?.deck) ? p.deck.length : null,
  }]));
  return {
    gameId: c.gameId ?? null,
    round:c.round ?? null, gameOver:Boolean(state?.sys?.gameover), gameResult:c.gameResult ?? null, systemGameResult:state?.sys?.gameover??null,
    phase: c.phase ?? null,
    currentPlayerId: c.currentPlayerId ?? null,
    turnOrder: c.turnOrder ?? [],
    phaseCompletedPlayerIds: c.phaseCompletedPlayerIds ?? [],
    playerIds: c.playerIds ?? Object.keys(players),
    pendingChoice:state?.sys?.interaction?.current ? {id:state.sys.interaction.current.id,playerId:state.sys.interaction.current.playerId} : null,
    actionCount: c.actionCount ?? null,
    players,
    miyamaPlayerIds: c.battlefield?.miyama?.playerIds ?? null,
  };
};


// Read the product-owned persisted snapshot for this exact natural local match.
// No harness, dispatch, state injection, storage write or replacement path exists.
function readPersistedSnapshot(expectedUrl) {
  const expected=new URL(expectedUrl), current=new URL(location.href), seed=expected.searchParams.get('seed');
  if(current.origin!==expected.origin||current.pathname!==expected.pathname||current.searchParams.get('seed')!==seed||current.searchParams.has('playerID'))throw new Error('Capture navigated outside its original match identity');
  const raw=localStorage.getItem('local_match_snapshot_v1:fate-domination:'+seed);
  if(!raw)return null;
  const snapshot=JSON.parse(raw);
  if(snapshot.version!==1||snapshot.gameId!=='fate-domination'||snapshot.seed!==seed||!snapshot.state?.core||!snapshot.state?.sys)return null;
  const isVisible=el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return r.width>0&&r.height>0&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0;};
  const terminal=document.querySelector('[data-testid="endgame-overlay"]');
  const stats=Array.from(document.querySelectorAll('.fd-self-stats b')).map(el=>Number(el.textContent));
  const phaseText=document.querySelector('.fd-runtime-round')?.textContent||'';
  const visible={text:document.body.innerText,gameOver:Boolean(terminal&&isVisible(terminal)),phaseText,round:Number(phaseText.match(/第\s*(\d+)\s*回合/)?.[1]),selfLabel:document.querySelector('.fd-self-identity')?.getAttribute('aria-label'),mana:stats[0],victoryPoints:stats[1],controls:Array.from(document.querySelectorAll('button,select')).filter(isVisible).map(el=>({name:el.getAttribute('aria-label')||el.innerText,disabled:Boolean(el.disabled),ariaDisabled:el.getAttribute('aria-disabled')}))};
  return {snapshot,visible};
}
function validateSample(sample){
  const snapshot=sample?.snapshot;
  if(!snapshot||snapshot.state.core.gameId!=='fate-domination'||!Number.isInteger(snapshot.state.core.round)||typeof snapshot.state.core.phase!=='string'||!snapshot.state.core.currentPlayerId||snapshot.numPlayers!==EXPECTED_PLAYERS)throw new Error('Valid authoritative persisted state missing; stop capture');
  return sample;
}
async function readState(page){return validateSample(await page.evaluate(readPersistedSnapshot,TARGET3)).snapshot.state;}
const phaseLabels=require(path.join(process.env.FATE_REPO||process.cwd(),'public/locales',process.env.FATE_LOCALE||'zh-CN','game-fate-domination.json')).phases;
async function observe(page){
  await page.getByTestId('fate-domination-board').waitFor({state:'visible',timeout:120000});
  await page.locator('.fd-self-identity').waitFor({state:'visible',timeout:60000});
  let previous='',stable=0;
  for(let attempt=0;attempt<50;attempt++){
    const {snapshot,visible}=validateSample(await page.evaluate(readPersistedSnapshot,TARGET3));
    const state=snapshot.state,core=state.core,owner=state.sys.interaction.current?.playerId||core.currentPlayerId;
    const stateSha256=sha(JSON.stringify(state));
    const aligned=visible.round===core.round&&visible.phaseText.includes(phaseLabels[core.phase])&&visible.selfLabel===`查看玩家 ${Number(owner)+1}详情`&&visible.mana===core.players[owner].mana&&visible.victoryPoints===core.players[owner].victoryPoints;
    const signature=JSON.stringify({stateSha256,visible});stable=aligned&&signature===previous?stable+1:0;previous=signature;
    if(stable>=2)return {...compactState(state),snapshot:{seed:snapshot.seed,savedAt:snapshot.savedAt,randomCursor:snapshot.randomCursor,stateSha256},battleResolution:core.battleResolution??null,resolvedLocations:core.resolvedLocations,interaction:state.sys.interaction.current??null,visible};
    await wait(100);
  }
  throw new Error('Persisted authority and visible phase/round/owner/resources did not stabilize together');
}

const inspect = async page => {const persisted = await readState(page); return page.evaluate(state => {
  const visible = el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0;
  };
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, right: r.right, bottom: r.bottom, left: r.left }; };
  const describe = el => {
    const s = getComputedStyle(el), cl = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
    return { tag: el.tagName?.toLowerCase(), id: el.id || '', className: String(cl).slice(0, 180), rect: rect(el), computed: { display: s.display, position: s.position, width: s.width, height: s.height, minHeight: s.minHeight, maxHeight: s.maxHeight, aspectRatio: s.aspectRatio, transform: s.transform, overflow: s.overflow } };
  };
    const c = state?.core;
  const canvases = Array.from(document.querySelectorAll('canvas'));
  const canvasTrees = canvases.map(canvas => {
    const nodes = []; let el = canvas;
    while (el && nodes.length < 10) { nodes.push(describe(el)); el = el.parentElement; }
    let gl = null; try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch {}
    return { canvas: describe(canvas), ancestorsNearestFirst: nodes, canvasWidthAttr: canvas.width, canvasHeightAttr: canvas.height, webgl: gl ? { contextLost: gl.isContextLost(), drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight } : null };
  });
  const candidates = Array.from(document.querySelectorAll('.fd-runtime-map,.fd-runtime-table,.mobile-board-shell,.mobile-board-shell__content,.mobile-board-shell__canvas,[data-testid]')).slice(0, 60).map(describe);
  const active = document.activeElement;
  const focus = active ? { tag: active.tagName, id: active.id || '', role: active.getAttribute('role'), text: (active.innerText || active.getAttribute('aria-label') || active.title || '').trim().slice(0, 120), tabIndex: active.tabIndex, visible: visible(active), rect: rect(active), inDialog: !!active.closest('[role=dialog],dialog,[aria-modal=true]') } : null;
  const controls = Array.from(document.querySelectorAll('button,[role=button],a,input')).filter(visible).map(el => ({ tag: el.tagName, role: el.getAttribute('role'), text: (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 160), disabled: !!el.disabled, tabIndex: el.tabIndex, opacity: getComputedStyle(el).opacity, rect: rect(el), inDialog: !!el.closest('[role=dialog],dialog,[aria-modal=true]') }));
  const images = Array.from(document.images).map(i => ({ src: i.currentSrc || i.src, complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, visible: visible(i), opacity: getComputedStyle(i).opacity }));
  const animations = document.getAnimations().map(a => ({ playState: a.playState, duration: a.effect?.getComputedTiming?.().duration, iterations: a.effect?.getComputedTiming?.().iterations, target: a.effect?.target?.tagName || null }));
  const cache = window.__BG_ASSET_CACHE__;
  const cacheSummary = cache ? Object.fromEntries(Object.keys(cache).map(k => {
    const v = cache[k];
    return [k, v instanceof Map ? { type: 'Map', size: v.size, sampleKeys: [...v.keys()].slice(0, 20).map(String) } : { type: typeof v, constructor: v?.constructor?.name ?? null, keys: v && typeof v === 'object' ? Object.keys(v).slice(0, 30) : [] }];
  })) : null;
  return {
    at: new Date().toISOString(), url: location.href, title: document.title, readyState: document.readyState,
    viewport: { innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio, documentWidth: document.documentElement.clientWidth, documentHeight: document.documentElement.clientHeight, documentScrollHeight: document.documentElement.scrollHeight, scrollY },
    bodyText: (document.body?.innerText || '').slice(0, 1200), canvasCount: canvases.length, canvasTrees, layoutCandidates: candidates,
    controls, images, animations, finiteRunningAnimations: animations.filter(a => a.playState === 'running' && Number.isFinite(a.duration)).length,
    authoritySource:'product-persisted-local-match',
    state: c ? { gameId: c.gameId, phase: c.phase, currentPlayerId: c.currentPlayerId, playerIds: c.playerIds, players: Object.fromEntries((Array.isArray(c.players) ? c.players.map((p, i) => [String(p.id ?? i), p]) : Object.entries(c.players || {})).map(([id, p]) => [id, { masterId: p?.masterId, servantId: p?.servantId, locationId: p?.locationId, handCount: p?.hand?.length, handIds: p?.hand?.map(x => x?.id), selectedAttackIds: p?.selectedAttackIds, activeAttackIds: p?.activeAttackIds, discardIds: p?.discard?.map(x => x?.id) }])) } : null,
    focus, assetCache: cacheSummary,
  };
}, persisted);};

// Read-only scroll ownership diagnostics for the seven-player roster evidence.
const inspectScrollables = page => page.evaluate(() => {
  const describe = (el, index) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const cl = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
    const ancestry = []; let parent = el;
    while (parent && parent !== document.body && ancestry.length < 6) {
      const pClass = typeof parent.className === 'string' ? parent.className : (parent.className?.baseVal || '');
      ancestry.push({ tag: parent.tagName?.toLowerCase(), id: parent.id || '', className: String(pClass).slice(0, 120), role: parent.getAttribute('role'), testId: parent.getAttribute('data-testid') });
      parent = parent.parentElement;
    }
    return {
      index, tag: el.tagName?.toLowerCase(), id: el.id || '', className: String(cl).slice(0, 180),
      role: el.getAttribute('role'), ariaLabel: el.getAttribute('aria-label'), testId: el.getAttribute('data-testid'),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 240),
      overflowY: s.overflowY, overflowX: s.overflow, scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, maxScrollTop: Math.max(0, el.scrollHeight - el.clientHeight),
      rect: { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, right: r.right, bottom: r.bottom, left: r.left }, ancestry,
    };
  };
  return Array.from(document.querySelectorAll('*')).filter(el => {
    if (el === document.body || el === document.documentElement) return false;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return /auto|scroll|overlay/.test(`${s.overflowY} ${s.overflow}`) && el.scrollHeight > el.clientHeight + 1 &&
      r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0;
  }).map(describe);
});

const waitSettled = async page => {
  await page.evaluate(async () => {
    await Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, 2500))]);
    const imgs = Array.from(document.images);
    await Promise.race([Promise.all(imgs.map(i => i.decode().catch(() => null))), new Promise(r => setTimeout(r, 5000))]);
  });
  const start = Date.now(); let previous = ''; let stable = 0; let last = null;
  while (Date.now() - start < 9000) {
    const s = await page.evaluate(() => {
      const visible = i => { const r = i.getBoundingClientRect(), c = getComputedStyle(i); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0; };
      const imgs = Array.from(document.images).map(i => ({ src: i.currentSrc || i.src, complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, visible: visible(i), opacity: getComputedStyle(i).opacity }));
      const a = document.getAnimations();
      const finite = a.filter(x => x.playState === 'running' && Number.isFinite(x.effect?.getComputedTiming?.().endTime));
      return { at: new Date().toISOString(), images: imgs, finiteRunningAnimations: finite.length, animationCount: a.length, canvas: Array.from(document.querySelectorAll('canvas')).map(c => { const r = c.getBoundingClientRect(); return { width: c.width, height: c.height, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, opacity: getComputedStyle(c).opacity }; }) };
    });
    const signature = JSON.stringify({ images: s.images.map(i => [i.src, i.complete, i.naturalWidth, i.naturalHeight, i.visible, i.opacity]), canvas: s.canvas });
    stable = signature === previous ? stable + 1 : 0; previous = signature; last = s;
    if (stable >= 2 && s.finiteRunningAnimations === 0 && s.canvas.every(c => c.width > 0 && c.height > 0 && Number(c.opacity) > 0)) break;
    await wait(250);
  }
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  return { ...last, stableSamples: stable, settleDurationMs: Date.now() - start, visibleImageFailures: (last?.images || []).filter(i => i.visible && (!i.complete || i.naturalWidth <= 0)).map(i => ({ src: safeUrl(i.src), complete: i.complete, naturalWidth: i.naturalWidth })), canvasReady: Boolean(last?.canvas?.length) && (last?.canvas || []).every(c => c.width > 0 && c.height > 0 && Number(c.opacity) > 0) };
};

const focusState = page => page.evaluate(() => {
  const e = document.activeElement;
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { tag: e.tagName, role: e.getAttribute('role'), text: (e.innerText || e.getAttribute('aria-label') || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 120), tabIndex: e.tabIndex, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, inDialog: !!e.closest('[role=dialog],dialog,[aria-modal=true]'), hidden: getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden' };
});

let browser;
let guard;
let budgetHandle;
let page;
let rl;
let currentScenario = SCENARIO;
let bundleReady = Promise.resolve();
const capturedImageBodies = new Map();

const main = async () => {
  await fs.mkdir(OUT, { recursive: true });
  if((await fs.readdir(OUT)).length)throw new Error('Output directory must be empty for a fresh evidence run');
  outputReady=true;
  log.collectorSha256=sha(await fs.readFile(__filename));
  if(!new URL(TARGET3).searchParams.get('seed'))throw new Error('An explicit fresh URL seed is required');
  const { acquireTaskGuard } = await import(require('node:url').pathToFileURL(path.join(process.env.FATE_REPO || process.cwd(),'scripts/infra/heavy-task-guard.mjs')).href);
  const { acquireGlobalHeavyBudget } = await import(require('node:url').pathToFileURL(path.join(process.env.FATE_REPO || process.cwd(),'scripts/infra/global-heavy-budget.mjs')).href);
  guard = acquireTaskGuard({ name: 'e2e-run', allowConcurrency: false, command: 'fate v82 seven-player public UI evidence', metadata: { target: TARGET3, taskType: 'external public UI evidence', localRuntimePorts: [], profile: 'single sandboxed headless browser' } });
  budgetHandle = await acquireGlobalHeavyBudget({ group: 'e2e', weight: 1, command: 'fate v82 seven-player public UI evidence', metadata: { target: TARGET3, localRuntimePorts: [], browserProcessCount: 1 }, waitForBudget: true, waitTimeoutMs: 300000, waitPollMs: 3000, bypass: false });
  browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: process.env.FATE_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args:BROWSER_ARGS });
  page = await browser.newPage({ viewport: INITIAL_VIEWPORT, deviceScaleFactor: 1 });
  page.on('request', r => log.network.push({ kind: 'request', at: new Date().toISOString(), method: r.method(), url: safeUrl(r.url()), type: r.resourceType() }));
  page.on('requestfailed', r => log.network.push({ kind: 'failed', at: new Date().toISOString(), method: r.method(), url: safeUrl(r.url()), type: r.resourceType(), error: r.failure()?.errorText || null }));
  page.on('response', res => {
    const row = { kind: 'response', at: new Date().toISOString(), method: res.request().method(), url: safeUrl(res.url()), status: res.status(), type: res.request().resourceType() };
    log.network.push(row);
    if (res.status() >= 400) row.httpError = true;
    if (res.status() >= 200 && res.status() < 300 && (row.type === 'image' || /\.(?:webp|png|jpe?g|gif|avif|svg)(?:$|[?#])/i.test(res.url()))) {
      const imageUrl = safeUrl(res.url());
      if (!capturedImageBodies.has(imageUrl)) {
        capturedImageBodies.set(imageUrl, (async () => {
          const body = await res.body();
          const contentType = await res.headerValue('content-type').catch(() => null);
          const bytes = [...body.subarray(0, 12)];
          const ascii = body.toString('ascii', 0, Math.min(body.length, 12));
          const magicKind = ascii.startsWith('RIFF') && body.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
            : bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' ? 'png'
              : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpeg'
                : ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a') ? 'gif'
                  : ascii.toLowerCase().includes('<svg') ? 'svg'
                    : null;
          return { body, meta: { url: imageUrl, status: res.status(), contentType, bytes: body.length, sha256: sha(body), signatureHex: Buffer.from(bytes).toString('hex'), magicKind } };
        })().catch(error => ({ error: String(error), meta: { url: imageUrl, status: res.status() } })));
      }
    }
    try {
      if (new URL(res.url()).pathname === ENTRY) bundleReady = (async () => {
        try { const body = await res.body(); const b = { url: safeUrl(res.url()), status: res.status(), bytes: body.length, sha256: sha(body) }; log.bundleResponses.push(b); log.entryBundle = b; await writeLog(); }
        catch (e) { log.bundleResponses.push({ url: safeUrl(res.url()), status: res.status(), error: String(e) }); }
      })();
    } catch {}
  });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.console.push({ at: new Date().toISOString(), type: m.type(), text: m.text(), url: safeUrl(m.location().url) }); });
  page.on('pageerror', e => log.pageErrors.push({ at: new Date().toISOString(), name: e.name, message: e.message, stack: e.stack }));

  await navigateScenario(SCENARIO, TARGET3, EXPECTED_PLAYERS);
  console.log(JSON.stringify({ READY: true, scenario: currentScenario, navigation: log.scenarios[SCENARIO].navigation, bundle: log.entryBundle, page: pageSummary(await inspect(page)) }));
  rl = require('node:readline').createInterface({ input: process.stdin, output: process.stdout, terminal: false });
   console.log('EVIDENCE: CHECK {name,path:[after,visible|authoritative,...],expected}; SELECT {label,value}; SNAP {file,uiStateId,uiChange,uiChangeReason,requirements}; every input needs visible and authoritative checks.');
   console.log('NEXT clicks the enabled primary control and checks before-derived turn order; battle location settlement and choices remain explicit.');
   console.log('COMMANDS: DUMP; FULLSTATE; BUTTONS; SCROLLS; HIT x y; ASSETCHECK label; DECODECAPTURED; SELECT JSON; CHECK JSON; SNAP JSON; CLICKEXACT name; CLICKTEXT text; CLICK x y label; MOVE x y label; DRAG x1 y1 x2 y2 label; WHEEL x y delta label; PRESS key; RELOAD (independent only); DONE; ABORT reason (preserve diagnostic evidence and close). No patch, batched tabs, mid-run viewport or match switches.');
  for await (const raw of rl) {
    const cmd = raw.trim();
    try {
      const missingChecks = pendingInputChecks(cmd, log.steps.at(-1));
      if (isPlayerInput(cmd) && (missingChecks.length || log.commandErrors.length)) {
        const blocked = {at:new Date().toISOString(),command:cmd,stepId:log.steps.at(-1)?.id,missingChecks,priorCommandErrors:log.commandErrors.length,dispatched:false};
        log.blockedInputs.push(blocked);await writeLog();console.log(JSON.stringify({INPUT_BLOCKED:blocked}));continue;
      }
      if (cmd === 'ABORT' || cmd.startsWith('ABORT ')) {
        log.status='ABORTED';log.outcome=cmd.slice(6).trim()||'Operator ended diagnostic run';process.exitCode=1;await writeLog();rl.close();break;
      }
      if(log.steps.at(-1)?.after.authoritative.gameOver && /^(CLICK|SELECT|PRESS|MOVE|DRAG|WHEEL|RELOAD|TABS)/.test(cmd))throw new Error('After terminal input only checks, inspection reads, captures and DONE are permitted');
      if (cmd === 'APPLY') console.log('APPLY_BLOCKED: this v81 run forbids all state/phase patches.');
      else if (cmd === 'RELOAD') {
        if(CATEGORY==='golden')throw new Error('Reload is an independent contract, not part of this natural golden');
        const before = await inspect(page);
        const beforeState = await observe(page);
        const reloadAt = new Date().toISOString();
        const bundleResponsePromise = page.waitForResponse(res => {
          try { return new URL(res.url()).pathname === ENTRY; } catch { return false; }
        }, { timeout: 30000 });
        const navigationResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        const bundleResponse = await bundleResponsePromise;
        const bytes = await bundleResponse.body();
        const bundle = { url: safeUrl(bundleResponse.url()), status: bundleResponse.status(), bytes: bytes.length, sha256: sha(bytes) };
        await bundleReady;
        const imageReadiness = await waitSettled(page);
        const after = await inspect(page);
        let afterState = await observe(page);
    if(afterState.phase==='complete'){await page.getByTestId('endgame-overlay').waitFor({state:'visible',timeout:15000});afterState=await observe(page);}
        const entry = { scenario: currentScenario, at: new Date().toISOString(), type: 'real-playwright-page-reload', urlBefore: before.url, urlAfter: after.url, navigationStatus: navigationResponse?.status() ?? null, bundle, expectedBundle: { path: ENTRY, sha256: EXPECTED }, bundleMatchesExpected: bundle.status === 200 && bundle.sha256 === EXPECTED, beforeBodyText: before.bodyText, afterBodyText: after.bodyText, beforeControls: before.controls, afterControls: after.controls, beforeState, afterState, imageReadiness };
        log.entryBundle = bundle; await recordInput('刷新页面','real-page-reload',beforeState,before.focus,{bundle});
        console.log(JSON.stringify({ RELOAD_RESULT: { at: entry.at, reloadAt, urlBefore: entry.urlBefore, urlAfter: entry.urlAfter, navigationStatus: entry.navigationStatus, bundle, expectedBundle: entry.expectedBundle, bundleMatchesExpected: entry.bundleMatchesExpected, beforeBodyText: entry.beforeBodyText, afterBodyText: entry.afterBodyText, beforeState, afterState, visibleImageFailures: imageReadiness.visibleImageFailures, settleDurationMs: imageReadiness.settleDurationMs } }));
        if (!entry.bundleMatchesExpected) throw new Error('v81 bundle SHA/status mismatch; no game UI input attempted.');
      }
      else if (cmd === 'DUMP') console.log(JSON.stringify({ scenario: currentScenario, bundle: log.entryBundle, page: pageSummary(await inspect(page)) }));
      else if (cmd === 'FULLSTATE') console.log(JSON.stringify({FULLSTATE:await readState(page)}));
       else if (cmd === 'BUTTONS') console.log(JSON.stringify((await inspect(page)).controls));
       else if (cmd === 'SCROLLS') {
         const entry = { scenario: currentScenario, at: new Date().toISOString(), type: 'scroll-owner-snapshot', viewport: (await inspect(page)).viewport, scrollables: await inspectScrollables(page) };
         log.actions.push(entry); await writeLog(); console.log(JSON.stringify({ SCROLLS: entry }));
       }
      else if (cmd.startsWith('HIT ')) await hitTest(cmd);
      else if (cmd.startsWith('ASSETCHECK ')) await assetCheck(cmd.slice(11).trim());
      else if (cmd === 'DECODEWEBP') await decodeWebp();
      else if (cmd === 'DECODECAPTURED') await decodeCapturedImages();
      else if (cmd.startsWith('SNAP ')) await capture(JSON.parse(cmd.slice(5)));
      else if (cmd.startsWith('CHECK ')) await checkStep(JSON.parse(cmd.slice(6)));
      else if (cmd.startsWith('SELECT ')) await selectOption(JSON.parse(cmd.slice(7)));
      else if (cmd === 'NEXT') await advancePrimary();
      else if (cmd.startsWith('CLICKTEXT ')) await clickText(cmd.slice(10).trim());
      else if (cmd.startsWith('CLICKEXACT ')) await clickExactText(cmd.slice(11).trim());
      else if (cmd.startsWith('CLICK ')) await clickXY(cmd);
      else if (cmd.startsWith('MOVE ')) await movePointer(cmd);
      else if (cmd.startsWith('DRAG ')) await drag(cmd);
      else if (cmd.startsWith('WHEEL ')) await wheel(cmd);
      else if (cmd.startsWith('PRESS ')) await pressKey(cmd.slice(6).trim());
      else if (cmd.startsWith('TABS ')) throw new Error('Use individual PRESS Tab and CHECK, not unrecorded tab batches');
      else if (cmd.startsWith('VIEW ')) throw new Error('Use a fresh run per viewport; no mid-chain resize');
      else if (cmd === 'NAV7') console.log('NAV7_BLOCKED: use a fresh seven-player no-playerID context.');
      else if (cmd === 'DONE') { await finishEvidence(); rl.close(); break; }
      else console.log('UNKNOWN_COMMAND');
    } catch (e) { log.commandErrors.push({ at: new Date().toISOString(), command: cmd, error: String(e), stack: e.stack }); await writeLog(); console.log(JSON.stringify({ COMMAND_ERROR: cmd, error: String(e) })); }
  }

  if(log.status==='RUNNING'){log.status='ABORTED';log.outcome='Input ended before explicit evidence completion';process.exitCode=1;await writeLog();}

  async function navigateScenario(key, url, expectedPlayers) {
    if (new URL(url).searchParams.has('playerID')) throw new Error('playerID query is forbidden for natural hotseat capture.');
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const started = Date.now();
    let ready = null;
    while (Date.now() - started < 45000) {
       ready = await page.evaluate(() => ({ canvas: document.querySelectorAll('canvas').length, registered: typeof window.__BG_TEST_HARNESS__?.state?.isRegistered === 'function' ? window.__BG_TEST_HARNESS__.state.isRegistered() : null, rootChildCount: document.getElementById('root')?.childElementCount ?? document.body?.children?.length ?? 0, bodyText: (document.body?.innerText || '').slice(0, 300) }));
       if (ready.canvas > 0 || ready.rootChildCount > 0) break;
      await wait(250);
    }
    await bundleReady; await wait(300);
     if (!ready || (ready.canvas < 1 && ready.rootChildCount < 1)) throw new Error(key + ' page did not mount visible UI; no state mutation attempted. ' + JSON.stringify(ready));
    await page.getByTestId('fate-domination-board').waitFor({state:'visible',timeout:120000});
    await page.locator('.fd-runtime-round').waitFor({state:'visible',timeout:15000});
    await page.locator('.fd-self-identity').waitFor({state:'visible',timeout:15000});
    await page.waitForFunction(readPersistedSnapshot, TARGET3, {timeout:45000});
    const snapshot = await inspect(page);
    const observedPlayers = snapshot.state?.playerIds?.length ?? 0;
     const scenario = { target: url, navigation: { status: response?.status() ?? null, at: new Date().toISOString() }, readyAt: new Date().toISOString(), ready, observedPlayerCount: observedPlayers, baseline: snapshot, baselineState: await observe(page) };
    log.scenarios[key] = scenario;
    if (!log.entryBundle || log.entryBundle.sha256 !== EXPECTED || log.entryBundle.status !== 200) throw new Error('Entry bundle does not match the expected published SHA; no state mutation attempted. ' + JSON.stringify(log.entryBundle));
     if (observedPlayers !== expectedPlayers) throw new Error(key + ' expected ' + expectedPlayers + ' players, observed ' + observedPlayers + '; no state mutation attempted.');
     log.expectedPlayerCount = expectedPlayers;
     log.playerCountVerification = 'product persisted snapshot for exact URL seed';
    log.stateTrail.push({ scenario: key, label: 'baseline-before-setup', at: scenario.readyAt, state: scenario.baselineState });
    await fs.writeFile(path.join(OUT, key + '-baseline.json'), JSON.stringify({ version: log.entryBundle, scenario }, null, 2), 'utf8');
    await writeLog();
  }

  async function recordInput(label, kind, beforeState, beforeFocus, extra = {}) {
    await wait(350);
    let afterState = await observe(page);
    if(afterState.phase==='complete'){await page.getByTestId('endgame-overlay').waitFor({state:'visible',timeout:15000});afterState=await observe(page);}
    const afterFocus = await focusState(page);
    const active = afterState?.players?.[String(afterState.currentPlayerId)] || null;
    const entry = { scenario: currentScenario, at: new Date().toISOString(), type: kind, label, beforeState, afterState, currentPlayerIdentity: active ? { playerId: afterState.currentPlayerId, masterId: active.masterId, servantId: active.servantId } : { playerId: afterState?.currentPlayerId ?? null }, beforeFocus, afterFocus, ...extra };
    const split = observation => {const {visible,...authoritative}=observation;return {visible,authoritative};};
    const step = {id:'step-'+String(log.steps.length+1).padStart(4,'0'),action:label,before:split(beforeState),after:split(afterState),assertions:[]};
    log.steps.push(step); entry.stepId=step.id;
    log.actions.push(entry); log.stateTrail.push({ scenario: currentScenario, label: label, at: entry.at, state: afterState, focus: afterFocus });
    await writeLog();
    console.log(JSON.stringify({ ACTION: entry }));
  }

  async function decodeWebp() {
    const paths = [
      '/assets/i18n/zh-CN/fate-domination/board/compressed/fuyuki-city.webp',
      '/assets/i18n/zh-CN/fate-domination/events/compressed/ritual-site.webp',
    ];
    const result = await page.evaluate(async paths => {
      const files = [];
      for (const pathname of paths) {
        try {
          const response = await fetch(pathname, { cache: 'no-store', credentials: 'same-origin' });
          const blob = await response.blob();
          const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
          const signature = Array.from(head, value => String.fromCharCode(value)).join('');
          let bitmap = null, decodeError = null;
          try { bitmap = await createImageBitmap(blob); } catch (error) { decodeError = String(error); }
          files.push({
            url: new URL(pathname, location.href).href,
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get('content-type'),
            bytes: blob.size,
            riff: signature.slice(0, 4) === 'RIFF',
            webp: signature.slice(8, 12) === 'WEBP',
            decodedByBrowser: !!bitmap,
            width: bitmap?.width ?? 0,
            height: bitmap?.height ?? 0,
            decodeError,
          });
          bitmap?.close();
        } catch (error) {
          files.push({ url: new URL(pathname, location.href).href, fetchError: String(error) });
        }
      }
      const cacheHits = [];
      const cache = window.__BG_ASSET_CACHE__;
      if (cache && typeof cache === 'object') {
        for (const [cacheName, value] of Object.entries(cache)) {
          if (!(value instanceof Map)) continue;
          for (const [key, asset] of value.entries()) {
            if (!/fuyuki-city|ritual-site/i.test(String(key))) continue;
            cacheHits.push({ cacheName, key: String(key), constructor: asset?.constructor?.name ?? null, complete: asset?.complete ?? null, naturalWidth: asset?.naturalWidth ?? null, width: asset?.width ?? null, height: asset?.height ?? null, valid: asset?.valid ?? null });
          }
        }
      }
      return { at: new Date().toISOString(), pageUrl: location.href, files, cacheHits };
    }, paths);
    const entry = { scenario: currentScenario, kind: 'same-origin-webp-browser-decode', ...result };
    log.assetChecks.push(entry); await writeLog(); console.log(JSON.stringify({ WEBP_DECODE: entry }));
  }

   async function decodeCapturedImages() {
     const files = [];
     for (const [url, pending] of capturedImageBodies.entries()) {
       const captured = await pending;
       if (!captured?.body) {
         files.push({ ...(captured?.meta || { url }), decodeReadError: captured?.error || 'captured response body unavailable' });
         continue;
       }
       const browserDecode = await page.evaluate(async ({ base64, contentType }) => {
         const binary = atob(base64);
         const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
         const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
         const prefix = ascii(0, Math.min(bytes.length, 16));
         const magicKind = prefix.startsWith('RIFF') && ascii(8, 12) === 'WEBP' ? 'webp'
           : [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value) ? 'png'
             : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpeg'
               : prefix.startsWith('GIF87a') || prefix.startsWith('GIF89a') ? 'gif'
                 : prefix.toLowerCase().includes('<svg') ? 'svg'
                   : null;
         const mimeForMagic = { webp: 'image/webp', png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };
         let bitmap = null, decodeError = null;
         try { bitmap = await createImageBitmap(new Blob([bytes], { type: mimeForMagic[magicKind] || contentType || 'application/octet-stream' })); }
         catch (error) { decodeError = String(error); }
         const mime = (contentType || '').split(';')[0].trim().toLowerCase();
         return { magicKind, contentType: mime || null, contentTypeMatchesMagic: !!magicKind && mime === mimeForMagic[magicKind], decodedByBrowser: !!bitmap, width: bitmap?.width || 0, height: bitmap?.height || 0, decodeError };
       }, { base64: captured.body.toString('base64'), contentType: captured.meta.contentType });
       files.push({ ...captured.meta, ...browserDecode });
     }
     const runtime = await page.evaluate(() => {
       const canvases = Array.from(document.querySelectorAll('canvas')).map(canvas => {
         let gl = null;
         try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch {}
         return { width: canvas.width, height: canvas.height, contextLost: gl?.isContextLost?.() ?? null, rect: (() => { const r = canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() };
       });
       const cache = window.__BG_ASSET_CACHE__;
       const relevant = [];
       if (cache && typeof cache === 'object') {
         for (const [cacheName, value] of Object.entries(cache)) {
           if (!(value instanceof Map)) continue;
           for (const [key, asset] of value.entries()) {
             if (!/fuyuki-city|ritual-site|situations?\/compressed\/(?:back|new-city-battle)|new-city-battle|back\.webp/i.test(String(key))) continue;
             const source = asset?.source || asset?.baseTexture || null;
             relevant.push({ cacheName, key: String(key), constructor: asset?.constructor?.name ?? null, valid: asset?.valid ?? source?.valid ?? null, complete: asset?.complete ?? source?.resource?.complete ?? null, width: asset?.width ?? source?.width ?? null, height: asset?.height ?? source?.height ?? null });
           }
         }
       }
       return { canvasCount: canvases.length, canvases, assetCacheAvailable: !!cache, relevantAssetEntries: relevant };
     });
     const entry = { scenario: currentScenario, at: new Date().toISOString(), kind: 'captured-network-image-bytes-browser-decoded', imageCount: files.length, decodedCount: files.filter(f => f.decodedByBrowser && f.magicKind && f.status === 200).length, invalidCount: files.filter(f => !(f.decodedByBrowser && f.magicKind && f.status === 200)).length, files, runtime };
     log.assetChecks.push(entry); await writeLog();
     console.log(JSON.stringify({ DECODECAPTURED: { scenario: entry.scenario, imageCount: entry.imageCount, decodedCount: entry.decodedCount, invalidCount: entry.invalidCount, runtime, files: files.map(({ body, ...file }) => file) } }));
   }

   async function assetCheck(label) {
    const settled = await waitSettled(page);
    const snapshot = await inspect(page);
    const check = {
      scenario: currentScenario,
      label,
      at: new Date().toISOString(),
      viewport: snapshot.viewport,
      pageUrl: snapshot.url,
      visibleImages: snapshot.images.filter(i => i.visible).map(i => ({ src: safeUrl(i.src), complete: i.complete, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, opacity: i.opacity })),
      visibleImageFailures: settled.visibleImageFailures,
      finiteRunningAnimations: settled.finiteRunningAnimations,
      canvasReady: settled.canvasReady,
      sameOriginResponses: log.network.filter(n => n.kind === 'response' && /\/assets\//i.test(n.url || '')),
      assetFailures: log.network.filter(n => n.kind === 'failed' && /\/assets\//i.test(n.url || '')),
    };
    log.assetChecks.push(check); await writeLog();
    console.log(JSON.stringify({ ASSETCHECK: check }));
  }

  async function clickText(needle) {
    // Allow real visible UI input in this no-fixture v52 flow.
    const controls = page.locator('button,[role=button],a'); const n = await controls.count(); const matches = [];
    for (let i = 0; i < n; i++) {
      const el = controls.nth(i), vis = await el.isVisible().catch(() => false), en = await el.isEnabled().catch(() => false);
      if (!vis || !en) continue;
      const text = (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      const aria = await el.getAttribute('aria-label').catch(() => '') || '', title = await el.getAttribute('title').catch(() => '') || '';
      if ((text + ' ' + aria + ' ' + title).includes(needle)) matches.push({ el, label: text || aria || title, box: await el.boundingBox() });
    }
    if (matches.length !== 1) return console.log(JSON.stringify({ CLICKTEXT_BLOCKED: needle, visibleEnabledMatches: matches.map(x => ({ label: x.label, box: x.box })), hint: 'Use fresh BUTTONS output; only unique visible enabled controls are clickable.' }));
     const { el, label, box } = matches[0], before = await observe(page), beforeFocus = await focusState(page);
    await el.click({ timeout: UI_INPUT_TIMEOUT_MS }); await recordInput(label, 'real-ui-button-click', before, beforeFocus, { box, selectorText: needle });
  }

  async function hitTest(command) {
    const m = command.match(/^HIT\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/);
    if (!m) return console.log('HIT_REJECTED: use HIT x y');
    const x = Number(m[1]), y = Number(m[2]);
    const elements = await page.evaluate(({ x, y }) => document.elementsFromPoint(x, y).slice(0, 8).map(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      const cl = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
      return { tag: el.tagName?.toLowerCase(), id: el.id || '', className: String(cl).slice(0, 160), text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100), pointerEvents: s.pointerEvents, zIndex: s.zIndex, rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
    }), { x, y });
    console.log(JSON.stringify({ HIT: { x, y, elements } }));
  }

  async function clickExactText(expected) {
    const el = page.getByRole('button', { name: expected, exact: true });
    const count = await el.count();
    if (count !== 1) return console.log(JSON.stringify({ CLICKEXACT_BLOCKED: expected, exactAccessibleNameMatchCount: count }));
    const visible = await el.isVisible().catch(() => false), enabled = await el.isEnabled().catch(() => false);
    const metadata = await el.evaluate(node => ({
      ariaLabel: node.getAttribute('aria-label'),
      ariaDisabled: node.getAttribute('aria-disabled'),
      disabled: !!node.disabled,
      textContent: (node.innerText || node.textContent || '').trim(),
      title: node.getAttribute('title'),
    })).catch(error => ({ metadataError: String(error) }));
    const beforeLayout = await inspect(page);
    if (!visible || !enabled) return console.log(JSON.stringify({ CLICKEXACT_BLOCKED: expected, visible, enabled, metadata, visibleText: beforeLayout.bodyText }));
    const label = (await el.innerText().catch(() => '')) || expected, box = await el.boundingBox();
    const before = await observe(page), beforeFocus = await focusState(page);
    await el.click({ timeout: UI_INPUT_TIMEOUT_MS });
    await recordInput(label, 'real-ui-button-click-exact-accessible-name', before, beforeFocus, { box, exactAccessibleName: expected, visible: true, enabled: true, buttonMetadataBeforeClick: metadata, selectedTargetContextBeforeClick: beforeLayout.bodyText });
  }

  async function clickXY(command) {
    // Allow real pointer input in this no-fixture v52 flow.
    const m = command.match(/^CLICK\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) return console.log('CLICK_REJECTED: use CLICK x y label');
    const x = Number(m[1]), y = Number(m[2]), label = m[3], v = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    if (x < 0 || y < 0 || x >= v.width || y >= v.height) return console.log('CLICK_REJECTED: outside current viewport.');
     const before = await observe(page), beforeFocus = await focusState(page);
    await page.mouse.click(x, y); await recordInput(label, 'real-pointer-click', before, beforeFocus, { x, y });
  }

  async function movePointer(command) {
    const m = command.match(/^MOVE\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) return console.log('MOVE_REJECTED: use MOVE x y label');
    const x = Number(m[1]), y = Number(m[2]), label = m[3], before = await observe(page), beforeFocus = await focusState(page);
    await page.mouse.move(x, y); await wait(350); await recordInput(label, 'real-pointer-move', before, beforeFocus, { x, y });
  }

  async function drag(command) {
    // Allow real pointer input in this no-fixture v52 flow.
    const m = command.match(/^DRAG\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) return console.log('DRAG_REJECTED: use DRAG x1 y1 x2 y2 label');
     const [x1, y1, x2, y2] = m.slice(1, 5).map(Number), label = m[5], before = await observe(page), beforeFocus = await focusState(page), beforeLayout = await inspect(page);
    await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 18 }); await page.mouse.up(); await recordInput(label, 'real-pointer-drag', before, beforeFocus, { from: [x1, y1], to: [x2, y2], beforeCanvas: beforeLayout.canvasTrees, afterLayout: (await inspect(page)).canvasTrees });
  }

  async function wheel(command) {
    // Allow real pointer input in this no-fixture v52 flow.
    const m = command.match(/^WHEEL\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) return console.log('WHEEL_REJECTED: use WHEEL x y deltaY label');
     const x = Number(m[1]), y = Number(m[2]), deltaY = Number(m[3]), label = m[4], before = await observe(page), beforeFocus = await focusState(page), beforeLayout = await inspect(page), beforeScrollables = await inspectScrollables(page);
    await page.mouse.move(x, y); await page.mouse.wheel(0, deltaY); await wait(500); const afterScrollables = await inspectScrollables(page); await recordInput(label, 'real-pointer-wheel', before, beforeFocus, { x, y, deltaY, beforeCanvas: beforeLayout.canvasTrees, afterLayout: (await inspect(page)).canvasTrees, scrollablesBefore: beforeScrollables, scrollablesAfter: afterScrollables });
  }

  async function pressKey(key) {
    const before = await observe(page), beforeFocus = await focusState(page);
    await page.keyboard.press(key); await recordInput('keyboard:' + key, 'real-keyboard', before, beforeFocus, { key });
  }

  async function capture(metadata) {
    const {file,uiStateId,uiChange,uiChangeReason,requirements}=metadata;
    if (typeof file!=='string'||! /^[^/\\]+\.png$/.test(file)||!uiStateId||!uiChangeReason||!Array.isArray(requirements)||!requirements.length||!['layout','panel','interaction-mode','target-highlight','error','empty','animation-phase'].includes(uiChange)||!/[\u3400-\u9fff]/.test(file)) throw new Error('SNAP requires explicit file, semantic UI identity/change/reason/requirements');
    const step=log.steps.at(-1);if(!step)throw new Error('Capture must follow a real recorded player action');
    const resolution=page.viewportSize(),viewport='desktop';
    if(log.uiStates.some(item=>item.id===uiStateId&&JSON.stringify(item.resolution)===JSON.stringify(resolution)))return console.log('SNAP_SKIPPED: UI state already recorded; numeric changes remain in behavior log');
    if(log.screenshots.some(item=>item.file===file))throw new Error('Screenshot filename already used');
    if(!uiStateId.endsWith(`-${resolution.width}x${resolution.height}`))throw new Error('UI state ID must include actual resolution, not action or numeric values');
    const settle = await waitSettled(page), snapshot = await inspect(page), filePath = path.join(OUT, file);
    const observation=await observe(page);
    if(observation.snapshot.stateSha256!==step.after.authoritative.snapshot.stateSha256)throw new Error('Screenshot no longer belongs to last recorded action');
    if(settle.stableSamples<2||settle.finiteRunningAnimations!==0||!settle.canvasReady||!snapshot.canvasTrees.length||snapshot.canvasTrees.some(canvas=>canvas.webgl?.contextLost))throw new Error('Screenshot renderer is not settled and healthy');
    if (settle.visibleImageFailures?.length) {
      const skipped = { scenario: currentScenario, file, at: new Date().toISOString(), reason: 'visible-image-decode-failure', visibleImageFailures: settle.visibleImageFailures, viewport: snapshot.viewport };
      log.screenshotSkips.push(skipped); await writeLog();
      throw new Error('Screenshot resource decoding failed: '+JSON.stringify(skipped));
    }
    await page.screenshot({ path: filePath, fullPage: false, animations: 'allow', type: 'png' });
    const bytes = await fs.readFile(filePath);
    const entry = { scenario: currentScenario, file, at: new Date().toISOString(), sha256: sha(bytes), bytes: bytes.length, viewport: snapshot.viewport, canvasTrees: snapshot.canvasTrees, layoutCandidates: snapshot.layoutCandidates, focus: snapshot.focus, visibleControls: snapshot.controls, imageReadiness: settle, mapAssetCache: snapshot.assetCache, playerState: snapshot.state };
    if(log.uiStates.some(item=>item.sha256===entry.sha256))throw new Error('Duplicate screenshot content is not a new UI state');
    if((await observe(page)).snapshot.stateSha256!==observation.snapshot.stateSha256)throw new Error('Authority changed while screenshot was being captured');
    Object.assign(entry,{uiStateId,uiChange,uiChangeReason,requirements,behaviorStepId:step.id,sourceRevision:SOURCE_REVISION});
    log.uiStates.push({id:uiStateId,stepId:step.id,change:uiChange,viewport,resolution,sha256:entry.sha256});
    log.screenshots.push(entry); await writeLog(); console.log(JSON.stringify({ CAPTURED: { scenario: entry.scenario, file: entry.file, sha256: entry.sha256, bytes: entry.bytes, viewport: entry.viewport, canvas: entry.canvasTrees.map(x => ({ rect: x.canvas.rect, width: x.canvasWidthAttr, height: x.canvasHeightAttr, webgl: x.webgl })), visibleImageFailures: entry.imageReadiness.visibleImageFailures, finiteRunningAnimations: entry.imageReadiness.finiteRunningAnimations, playerState: entry.playerState } }));
  }

  async function checkStep(spec) {
    const step=log.steps.at(-1);if(!step||!spec.name||!Array.isArray(spec.path)||spec.path.length<3||!['before','after'].includes(spec.path[0])||!['visible','authoritative'].includes(spec.path[1]))throw new Error('CHECK requires a before/after visible/authoritative path');
    if(!Object.hasOwn(spec,'expected')||(Object.hasOwn(spec,'includes')&&(typeof spec.includes!=='string'||!spec.includes.trim())))throw new Error('CHECK needs an expected value and a nonempty includes string');
    let actual=spec.path.reduce((value,key)=>value?.[key],step);
    if(actual===undefined)throw new Error('CHECK path is absent');
    if(Object.hasOwn(spec,'includes')){if(typeof actual!=='string')throw new Error('CHECK includes requires an existing string observation');actual=actual.includes(spec.includes);}
    const assertion={name:spec.name,path:spec.path,...(Object.hasOwn(spec,'includes')?{includes:spec.includes}:{}),actual,expected:spec.expected};step.assertions.push(assertion);await writeLog();
    if(!require('node:util').isDeepStrictEqual(actual,spec.expected))throw new Error('CHECK failed: '+JSON.stringify(assertion));
    console.log(JSON.stringify({CHECKED:assertion,stepId:step.id}));
  }
  async function selectOption(spec) {
    if(!spec.label||typeof spec.value!=='string')throw new Error('SELECT needs visible label and option value');
    const control=page.getByLabel(spec.label,{exact:true});const before=await observe(page),focus=await focusState(page);
    await control.selectOption(spec.value);await recordInput('选择'+spec.label,'real-ui-select',before,focus,{label:spec.label,value:spec.value});
  }
  async function advancePrimary(){
    const before=await observe(page);
    const control=page.getByTestId('fate-domination-primary-action');
    const name=await control.getAttribute('aria-label'),expected=nextPrimaryExpectation(before,name);
    if(!expected||!await control.isVisible()||!await control.isEnabled()){
      const blocked={at:new Date().toISOString(),command:'NEXT',reason:'Primary is unavailable or needs explicit settlement/choice checks',dispatched:false};
      log.blockedInputs.push(blocked);await writeLog();console.log(JSON.stringify({INPUT_BLOCKED:blocked}));return;
    }
    const count=log.steps.length;
    await clickExactText(name);
    if(log.steps.length!==count+1)throw new Error('NEXT did not record exactly one real input');
    for(const key of ['phase','currentPlayerId'])await checkStep({name:`阶段交接-${key}`,path:['after','authoritative',key],expected:expected[key]});
    await checkStep({name:'阶段名称可见',path:['after','visible','phaseText'],includes:phaseLabels[expected.phase],expected:true});
    await checkStep({name:'当前玩家身份可见',path:['after','visible','selfLabel'],expected:`查看玩家 ${Number(expected.currentPlayerId)+1}详情`});
    if(expected.resolutionStep)await checkStep({name:'正式战斗结算已开始',path:['after','authoritative','battleResolution','step'],expected:expected.resolutionStep});
    for(const [key,value] of Object.entries(expected.playerChanges??{}))await checkStep({name:`本次操作-${key}`,path:['after','authoritative','players',before.currentPlayerId,key],expected:value});
    if(expected.playerChanges?.normalAttackPlayed)await checkStep({name:'出牌区显示已打出',path:['after','visible','text'],includes:'已打出',expected:true});
  }
  async function finishEvidence() {
    if(!log.steps.length||log.steps.some(step=>!['visible','authoritative'].every(scope=>step.assertions.some(assertion=>assertion.path?.[0]==='after'&&assertion.path?.[1]===scope))))throw new Error('Every input needs an after-visible and after-authoritative CHECK');
    for(let i=1;i<log.steps.length;i++)if(log.steps[i-1].after.authoritative.snapshot.stateSha256!==log.steps[i].before.authoritative.snapshot.stateSha256||log.steps[i-1].after.authoritative.snapshot.randomCursor!==log.steps[i].before.authoritative.snapshot.randomCursor)throw new Error('Authority changed between recorded actions; cannot claim continuous chain');
    if(log.commandErrors.length||log.pageErrors.length)throw new Error('Errors remain; this run is diagnostic, not PASS');
    if(CATEGORY==='golden') {
      const terminal=log.steps.at(-1),now=await observe(page);
      if(now.round!==11||now.phase!=='complete'||!now.gameOver||!now.visible.gameOver)throw new Error('Golden requires natural round11 + core complete + sys gameover + visible endgame');
      if(!require('node:util').isDeepStrictEqual(now.gameResult,now.systemGameResult))throw new Error('Domain and system gameover disagree');
      if(log.steps[0].before.authoritative.round!==1||log.steps[0].before.authoritative.phase!=='preparation')throw new Error('Natural golden must begin at round1');
      for(let round=1;round<=11;round++)if(!log.steps.some(step=>step.before.authoritative.round===round))throw new Error('Missing natural round '+round);
      if(!terminal.after.authoritative.gameOver||!terminal.after.visible.gameOver)throw new Error('Last real input did not record visible endgame');
      terminal.assertions.push({name:'terminal-gameover',actual:terminal.after.visible.gameOver&&terminal.after.authoritative.gameOver,expected:true});log.terminalStepId=terminal.id;
    }
    log.status='PASS';log.outcome=CATEGORY==='golden'?'Natural eleven-round game reached formal visible endgame':'Declared independent player inputs and assertions completed';await writeLog();
  }


};

if(require.main===module) main().catch(async e => { log.status='FAIL'; log.fatal = { at: new Date().toISOString(), error: String(e), stack: e.stack }; await writeLog().catch(() => {}); console.error(e.stack || e); process.exitCode = 1; }).finally(async () => {
  try { rl?.close(); } catch {}
  try { if (browser?.isConnected()) await browser.close(); } catch {}
  try { budgetHandle?.release?.(); } catch {}
  log.closedAt = new Date().toISOString();
  try { await writeLog(); } catch {}
  try { guard?.release?.(); } catch {}
});

module.exports={readPersistedSnapshot,validateSample,compactState,pendingInputChecks,nextPrimaryExpectation};
