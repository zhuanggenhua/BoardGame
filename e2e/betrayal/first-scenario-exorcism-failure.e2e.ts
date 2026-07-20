import { resolve } from "path";
import { expect, test, type Page } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import type { BetrayalCore } from "../../src/games/betrayal/game";
import {
  createFirstScenarioReadyToExorciseRuntimeCore,
  expectVisiblePhysicalDiceBox,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  waitForPhysicalDiceSettled,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = resolve(process.cwd(), "evidence/山屋惊魂-驱魔失败伤害链");
const READY_SCREENSHOT = `${EVIDENCE_DIR}/01-驱魔失败伤害链-驱魔前.jpg`;
const TARGET_SCREENSHOT = `${EVIDENCE_DIR}/02-驱魔失败伤害链-选择杰克之灵房间.jpg`;
const DICE_SCREENSHOT = `${EVIDENCE_DIR}/03-驱魔失败伤害链-骰盘停稳失败.jpg`;
const RESULT_SCREENSHOT = `${EVIDENCE_DIR}/04-驱魔失败伤害链-失败伤害结果.jpg`;
const CLOSE_READY_SCREENSHOT = `${EVIDENCE_DIR}/05-驱魔失败伤害链-关闭前.jpg`;
const DISMISSED_SCREENSHOT = `${EVIDENCE_DIR}/06-驱魔失败伤害链-关闭后回牌桌.jpg`;

type HarnessSnapshot = {
  core: BetrayalCore;
};

type HarnessWindow = Window & {
  __BG_TEST_HARNESS__?: {
    state?: {
      get?: () => HarnessSnapshot;
    };
  };
};

function setExplorerSafeForFailure(core: BetrayalCore, playerId: string): void {
  const traits = { might: 4, speed: 4, knowledge: 4, sanity: 4 };
  if (core.currentExplorer.playerId === playerId) {
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: { ...core.currentExplorer.traits, ...traits },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];
    return;
  }

  core.otherExplorers = core.otherExplorers.map((explorer) =>
    explorer.playerId === playerId
      ? {
          ...explorer,
          traits: { ...explorer.traits, ...traits },
          inventory: [],
        }
      : explorer,
  );
}

function physicalTraitTotal(core: BetrayalCore, playerId: string): number {
  const explorer = [core.currentExplorer, ...core.otherExplorers].find(
    (candidate) => candidate.playerId === playerId,
  );
  if (!explorer) {
    throw new Error(`山屋驱魔 E2E 找不到玩家 ${playerId}`);
  }
  return explorer.traits.might + explorer.traits.speed;
}

async function readCoreState(page: Page): Promise<BetrayalCore> {
  return page.evaluate(() => {
    const snapshot = (
      window as HarnessWindow
    ).__BG_TEST_HARNESS__?.state?.get?.();
    if (!snapshot?.core) {
      throw new Error("betrayal test harness state reader unavailable");
    }
    return snapshot.core;
  });
}

test.describe("山屋惊魂驱魔失败伤害完整链路", () => {
  test("最终驱魔失败从真实入口到伤害结算再关闭回牌桌", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-exorcism-failure-full-chain",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    const core = createFirstScenarioReadyToExorciseRuntimeCore();
    const actorId = core.currentExplorer.playerId;
    const teammateId = core.otherExplorers.find(
      (explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId,
    )!.playerId;
    setExplorerSafeForFailure(core, actorId);
    setExplorerSafeForFailure(core, teammateId);
    core.recentRoll = null;
    core.latestDiscovery = null;
    core.latestDiscoveryOwnerPlayerId = null;

    const actorPhysicalBefore = physicalTraitTotal(core, actorId);
    const teammatePhysicalBefore = physicalTraitTotal(core, teammateId);

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/驱魔|驱散杰克之灵/);
    await expect(page.getByTestId("betrayal-room-focus-target")).toContainText(
      /驱魔|驱散杰克之灵/,
    );
    await expect(
      page.getByTestId("betrayal-room-basement-landing"),
    ).toHaveAttribute("data-direct-target", "true");
    await expect(
      page.getByTestId("betrayal-room-focus-card-highlight-basement-landing"),
    ).toHaveAttribute("data-highlight-shape", "room");
    await saveScreenshot(page, READY_SCREENSHOT);

    await saveScreenshot(page, TARGET_SCREENSHOT);
    await setHarnessRandomQueue(page, [0.01, 0.01, 0.01, 0.01]);
    await page.getByTestId("betrayal-room-basement-landing").click();

    const exorciseRollReview = page.getByTestId(
      "betrayal-exorcise-roll-review",
    );
    await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
    const rollPanel = exorciseRollReview.getByTestId(
      "betrayal-recent-roll-panel",
    );
    await expect(rollPanel).toContainText("驱魔");
    await expect(rollPanel).toContainText("神志检定");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expect(rollPanel).toContainText("驱魔失败");
    await saveScreenshot(page, DICE_SCREENSHOT);

    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText(/驱魔失败|反扑/);
    const afterFailureCore = await readCoreState(page);
    expect(physicalTraitTotal(afterFailureCore, actorId)).toBe(
      actorPhysicalBefore - 1,
    );
    expect(physicalTraitTotal(afterFailureCore, teammateId)).toBe(
      teammatePhysicalBefore - 1,
    );
    expect(afterFailureCore.phase).toBe("haunt");
    expect(afterFailureCore.endgameResult).toBeNull();
    expect(
      afterFailureCore.scenarioRuntime.deadExplorerPlayerIds,
    ).not.toContain(actorId);
    expect(
      afterFailureCore.scenarioRuntime.deadExplorerPlayerIds,
    ).not.toContain(teammateId);
    await saveScreenshot(page, RESULT_SCREENSHOT);

    await expect(
      page.getByTestId("betrayal-exorcise-roll-continue"),
    ).toContainText("返回牌桌");
    await saveScreenshot(page, CLOSE_READY_SCREENSHOT);
    const exorciseRollBackdrop = page.getByTestId(
      "betrayal-roll-review-backdrop",
    );
    await expect(exorciseRollBackdrop).toHaveAttribute(
      "data-backdrop-dismiss",
      "enabled",
    );
    await exorciseRollBackdrop.click({ position: { x: 16, y: 16 } });

    await expect(page.getByTestId("betrayal-exorcise-roll-review")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-basement-landing"),
    ).toBeVisible();
    await saveScreenshot(page, DISMISSED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-exorcism-failure-full-chain", diagnostics },
    ]);
  });
});
