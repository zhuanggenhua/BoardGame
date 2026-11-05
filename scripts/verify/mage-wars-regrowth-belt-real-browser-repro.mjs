import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= '1';

const BASE_URL = process.env.BG_REPRO_URL ?? 'http://127.0.0.1:4273';
const GAME_SERVER_BASE_URL = process.env.BG_REPRO_GAME_SERVER_URL
  ?? process.env.VITE_GAME_SERVER_URL
  ?? 'http://127.0.0.1:18000';
const TARGET_PATH = process.env.BG_REPRO_PATH ?? '/play/mage-wars?playerID=0';
const REQUESTED_TARGET_URL = process.env.BG_REPRO_TARGET_URL ?? `${BASE_URL}${TARGET_PATH}`;
const ONLINE_MATCH = process.env.BG_REPRO_ONLINE_MATCH === '1';
const HEADLESS = process.env.BG_REPRO_HEADLESS !== '0';
const VIEWPORT_WIDTH = Number(process.env.BG_REPRO_VIEWPORT_WIDTH ?? 1920);
const VIEWPORT_HEIGHT = Number(process.env.BG_REPRO_VIEWPORT_HEIGHT ?? 1080);
const TEST_API_TOKEN_FILE = process.env.TEST_API_TOKEN_FILE
  ? join(process.cwd(), process.env.TEST_API_TOKEN_FILE)
  : join(process.cwd(), 'temp', 'e2e', 'shared-test-api-token.txt');
const OUT_DIR = join(
  process.cwd(),
  'artifacts',
  'mage-wars-regrowth-belt-real-browser-repro',
  new Date().toISOString().replace(/[:.]/g, '-'),
);

const CARD_ID = 3707;
const CARD_SELECTOR = `[data-testid="mage-wars-desktop-prepared-card"][data-source-card-id="${CARD_ID}"]`;
const SELF_MAGE_SELECTOR = '[data-testid="mage-wars-zone-mage-entity"][data-player-id="0"]';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureOutDir() {
  mkdirSync(OUT_DIR, { recursive: true });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveTestApiToken() {
  if (process.env.TEST_API_TOKEN?.trim()) {
    return process.env.TEST_API_TOKEN.trim();
  }
  if (!existsSync(TEST_API_TOKEN_FILE)) {
    return null;
  }
  const token = readFileSync(TEST_API_TOKEN_FILE, 'utf8').trim();
  return token || null;
}

async function readJsonResponse(response) {
  const text = await response.text().catch(() => '');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { text };
  }
}

async function expectOkResponse(response, label) {
  const payload = await readJsonResponse(response);
  if (!response.ok()) {
    throw new Error(`${label} failed: ${response.status()} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function seedMatchCredentials(context, page, matchId, playerId, credentials) {
  const payload = {
    matchID: matchId,
    playerID: playerId,
    credentials,
    gameName: 'mage-wars',
    updatedAt: Date.now(),
  };
  const setCredentials = ({ matchId, payload }) => {
    localStorage.setItem(`match_creds_${matchId}`, JSON.stringify(payload));
    window.dispatchEvent(new Event('match-credentials-changed'));
  };
  await context.addInitScript(setCredentials, { matchId, payload });
  await page.addInitScript(setCredentials, { matchId, payload });
  if (page.url().startsWith(BASE_URL)) {
    await page.evaluate(setCredentials, { matchId, payload });
  }
}

async function waitForMatchAvailable(page, matchId, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;
  while (Date.now() < deadline) {
    const response = await page.request.get(`${GAME_SERVER_BASE_URL}/games/mage-wars/${matchId}`).catch((error) => {
      lastStatus = error?.message ?? String(error);
      return null;
    });
    if (response?.ok()) {
      return true;
    }
    lastStatus = response ? `${response.status()} ${await response.text().catch(() => '')}` : lastStatus;
    await sleep(500);
  }
  throw new Error(`Mage Wars online match unavailable: ${matchId}; lastStatus=${lastStatus}`);
}

async function createOnlineMageWarsMatch(context, page) {
  const guestId = `mage_wars_regrowth_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const createResponse = await page.request.post(`${GAME_SERVER_BASE_URL}/games/mage-wars/create`, {
    data: {
      numPlayers: 2,
      setupData: {
        guestId,
        ownerKey: `guest:${guestId}`,
        ownerType: 'guest',
      },
    },
  });
  const createData = await expectOkResponse(createResponse, 'Mage Wars online match create');
  const matchId = createData.matchID;
  if (!matchId) {
    throw new Error(`Mage Wars online match create returned no matchID: ${JSON.stringify(createData)}`);
  }

  const claimResponse = await page.request.post(`${GAME_SERVER_BASE_URL}/games/mage-wars/${matchId}/claim-seat`, {
    data: {
      playerID: '0',
      playerName: 'MageWars-Regrowth-Host-E2E',
      guestId,
    },
  });
  const claimData = await expectOkResponse(claimResponse, 'Mage Wars host claim-seat');
  if (!claimData.playerCredentials) {
    throw new Error(`Mage Wars host claim-seat returned no credentials: ${JSON.stringify(claimData)}`);
  }

  const guestJoinResponse = await page.request.post(`${GAME_SERVER_BASE_URL}/games/mage-wars/${matchId}/join`, {
    data: {
      playerID: '1',
      playerName: 'MageWars-Regrowth-Guest-E2E',
    },
  });
  const guestJoinData = await expectOkResponse(guestJoinResponse, 'Mage Wars guest join');
  if (!guestJoinData.playerCredentials) {
    throw new Error(`Mage Wars guest join returned no credentials: ${JSON.stringify(guestJoinData)}`);
  }

  await waitForMatchAvailable(page, matchId);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await seedMatchCredentials(context, page, matchId, '0', claimData.playerCredentials);

  return {
    mode: 'online-match',
    matchId,
    hostCredentials: claimData.playerCredentials,
    guestCredentials: guestJoinData.playerCredentials,
    targetUrl: `${BASE_URL}/play/mage-wars/match/${matchId}?playerID=0`,
    stateInjectionBoundary: 'online match is created through the real game server; /test/inject-state only moves the already-open official table to a legal prepared-spell starting point before player input begins',
  };
}

function buildRegrowthBeltPreparedState(snapshot) {
  if (!snapshot?.core?.players?.['0'] || !snapshot?.core?.players?.['1']) {
    throw new Error('Mage Wars repro requires players 0 and 1 in state');
  }

  const next = cloneJson(snapshot);
  const turnOrder = Array.isArray(next.core.playerOrder) && next.core.playerOrder.length > 0
    ? next.core.playerOrder
    : ['0', '1'];
  const currentPlayerIndex = Math.max(0, turnOrder.indexOf('0'));
  next.sys = {
    ...next.sys,
    matchId: next.sys?.matchId,
    turnOrder,
    currentPlayerIndex,
    phase: 'initiativeQuickcast',
    decisionEpoch: typeof next.sys?.decisionEpoch === 'number'
      ? next.sys.decisionEpoch + 1
      : 1,
    interaction: {
      current: undefined,
      queue: [],
      isBlocked: false,
    },
    responseWindow: {
      current: undefined,
    },
    resolution: undefined,
    flowHalted: false,
  };
  next.core = {
    ...next.core,
    currentPlayerId: '0',
    phaseActorId: '0',
    phaseReadyPlayerIds: [],
    players: {
      ...next.core.players,
      0: {
        ...next.core.players['0'],
        mageId: 'beastmaster_apprentice',
        mana: 20,
        actionReady: true,
        quickcastReady: true,
        preparedSpellSlots: 1,
        preparedSpellCardIds: [CARD_ID],
      },
      1: {
        ...next.core.players['1'],
        actionReady: true,
        quickcastReady: true,
      },
    },
  };
  return next;
}

async function readOnlineState(page, runtime) {
  const token = resolveTestApiToken();
  if (!token) {
    throw new Error(`Missing test API token; checked TEST_API_TOKEN and ${TEST_API_TOKEN_FILE}`);
  }
  const response = await page.request.get(`${GAME_SERVER_BASE_URL}/test/get-state/${runtime.matchId}`, {
    headers: {
      'X-Test-Token': token,
      'X-Test-Player-Id': '0',
      'X-Test-Player-Credentials': runtime.hostCredentials,
    },
  });
  const payload = await expectOkResponse(response, 'Mage Wars online get-state');
  if (!payload.state) {
    throw new Error(`Mage Wars online get-state returned no state: ${JSON.stringify(payload)}`);
  }
  return payload.state;
}

async function injectOnlineState(page, runtime, state) {
  const token = resolveTestApiToken();
  if (!token) {
    throw new Error(`Missing test API token; checked TEST_API_TOKEN and ${TEST_API_TOKEN_FILE}`);
  }
  const response = await page.request.post(`${GAME_SERVER_BASE_URL}/test/inject-state`, {
    headers: {
      'X-Test-Token': token,
      'X-Test-Player-Id': '0',
      'X-Test-Player-Credentials': runtime.hostCredentials,
      'Content-Type': 'application/json',
    },
    data: {
      matchId: runtime.matchId,
      state,
    },
  });
  await expectOkResponse(response, 'Mage Wars online inject-state');
}

async function readHarnessState(page) {
  return page.evaluate(() => window.__BG_TEST_HARNESS__?.state?.get?.() ?? null);
}

async function readCurrentState(page, runtime) {
  if (runtime.mode === 'online-match') {
    return readOnlineState(page, runtime);
  }
  return readHarnessState(page);
}

async function waitForStatePredicate(page, runtime, predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() < deadline) {
    lastState = await readCurrentState(page, runtime).catch((error) => ({ error: error?.message ?? String(error) }));
    if (predicate(lastState)) {
      return lastState;
    }
    await sleep(250);
  }
  return lastState;
}

async function waitForVisibleImages(page) {
  await page.waitForFunction(() => Array.from(document.images)
    .filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 10 && rect.height > 10;
    })
    .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), undefined, {
    timeout: 30_000,
  }).catch(() => undefined);
}

async function capture(page, name) {
  const path = join(OUT_DIR, name);
  await waitForVisibleImages(page);
  await page.screenshot({ path, fullPage: false, animations: 'disabled', timeout: 20_000 });
  return path;
}

async function readSnapshot(page, label, stateSnapshot = null) {
  return page.evaluate(({ cardSelector, selfMageSelector, label, stateSnapshot }) => {
    const summarizeElementInPage = (element) => {
      if (!element) return null;
      const node = element.closest('[data-testid]') ?? element;
      return {
        tagName: node.tagName.toLowerCase(),
        testId: node.getAttribute('data-testid'),
        sourceCardId: node.getAttribute('data-source-card-id'),
        playerId: node.getAttribute('data-player-id'),
        primaryAction: node.getAttribute('data-primary-action'),
        primaryActionState: node.getAttribute('data-primary-action-state'),
        secondaryInspect: node.getAttribute('data-secondary-inspect'),
        selected: node.getAttribute('data-selected'),
        disabled: node.hasAttribute('disabled'),
        ariaLabel: node.getAttribute('aria-label'),
        className: typeof node.className === 'string' ? node.className : null,
      };
    };
    const rectOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x * 10) / 10,
        y: Math.round(rect.y * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        bottom: Math.round(rect.bottom * 10) / 10,
      };
    };
    const pointAudit = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { exists: false };
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        exists: true,
        rect: rectOf(element),
        center: {
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
        },
        element: summarizeElementInPage(element),
        hit: summarizeElementInPage(hit),
        hitInsideElement: Boolean(hit && element.contains(hit)),
        hitInspectButton: Boolean(hit?.closest('[data-testid="mage-wars-card-inspect-button"]')),
        hitMagnifyOverlay: Boolean(hit?.closest('[data-testid="mage-wars-card-magnify-overlay"]')),
        cursor: window.getComputedStyle(element).cursor,
      };
    };
    const card = document.querySelector(cardSelector);
    const selfMage = document.querySelector(selfMageSelector);
    const harnessState = stateSnapshot ?? window.__BG_TEST_HARNESS__?.state?.get?.();
    const player = harnessState?.core?.players?.['0'];
    const objects = Object.values(harnessState?.core?.objects ?? {});
    const cardRelatedObjects = objects
      .filter((object) => object?.sourceSpellCardId === 3707)
      .map((object) => ({
        id: object.id,
        kind: object.kind,
        ownerId: object.ownerId,
        sourceSpellCardId: object.sourceSpellCardId,
        name: object.name,
        zoneId: object.zoneId,
        anchoredToPlayerId: object.anchoredToPlayerId,
        attackOrTraitLine: object.attackOrTraitLine,
        rulesText: object.rulesText,
      }));
    const bodyText = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';

    return {
      label,
      href: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      phase: harnessState?.sys?.phase ?? null,
      currentPlayerId: harnessState?.core?.currentPlayerId ?? null,
      phaseActorId: harnessState?.core?.phaseActorId ?? null,
      card: pointAudit(cardSelector),
      selfMage: pointAudit(selfMageSelector),
      selfMageRole: selfMage?.getAttribute('role') ?? null,
      selectedCardFrameCount: document.querySelectorAll('[data-testid="mage-wars-selected-card-frame"]').length,
      targetMageRoleCount: Array.from(document.querySelectorAll('[data-testid="mage-wars-zone-mage-entity"]'))
        .filter((element) => element.getAttribute('role') === 'button').length,
      magnifyOverlayOpen: document.querySelector('[data-testid="mage-wars-card-magnify-overlay"]')?.getAttribute('aria-hidden') === 'false',
      cardSelected: card?.getAttribute('data-selected') === 'true',
      cardPrimaryActionState: card?.getAttribute('data-primary-action-state') ?? null,
      cardDisabled: card?.hasAttribute('disabled') ?? null,
      player: player
        ? {
            mana: player.mana,
            quickcastReady: player.quickcastReady,
            actionReady: player.actionReady,
            preparedSpellCardIds: player.preparedSpellCardIds,
            preparedSpellSlots: player.preparedSpellSlots,
          }
        : null,
      cardRelatedObjects,
      visibleTextIncludesRegrowthBelt: bodyText.includes('重生腰带'),
    };
  }, { cardSelector: CARD_SELECTOR, selfMageSelector: SELF_MAGE_SELECTOR, label, stateSnapshot });
}

async function centerOf(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
}

async function seedRegrowthBeltPreparedState(page, runtime) {
  if (runtime.mode === 'online-match') {
    const snapshot = await readOnlineState(page, runtime);
    const next = buildRegrowthBeltPreparedState(snapshot);
    await injectOnlineState(page, runtime, next);
    await sleep(800);
  } else {
    await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.state?.get?.() && window.__BG_TEST_HARNESS__?.state?.set), undefined, {
      timeout: 10_000,
    });
    const snapshot = await readHarnessState(page);
    const next = buildRegrowthBeltPreparedState(snapshot);
    await page.evaluate((nextState) => {
      const harness = window.__BG_TEST_HARNESS__;
      if (!harness?.state?.set) {
        throw new Error('Mage Wars test harness state injector unavailable');
      }
      return harness.state.set(nextState);
    }, next);
  }

  const stateAfterSeed = await waitForStatePredicate(page, runtime, (state) => (
    state?.sys?.phase === 'initiativeQuickcast'
    && state?.core?.phaseActorId === '0'
    && state?.core?.players?.['0']?.preparedSpellCardIds?.[0] === CARD_ID
  ), 10_000);
  if (stateAfterSeed?.sys?.phase !== 'initiativeQuickcast') {
    throw new Error(`Mage Wars prepared state injection did not settle: ${JSON.stringify(stateAfterSeed)}`);
  }

  await page.locator(CARD_SELECTOR).waitFor({ state: 'visible', timeout: 10_000 }).catch(async (error) => {
    if (runtime.mode !== 'online-match') {
      throw error;
    }
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForSelector('[data-testid="mage-wars-board"]', { timeout: 120_000 });
    await page.locator(CARD_SELECTOR).waitFor({ state: 'visible', timeout: 10_000 });
  });
}

async function run() {
  ensureOutDir();
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'zh-CN');
    localStorage.setItem('bg_locale_preference', 'zh-CN');
    localStorage.setItem('tutorial_skip', '1');
    localStorage.setItem('audio_muted', 'true');
    localStorage.setItem('audio_master_volume', '0');
    localStorage.setItem('audio_sfx_volume', '0');
    localStorage.setItem('audio_bgm_volume', '0');
  });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text(), at: new Date().toISOString() }));
  page.on('pageerror', (error) => logs.push({ type: 'pageerror', text: error.message, at: new Date().toISOString() }));

  let runtime = null;
  try {
    try {
      runtime = ONLINE_MATCH
        ? await createOnlineMageWarsMatch(context, page)
        : {
            mode: 'local-test-route',
            targetUrl: REQUESTED_TARGET_URL,
            stateInjectionBoundary: 'local test route uses window.__BG_TEST_HARNESS__ only to enter a legal prepared-spell starting point before player input begins',
          };

      await page.goto(runtime.targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForSelector('[data-testid="mage-wars-board"]', { timeout: 120_000 });
      await seedRegrowthBeltPreparedState(page, runtime);
      await page.locator(CARD_SELECTOR).waitFor({ state: 'visible', timeout: 10_000 });

      const beforeHoverPoint = await centerOf(page, CARD_SELECTOR);
      await page.mouse.move(beforeHoverPoint.x, beforeHoverPoint.y);
      await sleep(250);
      const beforeClickState = await readCurrentState(page, runtime);
      const beforeClick = await readSnapshot(page, 'before-card-click', beforeClickState);
      const beforeClickScreenshot = await capture(page, '01-before-click-regrowth-belt.png');

      await page.mouse.click(beforeHoverPoint.x, beforeHoverPoint.y);
      await sleep(350);
      const afterCardClickState = await readCurrentState(page, runtime);
      const afterCardClick = await readSnapshot(page, 'after-card-click', afterCardClickState);
      const afterCardClickScreenshot = await capture(page, '02-after-click-regrowth-belt-target-highlight.png');

      const magePoint = await centerOf(page, SELF_MAGE_SELECTOR);
      await page.mouse.move(magePoint.x, magePoint.y);
      await sleep(150);
      const beforeMageClickState = await readCurrentState(page, runtime);
      const beforeMageClick = await readSnapshot(page, 'before-mage-click', beforeMageClickState);
      await page.mouse.click(magePoint.x, magePoint.y);
      const settledState = await waitForStatePredicate(page, runtime, (state) => {
        const player = state?.core?.players?.['0'];
        const objects = Object.values(state?.core?.objects ?? {});
        return Boolean(
          player
          && !player.preparedSpellCardIds?.includes(CARD_ID)
          && player.mana === 14
          && objects.some((object) => (
            object?.sourceSpellCardId === CARD_ID
            && object.kind === 'equipment'
            && object.anchoredToPlayerId === '0'
          )),
        );
      }, 5_000);
      await sleep(250);
      const afterMageClickState = settledState?.core ? settledState : await readCurrentState(page, runtime);
      const afterMageClick = await readSnapshot(page, 'after-mage-click', afterMageClickState);
      const afterMageClickScreenshot = await capture(page, '03-after-click-own-mage-regrowth-equipped.png');

      const regrowthEquipment = afterMageClick.cardRelatedObjects.find((object) => (
        object.kind === 'equipment'
        && object.sourceSpellCardId === CARD_ID
        && object.anchoredToPlayerId === '0'
      ));
      const passChecks = {
        cardVisibleBeforeClick: beforeClick.card?.exists === true,
        cardCenterHitsCardBody: beforeClick.card?.hitInsideElement === true
          && beforeClick.card?.hitInspectButton === false
          && beforeClick.card?.hitMagnifyOverlay === false,
        cardPrimaryActionEnabledBeforeClick: beforeClick.cardPrimaryActionState === 'enabled'
          && beforeClick.cardDisabled === false,
        noMagnifyBeforeClick: beforeClick.magnifyOverlayOpen === false,
        cardSelectedAfterCardClick: afterCardClick.cardSelected === true,
        ownMageBecomesTargetAfterCardClick: afterCardClick.selfMageRole === 'button'
          && afterCardClick.targetMageRoleCount >= 1,
        mageCenterHitsMageBeforeClick: beforeMageClick.selfMage?.hitInsideElement === true
          && beforeMageClick.selfMage?.hitMagnifyOverlay === false,
        noMagnifyAfterCardClick: afterCardClick.magnifyOverlayOpen === false,
        cardLeavesPreparedAfterMageClick: afterMageClick.player
          ? !afterMageClick.player.preparedSpellCardIds?.includes(CARD_ID)
          : false,
        manaSpentAfterMageClick: beforeClick.player && afterMageClick.player
          ? afterMageClick.player.mana === beforeClick.player.mana - 6
          : false,
        regrowthEquipmentCreatedOnMage: Boolean(regrowthEquipment),
        noMagnifyAfterMageClick: afterMageClick.magnifyOverlayOpen === false,
      };
      const passed = Object.values(passChecks).every(Boolean);

      const result = {
        status: passed ? 'PASS' : 'FAIL',
        runtime: {
          ...runtime,
          requestedTargetUrl: REQUESTED_TARGET_URL,
          gameServerBaseUrl: GAME_SERVER_BASE_URL,
          viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
        },
        targetUrl: runtime.targetUrl,
        outDir: OUT_DIR,
        screenshots: {
          beforeClick: beforeClickScreenshot,
          afterCardClick: afterCardClickScreenshot,
          afterMageClick: afterMageClickScreenshot,
        },
        snapshots: {
          beforeClick,
          afterCardClick,
          beforeMageClick,
          afterMageClick,
        },
        passChecks,
        logs,
      };
      writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify(result, null, 2));
      console.log(JSON.stringify({
        status: result.status,
        runtime: result.runtime,
        targetUrl: runtime.targetUrl,
        outDir: OUT_DIR,
        screenshots: result.screenshots,
        summary: {
          cardCenterHitInspectButton: beforeClick.card?.hitInspectButton ?? null,
          cardCenterHitInsideCard: beforeClick.card?.hitInsideElement ?? null,
          mageCenterHitInsideMage: beforeMageClick.selfMage?.hitInsideElement ?? null,
          mageCenterHitElement: beforeMageClick.selfMage?.hit ?? null,
          beforePrimaryActionState: beforeClick.cardPrimaryActionState,
          selectedAfterCardClick: afterCardClick.cardSelected,
          preparedAfterMageClick: afterMageClick.player?.preparedSpellCardIds ?? null,
          manaBefore: beforeClick.player?.mana ?? null,
          manaAfter: afterMageClick.player?.mana ?? null,
          regrowthObjectsAfter: afterMageClick.cardRelatedObjects.length,
          regrowthEquipment,
          magnifyOverlayOpenAfter: afterMageClick.magnifyOverlayOpen,
          passChecks,
        },
      }, null, 2));
      if (!passed) {
        throw new Error(`Regrowth Belt real-browser check failed: ${JSON.stringify(passChecks)}`);
      }
    } catch (error) {
      const failureScreenshot = join(OUT_DIR, '00-failure-page.png');
      let pageState = null;
      let captureError = null;
      try {
        pageState = await page.evaluate(() => ({
          href: window.location.href,
          title: document.title,
          hasBoard: Boolean(document.querySelector('[data-testid="mage-wars-board"]')),
          bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 2000) ?? '',
          loaderText: document.querySelector('#initial-loader')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
          loaderHtml: document.querySelector('#initial-loader')?.outerHTML.slice(0, 2000) ?? null,
        }));
        await page.screenshot({ path: failureScreenshot, fullPage: false, animations: 'disabled', timeout: 20_000 });
      } catch (innerError) {
        captureError = {
          message: innerError?.message,
          stack: innerError?.stack,
        };
      }
      writeFileSync(join(OUT_DIR, 'failure-state.json'), JSON.stringify({
        runtime,
        targetUrl: runtime?.targetUrl ?? REQUESTED_TARGET_URL,
        failureScreenshot,
        pageState,
        captureError,
        logs,
        error: {
          message: error?.message,
          stack: error?.stack,
        },
      }, null, 2));
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((error) => {
  ensureOutDir();
  writeFileSync(join(OUT_DIR, 'error.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2));
  console.error(error);
  process.exit(1);
});
