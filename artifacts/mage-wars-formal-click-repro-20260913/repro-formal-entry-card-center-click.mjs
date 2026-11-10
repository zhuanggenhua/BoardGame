import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.MAGE_WARS_FORMAL_BASE_URL ?? 'http://127.0.0.1:4275').replace(/\/$/, '');
const gameServerUrl = (process.env.MAGE_WARS_GAME_SERVER_URL ?? 'http://127.0.0.1:18000').replace(/\/$/, '');
const viewport = {
  width: Number(process.env.MAGE_WARS_VIEWPORT_WIDTH ?? 2560),
  height: Number(process.env.MAGE_WARS_VIEWPORT_HEIGHT ?? 1304),
};
const deviceScaleFactor = Number(process.env.MAGE_WARS_DPR ?? 1);
const headless = process.env.MAGE_WARS_HEADLESS !== '0';
const outRoot = path.resolve('artifacts/mage-wars-formal-click-repro-20260913');
const outDir = path.join(
  outRoot,
  `${new Date().toISOString().replace(/[:.]/g, '-')}-formal-entry-card-center-click-${new URL(baseUrl).port || 'default'}`,
);
const artifacts = [];
const diagnostics = { baseUrl, gameServerUrl, viewport, deviceScaleFactor, headless, hostErrors: [] };

await mkdir(outDir, { recursive: true });

function attachDiagnostics(page) {
  page.on('pageerror', (error) => diagnostics.hostErrors.push(`pageerror:${error.stack ?? error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    diagnostics.hostErrors.push(`console:${message.location().url}:${message.location().lineNumber}:${message.text()}`);
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

async function cleanContext(context) {
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
    const guestId = `mage-wars-formal-entry-click-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    window.localStorage.setItem('guest_id', guestId);
    window.sessionStorage.setItem('guest_id', guestId);
    document.cookie = `bg_guest_id=${encodeURIComponent(guestId)}; path=/; SameSite=Lax`;
  });
}

async function clickCenter(page, locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  await locator.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(120);
  const audit = await locator.evaluate((element, clickLabel) => {
    const rect = element.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    const hitElement = hit instanceof HTMLElement ? hit : null;
    const chain = [];
    let cursor = hitElement;
    while (cursor && chain.length < 8) {
      chain.push({
        tag: cursor.tagName,
        testId: cursor.getAttribute('data-testid'),
        primaryAction: cursor.getAttribute('data-primary-action'),
        browseInspectable: cursor.getAttribute('data-browse-inspectable'),
        secondaryInspect: cursor.getAttribute('data-secondary-inspect'),
        className: cursor.className,
      });
      cursor = cursor.parentElement;
    }
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
        sourceCardId: element.getAttribute('data-source-card-id'),
        ariaLabel: element.getAttribute('aria-label'),
        disabled: element instanceof HTMLButtonElement ? element.disabled : null,
        cursor: window.getComputedStyle(element).cursor,
        primaryAction: element.getAttribute('data-primary-action'),
        primaryActionState: element.getAttribute('data-primary-action-state'),
        browseInspectable: element.getAttribute('data-browse-inspectable'),
        selectedCount: element.getAttribute('data-selected-count'),
        copyCount: element.getAttribute('data-copy-count'),
      },
      hit: {
        tag: hitElement?.tagName ?? null,
        closestTestId: hitElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
        inspectButton: Boolean(hitElement?.closest('[data-testid="mage-wars-card-inspect-button"]')),
        primaryActionIsElement: hitElement?.closest('[data-primary-action="true"]') === element,
        browseInspectable: Boolean(hitElement?.closest('[data-browse-inspectable="true"]')),
        containsHit: Boolean(hit && element.contains(hit)),
      },
      hitChain: chain,
    };
  }, label);
  await page.mouse.move(audit.point.x, audit.point.y);
  await page.waitForTimeout(300);
  audit.afterHoverCursor = await locator.evaluate((element) => window.getComputedStyle(element).cursor);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(450);
  return audit;
}

async function readBoardState(page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="mage-wars-board"]');
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
          selectedCount: element.getAttribute('data-selected-count'),
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
      planButton: document.querySelector('[data-testid="mage-wars-plan-spells"]') ? 'present' : null,
      turnEndButton: document.querySelector('[data-testid="mage-wars-turn-end"]') ? 'present' : null,
      shelf: {
        planningEnabled: document.querySelector('[data-testid="mage-wars-desktop-spellbook-shelf"]')?.getAttribute('data-planning-enabled') ?? null,
      },
      overlay: overlay ? {
        ariaHidden: overlay.getAttribute('aria-hidden'),
        sourceCardId: overlayContent?.getAttribute('data-source-card-id') ?? null,
        text: overlay.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
      } : null,
      cards,
      drafts,
    };
  });
}

const browser = await chromium.launch({ headless });
let context;
let page;

try {
  context = await browser.newContext({ viewport, deviceScaleFactor, locale: 'zh-CN' });
  await cleanContext(context);
  page = await context.newPage();
  attachDiagnostics(page);

  await page.goto(`${baseUrl}/?homeStyle=classic&game=mage-wars`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-testid="game-details-modal-root"]:visible', { timeout: 90_000 });
  await saveScreenshot(page, '01-formal-home-game-details');

  const detailsModal = page.locator('[data-testid="game-details-modal-root"]:visible').last();
  await clickCenter(page, detailsModal.getByTestId('game-details-open-create-room'), '大厅点击创建房间');
  const createRoomModal = page.getByTestId('create-room-modal').last();
  await createRoomModal.waitFor({ state: 'visible', timeout: 30_000 });
  await createRoomModal.getByTestId('create-room-name-input').fill(`Mage Wars 正式中心点击复现 ${Date.now()}`);
  await saveScreenshot(page, '02-formal-create-room-modal');
  await clickCenter(page, createRoomModal.getByTestId('create-room-confirm-button'), '确认通用建房弹窗');

  await page.waitForSelector('[data-testid="mage-wars-mage-selection-gate"]', { timeout: 45_000 });
  await saveScreenshot(page, '03-formal-spellbook-selection');
  await clickCenter(
    page,
    page.getByTestId('mage-wars-mage-selection-standard-spellbook-beastmaster_apprentice'),
    '选择P1兽王标准法术书',
  );
  await clickCenter(page, page.getByTestId('mage-wars-mage-selection-seat-1'), '切换到P2席位');
  await clickCenter(
    page,
    page.getByTestId('mage-wars-mage-selection-standard-spellbook-priestess_apprentice'),
    '选择P2女祭司标准法术书',
  );
  await saveScreenshot(page, '04-formal-spellbook-selection-complete');
  await clickCenter(page, page.getByTestId('mage-wars-mage-selection-confirm'), '确认法师法术书并创建正式房间');

  await page.waitForURL(/\/play\/mage-wars\/match\/[^/?]+\?playerID=0/, { timeout: 60_000 });
  await page.waitForSelector('[data-testid="mage-wars-board"]', { timeout: 90_000 });
  await saveScreenshot(page, '05-formal-match-board-before-card-click');
  const before = await readBoardState(page);
  const firstCard = before.cards.find((card) => card.visible);
  if (!firstCard?.sourceCardId) {
    throw new Error(`正式牌桌没有可见法术书卡牌：${JSON.stringify(before)}`);
  }

  const card = page.locator(`[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id="${firstCard.sourceCardId}"]`).first();
  const clickAudit = await clickCenter(page, card, '正式牌桌第一张法术书卡中心点击');
  const after = await readBoardState(page);
  await saveScreenshot(page, '06-formal-match-board-after-card-center-click');

  const beforeDraftCount = before.drafts.length;
  const afterDraftCount = after.drafts.length;
  const overlayOpened = after.overlay?.ariaHidden === 'false';
  const planned = afterDraftCount > beforeDraftCount
    || after.drafts.some((draft) => draft.sourceCardId === firstCard.sourceCardId);
  const result = {
    status: overlayOpened && !planned
      ? 'reproduced-formal-entry-click-opens-magnify-before-planning'
      : planned && !overlayOpened
        ? 'not-reproduced-card-planned'
        : 'inconclusive',
    before,
    clickAudit,
    after,
    diagnostics,
    artifacts,
  };
  await saveJson('formal-entry-card-center-click-result.json', result);
  console.log(JSON.stringify({
    outDir,
    status: result.status,
    target: {
      sourceCardId: firstCard.sourceCardId,
      ariaLabel: firstCard.ariaLabel,
      clickPoint: clickAudit.point,
      cursorBefore: clickAudit.element.cursor,
      cursorAfterHover: clickAudit.afterHoverCursor,
      hit: clickAudit.hit,
      beforePhase: before.phase,
      beforePlanningEnabled: before.shelf.planningEnabled,
      beforeDrafts: before.drafts,
      afterDrafts: after.drafts,
      overlay: after.overlay,
    },
    screenshots: artifacts.filter((entry) => entry.endsWith('.png')),
    resultJson: path.join(outDir, 'formal-entry-card-center-click-result.json'),
  }, null, 2));
} catch (error) {
  const failure = {
    status: 'failed-before-card-center-click',
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    currentUrl: page?.url?.() ?? null,
    boardState: page ? await readBoardState(page).catch((stateError) => ({ error: String(stateError) })) : null,
    diagnostics,
    artifacts,
  };
  if (page && !page.isClosed()) {
    await saveScreenshot(page, 'failure-current-screen').catch(() => null);
  }
  await saveJson('formal-entry-card-center-click-failure.json', failure);
  console.error(JSON.stringify({
    outDir,
    status: failure.status,
    error: failure.error,
    currentUrl: failure.currentUrl,
    screenshots: artifacts.filter((entry) => entry.endsWith('.png')),
    failureJson: path.join(outDir, 'formal-entry-card-center-click-failure.json'),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => {});
  await browser.close().catch(() => {});
}
