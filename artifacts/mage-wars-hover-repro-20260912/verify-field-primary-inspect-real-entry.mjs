import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('artifacts/mage-wars-hover-repro-20260912/current-real-entry-field');
const url = process.env.MAGE_WARS_FIELD_URL ?? 'http://127.0.0.1:4273/play/mage-wars';
const viewport = { width: 1920, height: 1080, deviceScaleFactor: 1 };

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: viewport.width, height: viewport.height },
  deviceScaleFactor: viewport.deviceScaleFactor,
});

await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem('bg_locale_preference', 'zh-CN');
  window.localStorage.setItem('i18nextLng', 'zh-CN');
});

const page = await context.newPage();
const audits = [];

function assertCondition(condition, message, details) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : '';
    throw new Error(`${message}${suffix}`);
  }
}

async function readOverlayState() {
  return page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="mage-wars-card-magnify-overlay"]');
    if (!overlay) return { attached: false };
    const style = window.getComputedStyle(overlay);
    const content = overlay.querySelector('[data-testid="mage-wars-card-magnify-content"]');
    return {
      attached: true,
      ariaHidden: overlay.getAttribute('aria-hidden'),
      visibility: style.visibility,
      display: style.display,
      opacity: Number.parseFloat(style.opacity || '1'),
      sourceCardId: content?.getAttribute('data-source-card-id') ?? null,
    };
  });
}

async function expectOverlayHidden(label) {
  const overlay = await readOverlayState();
  assertCondition(
    overlay.attached && overlay.ariaHidden === 'true',
    `${label}: 中心 hover/click 后不应打开放大层`,
    overlay,
  );
}

async function expectOverlayVisible(label, sourceCardId) {
  await page.waitForSelector('[data-testid="mage-wars-card-magnify-overlay"][aria-hidden="false"]', { timeout: 5_000 });
  const overlay = await readOverlayState();
  assertCondition(
    overlay.attached && overlay.ariaHidden === 'false' && overlay.sourceCardId === sourceCardId,
    `${label}: 独立放大镜应打开对应卡牌详情`,
    overlay,
  );
}

async function closeOverlay() {
  await page.getByTestId('mage-wars-card-magnify-overlay-close').click();
  await page.waitForFunction(() => (
    document
      .querySelector('[data-testid="mage-wars-card-magnify-overlay"]')
      ?.getAttribute('aria-hidden') === 'true'
  ), undefined, { timeout: 5_000 });
}

async function applySaturatedCreatureActionState() {
  await page.waitForFunction(() => Boolean(window.__BG_TEST_HARNESS__?.state?.get && window.__BG_TEST_HARNESS__?.state?.set), undefined, { timeout: 20_000 });
  await page.evaluate(() => {
    const harness = window.__BG_TEST_HARNESS__;
    const snapshot = harness?.state?.get?.();
    if (!snapshot || !harness?.state?.set) {
      throw new Error('mage-wars state injector unavailable');
    }

    const next = structuredClone(snapshot);
    const [selfId, opponentId] = next.core.playerOrder;
    const pressureObjects = [
      { id: 'mw-test-red-hellion', ownerId: selfId, sourceSpellCardId: 2803, sourceObjectId: 'spell-2803', name: '烈焰狱鬼' },
      { id: 'mw-test-red-imp', ownerId: selfId, sourceSpellCardId: 2801, sourceObjectId: 'spell-2801', name: '火烙魔婴' },
      { id: 'mw-test-red-archer', ownerId: selfId, sourceSpellCardId: 2816, sourceObjectId: 'spell-2816', name: '皇家弓手' },
      { id: 'mw-test-red-angel', ownerId: selfId, sourceSpellCardId: 2907, sourceObjectId: 'spell-2907', name: '灰天使' },
      { id: 'mw-test-red-creature', ownerId: selfId, sourceSpellCardId: 2802, sourceObjectId: 'spell-2802', name: '己方生物' },
      { id: 'mw-test-blue-knight', ownerId: opponentId, sourceSpellCardId: 2909, sourceObjectId: 'spell-2909', name: '西锁骑士' },
      { id: 'mw-test-blue-angel', ownerId: opponentId, sourceSpellCardId: 2907, sourceObjectId: 'spell-2907', name: '对方灰天使' },
      { id: 'mw-test-blue-archer', ownerId: opponentId, sourceSpellCardId: 2816, sourceObjectId: 'spell-2816', name: '对方皇家弓手' },
      { id: 'mw-test-blue-creature', ownerId: opponentId, sourceSpellCardId: 2802, sourceObjectId: 'spell-2802', name: '对方生物' },
      { id: 'mw-test-blue-imp', ownerId: opponentId, sourceSpellCardId: 2801, sourceObjectId: 'spell-2801', name: '对方火烙魔婴' },
    ].map((object, index) => ({
      ...object,
      kind: 'creature',
      zoneId: 'a2',
      life: 6,
      damage: index === 7 ? 2 : 0,
      armor: 0,
      actionReady: object.id === 'mw-test-red-creature' ? false : true,
      guarding: false,
      combatProfilesSource: 'config',
      statusTokens: index === 7 ? { burn: 1 } : {},
      typeLine: '生物',
    }));

    next.sys = {
      ...next.sys,
      phase: 'creatureAction',
    };
    next.core = {
      ...next.core,
      currentPlayerId: selfId,
      phaseActorId: selfId,
      phaseReadyPlayerIds: [],
      turnNumber: 3,
      objects: Object.fromEntries(pressureObjects.map((object) => [object.id, object])),
      players: {
        ...next.core.players,
        [selfId]: {
          ...next.core.players[selfId],
          mageId: 'warlock_apprentice',
          life: 24,
          mageZoneId: 'a2',
          damage: 7,
          mana: 14,
          channeling: 10,
          actionReady: true,
          quickcastReady: true,
          guarding: false,
          spellbookCount: 26,
          preparedSpellSlots: 2,
          preparedSpellCardIds: [1700, 1804],
          discardSpellCardIds: [2224, 1903, 1806],
        },
        [opponentId]: {
          ...next.core.players[opponentId],
          mageId: 'priestess_apprentice',
          life: 24,
          mageZoneId: 'a2',
          damage: 5,
          mana: 18,
          channeling: 10,
          actionReady: true,
          quickcastReady: true,
          guarding: true,
          spellbookCount: 26,
          preparedSpellSlots: 2,
          preparedSpellCardIds: [1901, 3408],
          discardSpellCardIds: [1706],
        },
      },
      arena: next.core.arena.map((zone) => ({
        ...zone,
        occupantIds: zone.id === 'a2' ? [selfId, opponentId] : [],
        objectIds: zone.id === 'a2' ? pressureObjects.map((object) => object.id) : [],
        fieldCardIds: [],
      })),
    };

    return harness.state.set(next);
  });

  await page.waitForFunction(() => {
    const state = window.__BG_TEST_HARNESS__?.state?.get?.();
    const [selfId, opponentId] = state?.core?.playerOrder ?? [];
    const self = selfId ? state?.core?.players?.[selfId] : null;
    const opponent = opponentId ? state?.core?.players?.[opponentId] : null;
    return state?.sys?.phase === 'creatureAction'
      && state?.core?.phaseActorId === selfId
      && state?.core?.objects?.['mw-test-red-creature']?.actionReady === false
      && state?.core?.objects?.['mw-test-red-angel']?.actionReady === true
      && self?.mageZoneId === 'a2'
      && opponent?.mageZoneId === 'a2';
  }, undefined, { timeout: 10_000 });
  await page.waitForTimeout(250);
}

async function readCardAtPoint(card, xRatio = 0.5, yRatio = 0.5) {
  return card.evaluate((element, point) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width * point.xRatio;
    const y = rect.top + rect.height * point.yRatio;
    const hit = document.elementFromPoint(x, y);
    const inspectButton = hit?.closest?.('[data-testid="mage-wars-card-inspect-button"]') ?? null;
    const primaryAction = hit?.closest?.('[data-primary-action="true"]') ?? null;
    const browse = hit?.closest?.('[data-browse-inspectable="true"]') ?? null;
    return {
      point: { x, y },
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      cursor: window.getComputedStyle(element).cursor,
      disabled: element instanceof HTMLButtonElement ? element.disabled : null,
      dataPrimaryAction: element.getAttribute('data-primary-action'),
      dataPrimaryActionState: element.getAttribute('data-primary-action-state'),
      dataBrowseInspectable: element.getAttribute('data-browse-inspectable'),
      dataSecondaryInspect: element.getAttribute('data-secondary-inspect'),
      dataActionReady: element.getAttribute('data-action-ready'),
      dataActionTokenState: element.getAttribute('data-action-token-state'),
      hitTestId: hit?.closest?.('[data-testid]')?.getAttribute('data-testid') ?? null,
      hitInspectButton: Boolean(inspectButton),
      hitPrimaryAction: primaryAction === element,
      hitBrowseInspectable: Boolean(browse),
      hitTag: hit?.tagName ?? null,
    };
  }, { xRatio, yRatio });
}

async function readInspectButton(card) {
  const button = card.locator('xpath=..').getByTestId('mage-wars-card-inspect-button').first();
  const count = await button.count();
  if (count === 0) return null;
  return button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      opacity: Number.parseFloat(style.opacity || '1'),
      pointerEvents: style.pointerEvents,
      hitInspectButton: Boolean(hit?.closest?.('[data-testid="mage-wars-card-inspect-button"]')),
      hitTestId: hit?.closest?.('[data-testid]')?.getAttribute('data-testid') ?? null,
    };
  });
}

async function readSelectedSource() {
  return page.evaluate(() => ({
    selectedSourceObjectId: document.querySelector('[data-testid="mage-wars-zone-field-card"][data-field-card-role="source"]')?.getAttribute('data-object-id') ?? null,
    actionDockVisible: Boolean(document.querySelector('[data-testid="mage-wars-selected-ability-action-dock"]')),
  }));
}

async function auditFieldCard({ label, objectId, sourceCardId, expectedState, expectedCursor }) {
  const card = page.locator(`[data-testid="mage-wars-zone-field-card"][data-object-id="${objectId}"]`).first();
  await card.waitFor({ state: 'visible', timeout: 10_000 });

  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  const beforeHover = await readCardAtPoint(card);
  const beforeInspect = await readInspectButton(card);

  assertCondition(beforeHover.dataPrimaryAction === 'true', `${label}: 本体必须声明为主操作对象`, beforeHover);
  assertCondition(beforeHover.dataPrimaryActionState === expectedState, `${label}: 主操作可用性不符合预期`, beforeHover);
  assertCondition(beforeHover.dataBrowseInspectable !== 'true', `${label}: 本体不能是整卡浏览放大入口`, beforeHover);
  assertCondition(beforeHover.dataSecondaryInspect === 'true', `${label}: 必须保留独立放大镜入口`, beforeHover);
  assertCondition(!/zoom-in/.test(beforeHover.cursor), `${label}: 本体 hover 不能给放大光标`, beforeHover);
  assertCondition(new RegExp(expectedCursor).test(beforeHover.cursor), `${label}: 本体光标应表达 ${expectedCursor}`, beforeHover);
  assertCondition(beforeHover.hitPrimaryAction === true, `${label}: 中心点必须命中本体主操作`, beforeHover);
  assertCondition(beforeHover.hitInspectButton === false, `${label}: 中心点不能命中放大镜`, beforeHover);

  await page.mouse.move(beforeHover.point.x, beforeHover.point.y);
  await page.waitForTimeout(250);
  const centerHover = await readCardAtPoint(card);
  const inspectAfterHover = await readInspectButton(card);
  await expectOverlayHidden(`${label} hover`);
  assertCondition(inspectAfterHover?.opacity >= 0.95, `${label}: hover 后放大镜必须显示`, inspectAfterHover);
  assertCondition(inspectAfterHover?.pointerEvents === 'auto', `${label}: hover 后放大镜必须可点`, inspectAfterHover);
  assertCondition(inspectAfterHover?.hitInspectButton === true, `${label}: hover 后放大镜中心必须真实命中`, inspectAfterHover);
  await page.screenshot({ path: path.join(outDir, `${objectId}-hover.png`), fullPage: false });

  const beforeClickSource = await readSelectedSource();
  await page.mouse.click(centerHover.point.x, centerHover.point.y);
  await page.waitForTimeout(250);
  const afterCenterClick = await readCardAtPoint(card);
  const afterClickSource = await readSelectedSource();
  const overlayAfterCenterClick = await readOverlayState();
  await expectOverlayHidden(`${label} center click`);
  await page.screenshot({ path: path.join(outDir, `${objectId}-center-click.png`), fullPage: false });

  const inspectButton = card.locator('xpath=..').getByTestId('mage-wars-card-inspect-button').first();
  const inspectBox = await inspectButton.boundingBox();
  assertCondition(inspectBox != null, `${label}: 独立放大镜必须有真实坐标`);
  await page.mouse.move(inspectBox.x + inspectBox.width / 2, inspectBox.y + inspectBox.height / 2);
  await page.mouse.click(inspectBox.x + inspectBox.width / 2, inspectBox.y + inspectBox.height / 2);
  await expectOverlayVisible(`${label} inspect`, sourceCardId);
  const selectedSourceAfterInspect = await readSelectedSource();
  await page.screenshot({ path: path.join(outDir, `${objectId}-inspect-overlay.png`), fullPage: false });
  await closeOverlay();

  audits.push({
    label,
    objectId,
    sourceCardId,
    beforeHover,
    beforeInspect,
    centerHover,
    inspectAfterHover,
    beforeClickSource,
    afterCenterClick,
    afterClickSource,
    overlayAfterCenterClick,
    selectedSourceAfterInspect,
    screenshots: [
      `${objectId}-hover.png`,
      `${objectId}-center-click.png`,
      `${objectId}-inspect-overlay.png`,
    ],
  });
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-testid="mage-wars-board"]', { timeout: 30_000 });
  await page.waitForFunction(() => Array.from(document.images)
    .filter((image) => image.getBoundingClientRect().width > 10 && image.getBoundingClientRect().height > 10)
    .every((image) => image.naturalWidth > 0 && image.naturalHeight > 0), undefined, { timeout: 30_000 });
  await applySaturatedCreatureActionState();
  await page.screenshot({ path: path.join(outDir, '00-saturated-creature-action-entry.png'), fullPage: false });

  await auditFieldCard({
    label: '已消耗生物场上卡',
    objectId: 'mw-test-red-creature',
    sourceCardId: '2802',
    expectedState: 'disabled',
    expectedCursor: 'not-allowed',
  });
  await auditFieldCard({
    label: '就绪生物场上卡',
    objectId: 'mw-test-red-angel',
    sourceCardId: '2907',
    expectedState: 'enabled',
    expectedCursor: 'pointer',
  });

  const result = {
    url,
    viewport,
    finalHref: page.url(),
    boardPhase: await page.getByTestId('mage-wars-board').getAttribute('data-mage-wars-phase'),
    overlay: await readOverlayState(),
    audits,
  };
  await writeFile(path.join(outDir, 'field-primary-inspect-audit.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({
    outDir,
    boardPhase: result.boardPhase,
    screenshots: [
      '00-saturated-creature-action-entry.png',
      ...audits.flatMap((audit) => audit.screenshots),
    ],
    summary: audits.map((audit) => ({
      label: audit.label,
      state: audit.beforeHover.dataPrimaryActionState,
      cursor: audit.beforeHover.cursor,
      hoverInspectOpacity: audit.inspectAfterHover?.opacity,
      centerClickOverlayHidden: audit.overlayAfterCenterClick.ariaHidden === 'true',
      inspectOpenedCardId: audit.sourceCardId,
      afterClickSource: audit.afterClickSource,
      selectedSourceAfterInspect: audit.selectedSourceAfterInspect,
    })),
  }, null, 2));
} finally {
  await browser.close();
}
