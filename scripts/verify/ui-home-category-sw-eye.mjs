import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= '1';

const BASE_URL = process.env.BG_REPRO_URL ?? 'http://127.0.0.1:4273';
const HOME_DIR = join(process.cwd(), 'test-results', 'evidence-screenshots', 'home', 'category-underline', 'selected-style');
const SW_DIR = join(process.cwd(), 'test-results', 'evidence-screenshots', 'summonerwars', 'life-toggle-overlay', 'eye-above-mask');
const VIEWPORT = { width: 1920, height: 1080 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

async function dismissHomeOverlays(page) {
  const candidates = [
    page.getByRole('button', { name: /稍后再说|跳过|关闭|Close|Skip/i }).first(),
    page.locator('[data-testid="close-auth-modal"]').first(),
    page.locator('button[aria-label="Close"]').first(),
  ];
  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 1500 }).catch(() => {});
    }
  }
}

async function captureHome(page) {
  ensureDir(HOME_DIR);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav button', { timeout: 20000 });
  await dismissHomeOverlays(page);
  await sleep(400);

  const categoryButtons = page.locator('nav button');
  const buttonCount = await categoryButtons.count();
  if (buttonCount < 2) {
    throw new Error(`首页分类按钮数量不足: ${buttonCount}`);
  }

  const allButton = categoryButtons.nth(0);
  const secondButton = categoryButtons.nth(1);
  await allButton.waitFor({ state: 'visible' });

  const allMetrics = await measureCategory(page, 0);
  await page.screenshot({ path: join(HOME_DIR, '01-home-all-selected.png'), fullPage: false });
  const allCrop = await allButton.boundingBox();
  if (allCrop) {
    await page.screenshot({
      path: join(HOME_DIR, '02-home-all-selected-crop.png'),
      clip: expandClip(allCrop, 24, 16, VIEWPORT),
    });
  }

  await secondButton.click();
  await sleep(350);
  const secondMetrics = await measureCategory(page, 1);
  const unselectedMetrics = await measureCategory(page, 0);
  await page.screenshot({ path: join(HOME_DIR, '03-home-second-category-selected.png'), fullPage: false });
  const secondCrop = await secondButton.boundingBox();
  if (secondCrop) {
    await page.screenshot({
      path: join(HOME_DIR, '04-home-second-category-selected-crop.png'),
      clip: expandClip(secondCrop, 24, 16, VIEWPORT),
    });
  }

  const navBox = await page.locator('nav').first().boundingBox();
  if (navBox) {
    await page.screenshot({
      path: join(HOME_DIR, '05-home-category-nav.png'),
      clip: expandClip(navBox, 12, 20, VIEWPORT),
    });
  }

  const report = {
    url: page.url(),
    buttonCount,
    allMetrics,
    secondMetrics,
    unselectedAfterSwitch: unselectedMetrics,
  };
  writeFileSync(join(HOME_DIR, 'metrics.json'), JSON.stringify(report, null, 2));
  return report;
}

async function measureCategory(page, index) {
  return page.evaluate((buttonIndex) => {
    const buttons = Array.from(document.querySelectorAll('nav button'));
    const button = buttons[buttonIndex];
    if (!button) return null;
    const style = window.getComputedStyle(button);
    const underline = button.querySelector('.underline-center');
    const underlineStyle = underline ? window.getComputedStyle(underline) : null;
    const rect = button.getBoundingClientRect();
    return {
      text: button.textContent?.trim() ?? '',
      className: button.className,
      fontWeight: style.fontWeight,
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      width: rect.width,
      height: rect.height,
      underline: underlineStyle
        ? {
            width: underlineStyle.width,
            height: underlineStyle.height,
            left: underlineStyle.left,
            bottom: underlineStyle.bottom,
            backgroundColor: underlineStyle.backgroundColor,
            opacity: underlineStyle.opacity,
          }
        : null,
    };
  }, index);
}

function expandClip(box, xPad, yPad, viewport) {
  const x = Math.max(0, box.x - xPad);
  const y = Math.max(0, box.y - yPad);
  const width = Math.min(viewport.width - x, box.width + xPad * 2);
  const height = Math.min(viewport.height - y, box.height + yPad * 2);
  return { x, y, width, height };
}

async function dumpSwDiagnostics(page, label) {
  const diagnostics = await page.evaluate(() => {
    const root = document.querySelector('#root');
    const rescueGate = document.querySelector('[data-testid="game-page-rescue-gate"]');
    return {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      hasGamePage: Boolean(document.querySelector('[data-game-page]')),
      gameId: document.querySelector('[data-game-page]')?.getAttribute('data-game-id') ?? null,
      hasLifeToggle: Boolean(document.querySelector('[data-testid="sw-life-toggle"]')),
      hasMapLayer: Boolean(document.querySelector('[data-testid="sw-map-layer"]')),
      hasDebugPanel: Boolean(document.querySelector('[data-testid="debug-panel"]')),
      hasRescueGate: Boolean(rescueGate),
      rescueGateText: rescueGate?.textContent?.slice(0, 280) || '',
      harnessReady: window.__BG_TEST_HARNESS__?.state?.isRegistered?.() === true,
      lastError: window.__BG_LAST_ERROR_CONTEXT__?.message || '',
      visibleButtons: Array.from(document.querySelectorAll('button'))
        .filter((button) => {
          const style = window.getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        })
        .slice(0, 20)
        .map((button) => (button.textContent || button.getAttribute('aria-label') || '').trim().slice(0, 40)),
      rootText: (root?.textContent || '').replace(/\s+/g, ' ').slice(0, 400),
    };
  });
  writeFileSync(join(SW_DIR, `${label}-diagnostics.json`), JSON.stringify(diagnostics, null, 2));
  await page.screenshot({ path: join(SW_DIR, `${label}-page.png`), fullPage: false }).catch(() => {});
  return diagnostics;
}

async function captureSummonerWars(page) {
  ensureDir(SW_DIR);
  await page.addInitScript(() => {
    window.__E2E_SKIP_IMAGE_GATE__ = true;
    window.__BG_HIDE_DEBUG_PANEL__ = true;
  });
  await page.goto(`${BASE_URL}/play/summonerwars?skipInitialization=true&numPlayers=2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => Boolean(
    document.querySelector('#root [data-game-page]')
    || document.querySelector('#root [data-testid="debug-panel"]')
    || document.querySelector('[data-testid="game-page-rescue-gate"]')
    || window.__BG_TEST_HARNESS__?.state?.isRegistered?.() === true
  ), { timeout: 20000 }).catch(() => {});
  const bootDiagnostics = await dumpSwDiagnostics(page, '00-sw-boot');
  if (!bootDiagnostics.hasLifeToggle) {
    await page.waitForFunction(() => (
      window.__BG_TEST_HARNESS__?.state?.isRegistered?.() === true
      && typeof window.__BG_TEST_HARNESS__?.command?.dispatch === 'function'
    ), { timeout: 15000 });
    const dispatched = await page.evaluate(async () => {
      const harness = window.__BG_TEST_HARNESS__;
      const dispatch = async (type, playerId, payload) => {
        await harness.command.dispatch({ type, playerId, payload });
      };
      await dispatch('sw:select_faction', '0', { factionId: 'necromancer' });
      await dispatch('sw:select_faction', '1', { factionId: 'paladin' });
      await dispatch('sw:player_ready', '1', {});
      await dispatch('sw:host_start_game', '0', {});
      return true;
    });
    if (!dispatched) {
      throw new Error('未能通过 TestHarness 开始召唤师战争对局');
    }
    await page.waitForSelector('[data-testid="sw-map-layer"]', { timeout: 30000 });
  }
  await dumpSwDiagnostics(page, '00-sw-before-toggle');
  await page.waitForSelector('[data-testid="sw-life-toggle"]', { timeout: 25000 });
  await page.waitForFunction(() => {
    const pageRoot = document.querySelector('[data-game-page][data-game-id="summonerwars"]');
    if (!pageRoot) return false;
    const shimmerNodes = Array.from(pageRoot.querySelectorAll('[style*="img-shimmer"]'));
    return shimmerNodes.filter((node) => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0.01) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length === 0;
  }, { timeout: 15000 }).catch(() => {});
  await sleep(250);

  const layout = await page.evaluate(() => {
    const toRect = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const toggle = document.querySelector('[data-testid="sw-life-toggle"]');
    const scale = document.querySelector('[data-testid="sw-map-scale"]');
    const mapLayer = document.querySelector('[data-testid="sw-map-layer"]');
    const uiLayer = document.querySelector('[data-testid="sw-map-layer"]')?.parentElement?.querySelector('.z-20');
    const overlay = toggle?.closest('.z-30') ?? null;
    const shades = uiLayer ? Array.from(uiLayer.querySelectorAll(':scope > div')) : [];
    const zOf = (node) => (node ? window.getComputedStyle(node).zIndex : null);
    return {
      toggleRect: toRect(toggle),
      scaleRect: toRect(scale),
      overlayRect: toRect(overlay),
      mapLayerZ: zOf(mapLayer),
      overlayZ: overlay ? zOf(overlay) : zOf(toggle?.parentElement),
      uiLayerZ: uiLayer ? zOf(uiLayer) : null,
      toggleVisible: toggle ? window.getComputedStyle(toggle).visibility : null,
      toggleOpacity: toggle ? window.getComputedStyle(toggle).opacity : null,
      toggleBg: toggle ? window.getComputedStyle(toggle).backgroundColor : null,
      toggleBorder: toggle ? window.getComputedStyle(toggle).borderColor : null,
      toggleBoxShadow: toggle ? window.getComputedStyle(toggle).boxShadow : null,
      ariaPressed: toggle?.getAttribute('aria-pressed') ?? null,
      shadeCount: shades.length,
    };
  });

  await page.screenshot({ path: join(SW_DIR, '01-sw-board-eye-default.png'), fullPage: false });
  if (layout.toggleRect) {
    await page.screenshot({
      path: join(SW_DIR, '02-sw-eye-crop-default.png'),
      clip: expandClip({
        x: Math.min(layout.scaleRect?.left ?? layout.toggleRect.left, layout.toggleRect.left),
        y: Math.min(layout.scaleRect?.top ?? layout.toggleRect.top, layout.toggleRect.top),
        width: (layout.toggleRect.right - Math.min(layout.scaleRect?.left ?? layout.toggleRect.left, layout.toggleRect.left)),
        height: Math.max(layout.toggleRect.height, layout.scaleRect?.height ?? 0),
      }, 28, 24, VIEWPORT),
    });
  }

  await page.getByTestId('sw-life-toggle').click();
  await sleep(250);
  const pressed = await page.getByTestId('sw-life-toggle').getAttribute('aria-pressed');
  await page.screenshot({ path: join(SW_DIR, '03-sw-board-eye-pressed.png'), fullPage: false });
  if (layout.toggleRect) {
    await page.screenshot({
      path: join(SW_DIR, '04-sw-eye-crop-pressed.png'),
      clip: expandClip({
        x: Math.min(layout.scaleRect?.left ?? layout.toggleRect.left, layout.toggleRect.left),
        y: Math.min(layout.scaleRect?.top ?? layout.toggleRect.top, layout.toggleRect.top),
        width: (layout.toggleRect.right - Math.min(layout.scaleRect?.left ?? layout.toggleRect.left, layout.toggleRect.left)),
        height: Math.max(layout.toggleRect.height, layout.scaleRect?.height ?? 0),
      }, 28, 24, VIEWPORT),
    });
  }

  const report = {
    url: page.url(),
    layout,
    pressedAfterClick: pressed,
  };
  writeFileSync(join(SW_DIR, 'metrics.json'), JSON.stringify(report, null, 2));
  return report;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  locale: 'zh-CN',
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const output = {};
try {
  if (process.env.SKIP_HOME !== '1') {
    output.home = await captureHome(page);
  }
  output.summonerwars = await captureSummonerWars(page);
  writeFileSync(join(process.cwd(), 'test-results', 'evidence-screenshots', 'ui-home-sw-verify.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} finally {
  await browser.close();
}
