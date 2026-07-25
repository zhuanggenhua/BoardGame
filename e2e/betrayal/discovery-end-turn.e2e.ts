import { expect, test, type Page } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import type { BetrayalCore } from "../../src/games/betrayal/game";
import {
  createRuntimeCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-core-interactions/discovery-end-turn";
const TARGETS_SCREENSHOT = `${EVIDENCE_DIR}/01-探索后结束回合-选择未知门位.jpg`;
const ORIENTATION_SCREENSHOT = `${EVIDENCE_DIR}/02-探索后结束回合-确认新房间朝向.jpg`;
const DISCOVERY_SCREENSHOT = `${EVIDENCE_DIR}/03-探索后结束回合-发现结果仍阻塞.jpg`;
const END_TURN_ONLY_SCREENSHOT = `${EVIDENCE_DIR}/04-探索后结束回合-只剩结束回合.jpg`;
const NEXT_PLAYER_SCREENSHOT = `${EVIDENCE_DIR}/05-探索后结束回合-结束后下一位行动.jpg`;

type BetrayalHarnessWindow = Window & {
  __BG_TEST_HARNESS__?: {
    state?: {
      get?: () => { core: BetrayalCore };
    };
  };
};

async function readCore(page: Page): Promise<BetrayalCore> {
  const core = await page.evaluate(
    () => (window as BetrayalHarnessWindow).__BG_TEST_HARNESS__?.state?.get?.().core,
  );
  if (!core) {
    throw new Error("山屋惊魂 E2E 缺少当前规则状态");
  }
  return core;
}

test.describe("山屋惊魂探索后结束回合", () => {
  test("探索并结算新房间后行动区只保留结束回合", async ({ page, context }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-discovery-end-turn",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createRuntimeCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await saveScreenshot(page, TARGETS_SCREENSHOT);

    await page.getByTestId("betrayal-room-ground-north").click();
    const placementPanel = page.getByTestId("betrayal-room-placement-panel");
    await expect(placementPanel).toBeVisible();
    await expect(page.getByTestId("betrayal-room-placement-preview")).toBeVisible();
    await saveScreenshot(page, ORIENTATION_SCREENSHOT);

    await setHarnessRandomQueue(page, [0.01]);
    await page.getByTestId("betrayal-room-placement-confirm").click();
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-continue")).toBeVisible();
    const blockedCore = await readCore(page);
    expect(blockedCore.currentPlayer, "发现结果未关闭前不能提前换人").toBe("0");
    await saveScreenshot(page, DISCOVERY_SCREENSHOT);

    await page.getByTestId("betrayal-discovery-continue").click();
    await expect(discoveryPanel).toHaveCount(0);
    const endedCore = await readCore(page);
    expect(endedCore.turnEndedByDiscovery).toBe(true);
    expect(endedCore.recommendedAction).toBe("endTurn");
    expect(endedCore.currentPlayer).toBe("0");

    await expect(page.getByText("探索完成，结束回合")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-endTurn")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-endTurn")).toBeEnabled();
    for (const actionId of ["move", "explore", "trade", "use", "roomEffect"]) {
      await expect(page.getByTestId(`betrayal-action-${actionId}`)).toHaveCount(0);
    }
    await saveScreenshot(page, END_TURN_ONLY_SCREENSHOT);

    await page.getByTestId("betrayal-action-endTurn").click();
    const nextCore = await readCore(page);
    expect(nextCore.currentPlayer).toBe("1");
    expect(nextCore.turnEndedByDiscovery).toBe(false);
    await expect(page.getByTestId("betrayal-current-panel-token-1")).toBeVisible();
    await saveScreenshot(page, NEXT_PLAYER_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-discovery-end-turn", diagnostics },
    ]);
  });
});
