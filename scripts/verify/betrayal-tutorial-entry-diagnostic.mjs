import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BG_REPRO_URL ?? "http://127.0.0.1:4274";
const TARGET_PATH = "/play/betrayal/tutorial/basic-setup-and-turn";
const TARGET_URL = `${BASE_URL}${TARGET_PATH}`;
const OUT_DIR = join(
  process.cwd(),
  "artifacts",
  "betrayal-e2e",
  "tutorial-entry-diagnostic",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureOutDir() {
  mkdirSync(OUT_DIR, { recursive: true });
}

async function readSnapshot(page, ms) {
  return page.evaluate((elapsedMs) => {
    const q = (selector) => document.querySelector(selector);
    const text = (element) =>
      element?.textContent?.replace(/\s+/g, " ").trim().slice(0, 600) ?? null;
    const harnessState = window.__BG_TEST_HARNESS__?.state?.get?.();
    const tutorial = harnessState?.sys?.tutorial;
    const contextDiagnostics = window.__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__ ?? null;
    return {
      ms: elapsedMs,
      href: window.location.href,
      readyState: document.readyState,
      hasBoard: Boolean(q('[data-testid="betrayal-board"]')),
      hasCharacterSelect: Boolean(q('[data-testid="betrayal-character-select-screen"]')),
      hasTutorialOverlayCard: Boolean(q('[data-testid="tutorial-overlay-card"]')),
      activeStepDom: q("[data-tutorial-step]")?.getAttribute("data-tutorial-step") ?? null,
      contextDiagnostics,
      tutorial: tutorial
        ? {
            active: tutorial.active ?? null,
            manifestId: tutorial.manifestId ?? null,
            manifestRevision: tutorial.manifestRevision ?? null,
            stepIndex: tutorial.stepIndex ?? null,
            stepId: tutorial.step?.id ?? null,
            stepsLength: tutorial.steps?.length ?? null,
            allowedCommands: tutorial.step?.allowedCommands ?? null,
            aiActions: tutorial.aiActions?.length ?? null,
            stepAiActions: tutorial.step?.aiActions?.length ?? null,
          }
        : null,
      core: harnessState?.core
        ? {
            phase: harnessState.core.phase ?? null,
            currentPlayer: harnessState.core.currentPlayer ?? null,
          }
        : null,
      bodyText: text(document.body),
    };
  });
}

async function main() {
  ensureOutDir();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript(() => {
    window.__E2E_TEST_MODE__ = true;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("i18nextLng", "zh-CN");
    window.localStorage.setItem("boardgame:audio-muted", "true");
  });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (msg) => {
    logs.push({ at: Date.now(), type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (error) => {
    logs.push({ at: Date.now(), type: "pageerror", text: error.message });
  });
  page.on("requestfailed", (request) => {
    logs.push({
      at: Date.now(),
      type: "requestfailed",
      text: `${request.url()} ${request.failure()?.errorText ?? ""}`.trim(),
    });
  });

  const samples = [];
  const startedAt = Date.now();
  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (error) {
    logs.push({ at: Date.now(), type: "goto-error", text: error.message });
  }

  for (let index = 0; index < 30; index += 1) {
    await sleep(2000);
    const snapshot = await readSnapshot(page, Date.now() - startedAt);
    samples.push(snapshot);
    if (snapshot.hasBoard || snapshot.hasTutorialOverlayCard || snapshot.activeStepDom) {
      break;
    }
  }

  const screenshot = join(OUT_DIR, "final.png");
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
  await browser.close();

  const result = {
    targetUrl: TARGET_URL,
    outDir: OUT_DIR,
    screenshot,
    samples,
    logs,
  };
  writeFileSync(join(OUT_DIR, "diagnostic.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    outDir: OUT_DIR,
    screenshot,
    last: samples.at(-1) ?? null,
  }, null, 2));
}

main().catch((error) => {
  ensureOutDir();
  writeFileSync(
    join(OUT_DIR, "error.json"),
    JSON.stringify({ message: error.message, stack: error.stack }, null, 2),
  );
  console.error(error);
  process.exit(1);
});
