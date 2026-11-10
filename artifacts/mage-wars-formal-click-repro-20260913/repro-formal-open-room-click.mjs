import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outRoot = path.resolve('artifacts/mage-wars-formal-click-repro-20260913');
const baseUrl = (process.env.MAGE_WARS_FORMAL_BASE_URL ?? 'http://127.0.0.1:4273').replace(/\/$/, '');
const gameServerUrl = (process.env.MAGE_WARS_GAME_SERVER_URL ?? 'http://127.0.0.1:18000').replace(/\/$/, '');
const viewport = {
  width: Number(process.env.MAGE_WARS_VIEWPORT_WIDTH ?? 2560),
  height: Number(process.env.MAGE_WARS_VIEWPORT_HEIGHT ?? 1304),
};
const deviceScaleFactor = Number(process.env.MAGE_WARS_DPR ?? 1);
const targetCardIds = (process.env.MAGE_WARS_TARGET_CARD_IDS ?? '2819,2906')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const headless = process.env.MAGE_WARS_HEADLESS !== '0';
const runSlug = `${new Date().toISOString().replace(/[:.]/g, '-')}-${new URL(baseUrl).port || 'default'}`;
const outDir = path.join(outRoot, runSlug);
const artifacts = [];
const timeline = [];
const diagnostics = {
  baseUrl,
  gameServerUrl,
  viewport,
  deviceScaleFactor,
  targetCardIds,
  headless,
  hostErrors: [],
  guestErrors: [],
};

await mkdir(outDir, { recursive: true });

function toPlainError(error) {
  if (!error) return String(error);
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return String(error);
}

function record(step, data = {}) {
  timeline.push({
    step,
    at: new Date().toISOString(),
    ...data,
  });
}

async function saveJson(name, data) {
  const filePath = path.join(outDir, name);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  artifacts.push(filePath);
  return filePath;
}

async function saveScreenshot(page, name) {
  const filePath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false, animations: 'disabled', timeout: 20_000 });
  artifacts.push(filePath);
  return filePath;
}

async function addCleanBrowserDefaults(context) {
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('bg_locale_preference', 'zh-CN');
    window.localStorage.setItem('i18nextLng', 'zh-CN');
    window.localStorage.setItem('audio_muted', 'true');
    window.localStorage.setItem('audio_master_volume', '0');
    window.localStorage.setItem('audio_sfx_volume', '0');
    window.localStorage.setItem('audio_bgm_volume', '0');
    window.localStorage.setItem('tutorial_skip', '1');
    const guestId = `mage-wars-formal-repro-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    window.localStorage.setItem('guest_id', guestId);
    window.sessionStorage.setItem('guest_id', guestId);
    document.cookie = `bg_guest_id=${encodeURIComponent(guestId)}; path=/; SameSite=Lax`;
  });
}

function attachDiagnostics(page, bucket) {
  page.on('pageerror', (error) => {
    bucket.push(`pageerror:${error.stack ?? error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    bucket.push(`console:${message.location().url}:${message.location().lineNumber}:${message.text()}`);
  });
}

async function clickCenter(page, locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  await locator.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(120);
  const audit = await locator.evaluate((element, clickLabel) => {
    const rect = element.getBoundingClientRect();
    const point = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const hit = document.elementFromPoint(point.x, point.y);
    const chain = [];
    let cursor = hit;
    while (cursor && chain.length < 8) {
      if (cursor instanceof HTMLElement) {
        chain.push({
          tag: cursor.tagName,
          testId: cursor.getAttribute('data-testid'),
          tutorialId: cursor.getAttribute('data-tutorial-id'),
          primaryAction: cursor.getAttribute('data-primary-action'),
          browseInspectable: cursor.getAttribute('data-browse-inspectable'),
          secondaryInspect: cursor.getAttribute('data-secondary-inspect'),
          className: cursor.className,
        });
      }
      cursor = cursor.parentElement;
    }
    const style = window.getComputedStyle(element);
    return {
      label: clickLabel,
      point,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      element: {
        tag: element.tagName,
        testId: element.getAttribute('data-testid'),
        tutorialId: element.getAttribute('data-tutorial-id'),
        sourceCardId: element.getAttribute('data-source-card-id'),
        ariaLabel: element.getAttribute('aria-label'),
        disabled: element instanceof HTMLButtonElement ? element.disabled : null,
        cursor: style.cursor,
        primaryAction: element.getAttribute('data-primary-action'),
        primaryActionState: element.getAttribute('data-primary-action-state'),
        browseInspectable: element.getAttribute('data-browse-inspectable'),
        secondaryInspect: element.getAttribute('data-secondary-inspect'),
        selectedCount: element.getAttribute('data-selected-count'),
        copyCount: element.getAttribute('data-copy-count'),
      },
      hit: {
        tag: hit instanceof HTMLElement ? hit.tagName : null,
        testId: hit instanceof HTMLElement ? hit.closest('[data-testid]')?.getAttribute('data-testid') ?? null : null,
        tutorialId: hit instanceof HTMLElement ? hit.closest('[data-tutorial-id]')?.getAttribute('data-tutorial-id') ?? null : null,
        inspectButton: hit instanceof HTMLElement
          ? Boolean(hit.closest('[data-testid="mage-wars-card-inspect-button"]'))
          : false,
        primaryActionIsElement: hit instanceof HTMLElement
          ? hit.closest('[data-primary-action="true"]') === element
          : false,
        browseInspectable: hit instanceof HTMLElement
          ? Boolean(hit.closest('[data-browse-inspectable="true"]'))
          : false,
        containsHit: Boolean(hit && element.contains(hit)),
      },
      hitChain: chain,
    };
  }, label);
  await page.mouse.move(audit.point.x, audit.point.y);
  await page.waitForTimeout(160);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(450);
  return audit;
}

async function readBoardState(page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="mage-wars-board"]');
    const plan = document.querySelector('[data-testid="mage-wars-plan-spells"]');
    const turnEnd = document.querySelector('[data-testid="mage-wars-turn-end"]');
    const overlay = document.querySelector('[data-testid="mage-wars-card-magnify-overlay"]');
    const overlayContent = overlay?.querySelector('[data-testid="mage-wars-card-magnify-content"]');
    const cards = Array.from(document.querySelectorAll('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id]'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          sourceCardId: element.getAttribute('data-source-card-id'),
          ariaLabel: element.getAttribute('aria-label'),
          primaryAction: element.getAttribute('data-primary-action'),
          primaryActionState: element.getAttribute('data-primary-action-state'),
          browseInspectable: element.getAttribute('data-browse-inspectable'),
          secondaryInspect: element.getAttribute('data-secondary-inspect'),
          selectedCount: element.getAttribute('data-selected-count'),
          copyCount: element.getAttribute('data-copy-count'),
          disabled: element instanceof HTMLButtonElement ? element.disabled : null,
          visible: rect.width > 0 && rect.height > 0,
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        };
      });
    const drafts = Array.from(document.querySelectorAll('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]'))
      .map((element) => ({
        sourceCardId: element.getAttribute('data-source-card-id'),
        ariaLabel: element.getAttribute('aria-label'),
        slot: element.getAttribute('data-plan-slot-index'),
      }));
    return {
      href: window.location.href,
      phase: board?.getAttribute('data-mage-wars-phase') ?? null,
      phaseActorId: board?.getAttribute('data-mage-wars-phase-actor-id') ?? null,
      currentPlayerId: board?.getAttribute('data-mage-wars-current-player-id') ?? null,
      turnNumber: board?.getAttribute('data-mage-wars-turn-number') ?? null,
      planButton: plan ? {
        text: plan.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        disabled: plan instanceof HTMLButtonElement ? plan.disabled : null,
        progress: plan.getAttribute('data-plan-progress'),
      } : null,
      turnEndButton: turnEnd ? {
        text: turnEnd.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        disabled: turnEnd instanceof HTMLButtonElement ? turnEnd.disabled : null,
      } : null,
      overlay: overlay ? {
        ariaHidden: overlay.getAttribute('aria-hidden'),
        text: overlay.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
        sourceCardId: overlayContent?.getAttribute('data-source-card-id') ?? null,
      } : null,
      shelf: {
        planningEnabled: document
          .querySelector('[data-testid="mage-wars-desktop-spellbook-shelf"]')
          ?.getAttribute('data-planning-enabled') ?? null,
        visibleCardCount: document
          .querySelector('[data-testid="mage-wars-desktop-spellbook-shelf"]')
          ?.getAttribute('data-visible-card-count') ?? null,
      },
      cards,
      drafts,
    };
  });
}

async function seedMatchCredentials(context, matchId, playerId, credentials) {
  await context.addInitScript(({ matchId, playerId, credentials }) => {
    window.localStorage.setItem(`match_creds_${matchId}`, JSON.stringify({
      matchID: matchId,
      playerID: playerId,
      credentials,
      gameName: 'mage-wars',
      updatedAt: Date.now(),
    }));
  }, { matchId, playerId, credentials });
}

async function joinGuest(browser, matchId) {
  const guestContext = await browser.newContext({ viewport, deviceScaleFactor, locale: 'zh-CN' });
  await addCleanBrowserDefaults(guestContext);
  const guestPage = await guestContext.newPage();
  attachDiagnostics(guestPage, diagnostics.guestErrors);
  const response = await guestPage.request.post(`${gameServerUrl}/games/mage-wars/${matchId}/join`, {
    data: {
      playerID: '1',
      playerName: 'MageWars-Repro-Guest',
    },
  });
  if (!response.ok()) {
    throw new Error(`第二席辅助加入失败：HTTP ${response.status()} ${await response.text().catch(() => '')}`);
  }
  const data = await response.json();
  if (!data?.playerCredentials) {
    throw new Error(`第二席辅助加入没有返回凭证：${JSON.stringify(data)}`);
  }
  await seedMatchCredentials(guestContext, matchId, '1', data.playerCredentials);
  await guestPage.goto(`${baseUrl}/play/mage-wars/match/${matchId}?playerID=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await guestPage.waitForSelector('[data-testid="mage-wars-board"]', { timeout: 60_000 });
  return { guestContext, guestPage, guestCredentials: data.playerCredentials };
}

async function readPhase(page) {
  return page.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase', { timeout: 800 }).catch(() => null);
}

async function clickIfEnabled(page, testId, label) {
  const locator = page.getByTestId(testId);
  if (!await locator.isVisible({ timeout: 400 }).catch(() => false)) return false;
  if (!await locator.isEnabled({ timeout: 400 }).catch(() => false)) return false;
  const audit = await clickCenter(page, locator, label);
  record(label, { audit });
  return true;
}

async function advanceBothPlayersToPlanning(hostPage, guestPage) {
  const preparationPhases = new Set(['reset', 'channel', 'upkeep']);
  for (let index = 0; index < 40; index += 1) {
    const phases = await Promise.all([readPhase(hostPage), readPhase(guestPage)]);
    record('phase-poll', { index, phases });
    if (phases.every((phase) => phase === 'planning')) return;
    for (const page of [hostPage, guestPage]) {
      const phase = await readPhase(page);
      if (!preparationPhases.has(phase ?? '')) continue;
      await clickIfEnabled(page, 'mage-wars-turn-end', `推进准备阶段-${phase}`);
    }
    await Promise.all([hostPage.waitForTimeout(180), guestPage.waitForTimeout(180)]);
  }
  throw new Error(`正式开房流程未能自然推进到计划阶段：${JSON.stringify(await Promise.all([readBoardState(hostPage), readBoardState(guestPage)]))}`);
}

async function findVisibleSpellbookCard(page) {
  await clickIfEnabled(page, 'mage-wars-spellbook-category-creature', '切换到生物分类');
  const seenPages = [];
  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    const state = await readBoardState(page);
    seenPages.push(state.cards);
    for (const id of targetCardIds) {
      const card = state.cards.find((candidate) => candidate.sourceCardId === id && candidate.visible);
      if (card) {
        return { cardId: id, seenPages };
      }
    }
    const next = page.getByTestId('mage-wars-spellbook-next-page');
    if (!await next.isVisible({ timeout: 500 }).catch(() => false)) break;
    if (!await next.isEnabled({ timeout: 500 }).catch(() => false)) break;
    await clickCenter(page, next, `法术书翻到下一页-${pageIndex + 1}`);
  }
  const fallback = seenPages.flat().find((candidate) => candidate.visible);
  if (!fallback?.sourceCardId) {
    throw new Error(`计划阶段没有可见法术书卡牌：${JSON.stringify(seenPages)}`);
  }
  return { cardId: fallback.sourceCardId, seenPages, fallbackUsed: true };
}

async function auditCardCenterClick(page, cardId, label) {
  const locator = page.locator(`[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="${cardId}"]`).first();
  await locator.waitFor({ state: 'visible', timeout: 20_000 });
  await page.mouse.move(4, 4);
  await page.waitForTimeout(150);
  const before = await readBoardState(page);
  const hoverProbe = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hitBeforeMove = document.elementFromPoint(point.x, point.y);
    return {
      point,
      card: {
        sourceCardId: element.getAttribute('data-source-card-id'),
        ariaLabel: element.getAttribute('aria-label'),
        disabled: element instanceof HTMLButtonElement ? element.disabled : null,
        cursor: window.getComputedStyle(element).cursor,
        primaryAction: element.getAttribute('data-primary-action'),
        primaryActionState: element.getAttribute('data-primary-action-state'),
        browseInspectable: element.getAttribute('data-browse-inspectable'),
        secondaryInspect: element.getAttribute('data-secondary-inspect'),
      },
      hitBeforeMove: {
        testId: hitBeforeMove instanceof HTMLElement ? hitBeforeMove.closest('[data-testid]')?.getAttribute('data-testid') ?? null : null,
        tutorialId: hitBeforeMove instanceof HTMLElement ? hitBeforeMove.closest('[data-tutorial-id]')?.getAttribute('data-tutorial-id') ?? null : null,
        inspectButton: hitBeforeMove instanceof HTMLElement
          ? Boolean(hitBeforeMove.closest('[data-testid="mage-wars-card-inspect-button"]'))
          : false,
        primaryActionIsCard: hitBeforeMove instanceof HTMLElement
          ? hitBeforeMove.closest('[data-primary-action="true"]') === element
          : false,
        browseInspectable: hitBeforeMove instanceof HTMLElement
          ? Boolean(hitBeforeMove.closest('[data-browse-inspectable="true"]'))
          : false,
      },
    };
  });
  await page.mouse.move(hoverProbe.point.x, hoverProbe.point.y);
  await page.waitForTimeout(300);
  const afterHover = await readBoardState(page);
  const hoverScreenshot = await saveScreenshot(page, `${label}-hover`);
  const clickAudit = await clickCenter(page, locator, `${label}-中心点击`);
  const afterClick = await readBoardState(page);
  const clickScreenshot = await saveScreenshot(page, `${label}-after-center-click`);
  const beforeDraftCount = before.drafts.length;
  const afterDraftCount = afterClick.drafts.length;
  const overlayOpened = afterClick.overlay?.ariaHidden === 'false';
  const planned = afterDraftCount > beforeDraftCount
    || afterClick.drafts.some((draft) => draft.sourceCardId === String(cardId));
  return {
    label,
    cardId: String(cardId),
    before,
    hoverProbe,
    afterHover,
    clickAudit,
    afterClick,
    screenshots: { hoverScreenshot, clickScreenshot },
    verdict: overlayOpened && !planned
      ? 'REPRODUCED_CENTER_CLICK_OPENED_MAGNIFY_WITHOUT_PLANNING'
      : planned && !overlayOpened
        ? 'NOT_REPRODUCED_CENTER_CLICK_PLANNED_WITHOUT_MAGNIFY'
        : 'INCONCLUSIVE',
  };
}

const browser = await chromium.launch({ headless });
let hostContext;
let guestContext;
let hostPage;
let guestPage;

try {
  hostContext = await browser.newContext({ viewport, deviceScaleFactor, locale: 'zh-CN' });
  await addCleanBrowserDefaults(hostContext);
  hostPage = await hostContext.newPage();
  attachDiagnostics(hostPage, diagnostics.hostErrors);

  record('open-home');
  await hostPage.goto(`${baseUrl}/?homeStyle=classic&game=mage-wars`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await hostPage.waitForSelector('[data-testid="game-details-modal-root"]:visible', { timeout: 90_000 });
  await saveScreenshot(hostPage, '01-formal-home-game-details');

  const detailsModal = hostPage.locator('[data-testid="game-details-modal-root"]:visible').last();
  await clickCenter(hostPage, detailsModal.getByTestId('game-details-open-create-room'), '大厅点击创建房间');
  const createRoomModal = hostPage.getByTestId('create-room-modal').last();
  await createRoomModal.waitFor({ state: 'visible', timeout: 30_000 });
  await createRoomModal.getByTestId('create-room-name-input').fill(`Mage Wars 正式点击复现 ${Date.now()}`);
  await saveScreenshot(hostPage, '02-formal-create-room-modal');
  await clickCenter(hostPage, createRoomModal.getByTestId('create-room-confirm-button'), '确认通用建房弹窗');

  await hostPage.waitForSelector('[data-testid="mage-wars-mage-selection-gate"]', { timeout: 45_000 });
  await saveScreenshot(hostPage, '03-formal-spellbook-selection');
  await clickCenter(
    hostPage,
    hostPage.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice'),
    '选择P1兽王标准法术书',
  );
  await clickCenter(hostPage, hostPage.getByTestId('mage-wars-mage-selection-seat-1'), '切换到P2席位');
  await clickCenter(
    hostPage,
    hostPage.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice'),
    '选择P2女祭司标准法术书',
  );
  await saveScreenshot(hostPage, '04-formal-spellbook-selection-complete');
  await clickCenter(hostPage, hostPage.getByTestId('mage-wars-mage-selection-confirm'), '确认法师法术书并创建正式房间');

  await hostPage.waitForURL(/\/play\/mage-wars\/match\/[^/?]+\?playerID=0/, { timeout: 60_000 });
  const matchId = new URL(hostPage.url()).pathname.split('/').pop();
  if (!matchId) throw new Error(`正式开房后 URL 没有 matchId：${hostPage.url()}`);
  await hostPage.waitForSelector('[data-testid="mage-wars-board"]', { timeout: 90_000 });
  await saveScreenshot(hostPage, '05-formal-match-host-board-entry');
  record('formal-match-created', {
    matchId,
    hostUrl: hostPage.url(),
    hostState: await readBoardState(hostPage),
    hostCredentialsKeys: await hostPage.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('match_creds_'))),
  });

  const guest = await joinGuest(browser, matchId);
  guestContext = guest.guestContext;
  guestPage = guest.guestPage;
  await saveScreenshot(guestPage, '06-formal-match-guest-board-entry');
  record('guest-joined-for-phase-progression', {
    matchId,
    guestUrl: guestPage.url(),
    guestState: await readBoardState(guestPage),
  });

  await advanceBothPlayersToPlanning(hostPage, guestPage);
  await saveScreenshot(hostPage, '07-formal-planning-phase-before-card-click');
  record('planning-entered', {
    hostState: await readBoardState(hostPage),
    guestState: await readBoardState(guestPage),
  });

  const target = await findVisibleSpellbookCard(hostPage);
  await saveJson('visible-spellbook-pages.json', target);
  const targetAudit = await auditCardCenterClick(hostPage, target.cardId, `08-card-${target.cardId}`);
  record('target-card-center-click-audit', targetAudit);

  const remainingCards = (await readBoardState(hostPage)).cards
    .filter((card) => card.visible && card.sourceCardId && card.sourceCardId !== String(target.cardId));
  let secondAudit = null;
  if (remainingCards.length > 0 && targetAudit.verdict !== 'REPRODUCED_CENTER_CLICK_OPENED_MAGNIFY_WITHOUT_PLANNING') {
    secondAudit = await auditCardCenterClick(hostPage, remainingCards[0].sourceCardId, `09-card-${remainingCards[0].sourceCardId}`);
    record('second-card-center-click-audit', secondAudit);
  }

  const finalState = await readBoardState(hostPage);
  const result = {
    status: targetAudit.verdict === 'REPRODUCED_CENTER_CLICK_OPENED_MAGNIFY_WITHOUT_PLANNING'
      || secondAudit?.verdict === 'REPRODUCED_CENTER_CLICK_OPENED_MAGNIFY_WITHOUT_PLANNING'
      ? 'reproduced'
      : 'not-reproduced',
    reason: 'formal-open-room-real-mouse-center-click',
    matchId,
    hostUrl: hostPage.url(),
    guestUrl: guestPage.url(),
    targetAudit,
    secondAudit,
    finalState,
    diagnostics,
    timeline,
    artifacts,
  };
  await saveJson('formal-open-room-card-click-result.json', result);
  console.log(JSON.stringify({
    outDir,
    status: result.status,
    matchId,
    target: {
      cardId: targetAudit.cardId,
      verdict: targetAudit.verdict,
      clickPoint: targetAudit.clickAudit.point,
      hit: targetAudit.clickAudit.hit,
      beforeDrafts: targetAudit.before.drafts,
      afterDrafts: targetAudit.afterClick.drafts,
      overlay: targetAudit.afterClick.overlay,
    },
    second: secondAudit ? {
      cardId: secondAudit.cardId,
      verdict: secondAudit.verdict,
      clickPoint: secondAudit.clickAudit.point,
      hit: secondAudit.clickAudit.hit,
      beforeDrafts: secondAudit.before.drafts,
      afterDrafts: secondAudit.afterClick.drafts,
      overlay: secondAudit.afterClick.overlay,
    } : null,
    screenshots: artifacts.filter((entry) => entry.endsWith('.png')),
    resultJson: path.join(outDir, 'formal-open-room-card-click-result.json'),
  }, null, 2));
} catch (error) {
  const failure = {
    status: 'blocked-or-failed-before-reproduction',
    error: toPlainError(error),
    currentHostUrl: hostPage?.url?.() ?? null,
    currentGuestUrl: guestPage?.url?.() ?? null,
    hostState: hostPage ? await readBoardState(hostPage).catch((stateError) => ({ error: toPlainError(stateError) })) : null,
    guestState: guestPage ? await readBoardState(guestPage).catch((stateError) => ({ error: toPlainError(stateError) })) : null,
    diagnostics,
    timeline,
    artifacts,
  };
  if (hostPage && !hostPage.isClosed()) {
    await saveScreenshot(hostPage, 'failure-host-current-screen').catch(() => null);
  }
  if (guestPage && !guestPage.isClosed()) {
    await saveScreenshot(guestPage, 'failure-guest-current-screen').catch(() => null);
  }
  await saveJson('formal-open-room-card-click-failure.json', failure);
  console.error(JSON.stringify({
    outDir,
    status: failure.status,
    error: failure.error,
    currentHostUrl: failure.currentHostUrl,
    currentGuestUrl: failure.currentGuestUrl,
    screenshots: artifacts.filter((entry) => entry.endsWith('.png')),
    failureJson: path.join(outDir, 'formal-open-room-card-click-failure.json'),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await guestContext?.close().catch(() => {});
  await hostContext?.close().catch(() => {});
  await browser.close().catch(() => {});
}
