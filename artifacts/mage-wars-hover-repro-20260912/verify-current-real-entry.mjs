import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('artifacts/mage-wars-hover-repro-20260912/current-real-entry');
const url = process.env.MAGE_WARS_REAL_URL ?? 'http://127.0.0.1:4273/play/mage-wars/tutorial';

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

await context.addInitScript(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const page = await context.newPage();
const audits = [];

async function currentStepId() {
  return page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step').catch(() => null);
}

async function persistPartial(label) {
  const partial = {
    label,
    url,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    currentStep: await currentStepId(),
    drafts: await readDrafts().catch((error) => ({ error: String(error?.message ?? error) })),
    overlay: await readOverlayState().catch((error) => ({ error: String(error?.message ?? error) })),
    audits,
  };
  await writeFile(path.join(outDir, 'hover-audit.partial.json'), JSON.stringify(partial, null, 2), 'utf8');
}

async function waitStep(stepId, timeout = 45000) {
  await page.locator(`[data-tutorial-step="${stepId}"]`).waitFor({ state: 'attached', timeout });
}

async function clickNext() {
  const next = page.getByTestId('tutorial-next-button');
  await next.waitFor({ state: 'visible', timeout: 10000 });
  await next.click();
}

async function clickTutorialTarget(tutorialId) {
  const target = page.locator(`[data-tutorial-id="${tutorialId}"]`).first();
  await target.waitFor({ state: 'visible', timeout: 10000 });
  const before = await target.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
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
      disabled: element instanceof HTMLButtonElement ? element.disabled : null,
      cursor: window.getComputedStyle(element).cursor,
      hitTestId: hit?.closest?.('[data-testid]')?.getAttribute('data-testid') ?? null,
      hitTutorialId: hit?.closest?.('[data-tutorial-id]')?.getAttribute('data-tutorial-id') ?? null,
      containsHit: hit != null && element.contains(hit),
    };
  });
  await target.click({ timeout: 10000 });
  await page.waitForTimeout(250);
  audits.push({
    label: `教程目标点击 ${tutorialId}`,
    before,
    afterStep: await currentStepId(),
  });
  await persistPartial(`after-click-${tutorialId}`);
}

async function readDrafts() {
  return page.locator('[data-testid="mage-wars-desktop-prepared-card"][data-planning-draft="true"]')
    .evaluateAll((elements) => elements.map((element) => ({
      cardId: element.getAttribute('data-source-card-id'),
      slot: element.getAttribute('data-plan-slot-index'),
    })));
}

async function readOverlayState() {
  return page.getByTestId('mage-wars-card-magnify-overlay').evaluate((element) => ({
    hidden: element.getAttribute('aria-hidden'),
    visibleStyle: window.getComputedStyle(element).visibility,
  }));
}

async function readCardAtPoint(card, xRatio, yRatio) {
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
      hitTestId: hit?.closest?.('[data-testid]')?.getAttribute('data-testid') ?? null,
      hitTutorialId: hit?.closest?.('[data-tutorial-id]')?.getAttribute('data-tutorial-id') ?? null,
      hitInspectButton: Boolean(inspectButton),
      hitPrimaryAction: primaryAction === element,
      hitBrowseInspectable: Boolean(browse),
      hitTag: hit?.tagName ?? null,
    };
  }, { xRatio, yRatio });
}

async function readInspectButton(card) {
  const button = card.locator('xpath=..').getByTestId('mage-wars-card-inspect-button');
  const count = await button.count();
  if (count === 0) return null;
  return button.first().evaluate((element) => {
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

async function auditHover(label, card, fileName) {
  await page.mouse.move(4, 4);
  await page.waitForTimeout(150);
  const beforeHover = await readCardAtPoint(card, 0.5, 0.5);
  const beforeInspect = await readInspectButton(card);
  await page.mouse.move(beforeHover.point.x, beforeHover.point.y);
  await page.waitForTimeout(250);
  const centerHover = await readCardAtPoint(card, 0.5, 0.5);
  const upperBodyHover = await readCardAtPoint(card, 0.7, 0.24);
  const afterInspect = await readInspectButton(card);
  const screenshot = path.join(outDir, fileName);
  await page.screenshot({ path: screenshot, fullPage: false });
  audits.push({
    label,
    beforeHover,
    beforeInspect,
    centerHover,
    upperBodyHover,
    afterInspect,
    screenshot,
  });
  await persistPartial(`after-hover-${label}`);
}

async function clickCenter(label, card) {
  const beforeDrafts = await readDrafts();
  const before = await readCardAtPoint(card, 0.5, 0.5);
  await page.mouse.click(before.point.x, before.point.y);
  await page.waitForTimeout(250);
  const after = await readCardAtPoint(card, 0.5, 0.5);
  const afterDrafts = await readDrafts();
  const overlay = await readOverlayState();
  audits.push({
    label,
    click: {
      before,
      after,
      beforeDrafts,
      afterDrafts,
      overlay,
    },
  });
  await persistPartial(`after-click-${label}`);
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (const step of ['intro', 'self-hud', 'opponent-hud', 'stage', 'channel-result', 'spell-card-reading', 'planning-skip']) {
    await waitStep(step);
    await clickNext();
  }

  await waitStep('plan-open-creature-category');
  const categoryStepCard = page.locator('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id]').nth(1);
  await categoryStepCard.waitFor({ state: 'visible', timeout: 10000 });
  await auditHover('plan-open-creature-category 同屏非目标卡', categoryStepCard, '01-category-step-non-target-hover.png');
  await clickCenter('plan-open-creature-category 同屏非目标卡中心点击', categoryStepCard);
  await clickTutorialTarget('mw-spellbook-category-creature');
  await page.screenshot({ path: path.join(outDir, '01b-after-creature-category-click.png'), fullPage: false });

  await waitStep('plan-creature-next-page');
  await clickTutorialTarget('mw-spellbook-next-page');
  await page.screenshot({ path: path.join(outDir, '01c-after-creature-next-page-click.png'), fullPage: false });

  await waitStep('plan-select-wolf');
  const wolfCard = page.locator('[data-tutorial-id="mw-spellbook-card-2819"]').first();
  await wolfCard.waitFor({ state: 'visible', timeout: 10000 });
  const planStepNonTarget = page.locator('[data-testid="mage-wars-desktop-spellbook-card"][data-source-card-id]:not([data-source-card-id="2819"])').first();
  await planStepNonTarget.waitFor({ state: 'visible', timeout: 10000 });

  await auditHover('plan-select-wolf 当前目标丛林灰狼', wolfCard, '02-plan-step-wolf-hover.png');
  await auditHover('plan-select-wolf 同屏非目标卡', planStepNonTarget, '03-plan-step-non-target-hover.png');
  await clickCenter('plan-select-wolf 同屏非目标卡中心点击', planStepNonTarget);
  await clickCenter('plan-select-wolf 当前目标丛林灰狼中心点击', wolfCard);
  await page.screenshot({ path: path.join(outDir, '04-after-wolf-center-click.png'), fullPage: false });

  const result = {
    url,
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    currentStep: await page.locator('[data-tutorial-step]').first().getAttribute('data-tutorial-step'),
    drafts: await readDrafts(),
    overlay: await readOverlayState(),
    audits,
  };
  await writeFile(path.join(outDir, 'hover-audit.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify({
    outDir,
    currentStep: result.currentStep,
    drafts: result.drafts,
    screenshots: [
      '01-category-step-non-target-hover.png',
      '02-plan-step-wolf-hover.png',
      '03-plan-step-non-target-hover.png',
      '04-after-wolf-center-click.png',
    ],
  }, null, 2));
} finally {
  await persistPartial('finally').catch(() => {});
  await browser.close();
}
