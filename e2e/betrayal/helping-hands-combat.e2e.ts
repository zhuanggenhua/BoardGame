import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import type { BetrayalCore } from "../../src/games/betrayal/game";
import {
  createHelpingHandsNoAmuletRuntimeCore,
  createHelpingHandsPendingRewardRuntimeCore,
  createHelpingHandsTransferredAmuletControllerRuntimeCore,
  createHelpingHandsTransferredAmuletOldHolderRuntimeCore,
  createHelpingHandsTrollHandAttackRuntimeCore,
  expectPhysicalDiceSeparated,
  expectVisiblePhysicalDiceBox,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  waitForPhysicalDiceSettled,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-helping-hands-combat";
const ROLL_REVIEW_SCREENSHOT = `${EVIDENCE_DIR}/01-大宅饿了-力量攻击投骰回顾-可改骰时空白不可关闭.jpg`;
const REWARD_CHOICE_SCREENSHOT = `${EVIDENCE_DIR}/02-大宅饿了-伤害或偷牌选择.jpg`;
const STEAL_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/03-大宅饿了-偷牌后回牌桌.jpg`;
const TROLL_COMBINED_READY_SCREENSHOT = `${EVIDENCE_DIR}/04-大宅饿了-巨魔手合击入口.jpg`;
const TROLL_COMBINED_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/05-大宅饿了-巨魔手合击后反馈.jpg`;
const AMULET_OLD_HOLDER_SCREENSHOT = `${EVIDENCE_DIR}/06-大宅饿了-护符换手后旧持有人无巨魔手入口.jpg`;
const AMULET_NEW_HOLDER_SCREENSHOT = `${EVIDENCE_DIR}/07-大宅饿了-护符新持有人获得巨魔手入口.jpg`;
const NO_AMULET_SKIP_SCREENSHOT = `${EVIDENCE_DIR}/08-大宅饿了-无人持护符巨魔手跳过.jpg`;
const HELPING_HANDS_TEST_URL =
  "/play/betrayal?players=3&playerID=0&seat0=human&seat1=human&seat2=human";
const HELPING_HANDS_CONTROLLER_TEST_URL =
  "/play/betrayal?players=3&playerID=1&seat0=human&seat1=human&seat2=human";

const expectReadableTopPrompt = async (prompt: Locator, minHeight: number) => {
  const box = await prompt.boundingBox();
  expect(box, "顶部提示横幅必须真实可见").not.toBeNull();
  expect(box!.y, "提示横幅必须在牌桌上方区域").toBeLessThan(170);
  expect(box!.height, "提示横幅不能再退回小条").toBeGreaterThanOrEqual(
    minHeight,
  );
};

const expectReadableBottomAction = async (action: Locator) => {
  const box = await action.boundingBox();
  expect(box, "底部交互按钮必须真实可见").not.toBeNull();
  expect(box!.height, "底部交互按钮必须保留可点尺寸").toBeGreaterThanOrEqual(
    44,
  );
};

type HelpingHandsState = {
  currentPlayer: string;
  currentExplorerPlayerId: string;
  player0InventoryIds: string[];
  player1InventoryIds: string[];
  pendingReward: boolean;
  recentRollKind: string | null;
  controllerPlayerId: string | null;
  monsterTurnActive: boolean;
  monsterTurnReason: string | null;
  trollHandIds: string[];
  usedTrollHandIds: string[];
};

const readHelpingHandsState = async (
  page: Page,
): Promise<HelpingHandsState> =>
  page.evaluate(() => {
    const core = (
      window as Window & {
        __BG_TEST_HARNESS__?: {
          state?: { get?: () => { core?: BetrayalCore } };
        };
      }
    ).__BG_TEST_HARNESS__?.state?.get?.().core;
    if (!core) {
      throw new Error("missing betrayal test harness core");
    }
    const explorers = [core.currentExplorer, ...core.otherExplorers];
    const findExplorer = (playerId: string) =>
      explorers.find((explorer) => explorer.playerId === playerId);
    const controller =
      explorers.find((explorer) =>
        explorer.inventory.some((card) => card.id === "strange-amulet"),
      )?.playerId ?? null;
    const monsterTurnActive = Boolean(
      core.scenarioRuntime.helpingHands?.activeMonsterTurn,
    );
    return {
      currentPlayer: core.currentPlayer,
      currentExplorerPlayerId: core.currentExplorer.playerId,
      player0InventoryIds:
        findExplorer("0")?.inventory.map((card) => card.id) ?? [],
      player1InventoryIds:
        findExplorer("1")?.inventory.map((card) => card.id) ?? [],
      pendingReward: Boolean(
        core.scenarioRuntime.helpingHands?.pendingAttackReward,
      ),
      recentRollKind: core.recentRoll?.kind ?? null,
      controllerPlayerId: controller,
      monsterTurnActive,
      monsterTurnReason:
        !monsterTurnActive && !controller
          ? "无人持有奇异护符，巨魔手怪物回合跳过。"
          : null,
      trollHandIds: [
        ...(core.scenarioRuntime.helpingHands?.trollHandIds ?? []),
      ],
      usedTrollHandIds: [
        ...(core.scenarioRuntime.helpingHands
          ?.trollHandAttackUsedIdsThisTurn ?? []),
      ],
    };
  });

const dismissHelpingHandsMonsterMoveRoll = async (page: Page) => {
  const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
  await expect(rollPanel).toContainText("巨魔手移动");
  await page.getByTestId("betrayal-roll-continue").click();
  await expect(rollPanel).toHaveCount(0);
};

test.describe("山屋惊魂作祟 12 大宅饿了 / 援手战斗链", () => {
  test("力量攻击奖励必须选择伤害或偷牌，巨魔手同房必须走力量8合击", async ({
    page,
    context,
  }) => {
    test.setTimeout(150000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-helping-hands-combat",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(HELPING_HANDS_TEST_URL, { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createHelpingHandsPendingRewardRuntimeCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect.poll(() => readHelpingHandsState(page)).toEqual(
      expect.objectContaining({
        currentPlayer: "0",
        currentExplorerPlayerId: "0",
        pendingReward: true,
        recentRollKind: "attackRoll",
      }),
    );
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("攻击投骰");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 5 });
    const rollBackdrop = page.getByTestId("betrayal-roll-review-backdrop");
    await expect(rollBackdrop).toHaveAttribute(
      "data-backdrop-dismiss",
      "disabled",
    );
    const disabledBackdropBlankPoint = await rollBackdrop.evaluate(
      (backdrop) => {
        const rect = backdrop.getBoundingClientRect();
        return { x: rect.left + 16, y: rect.top + 16 };
      },
    );
    await page.mouse.click(
      disabledBackdropBlankPoint.x,
      disabledBackdropBlankPoint.y,
    );
    await expect(
      rollPanel,
      "可改骰时点击空白不能关闭攻击投骰回顾",
    ).toBeVisible();
    const continueButton = page.getByTestId("betrayal-roll-continue");
    await expect(continueButton).toBeVisible();
    await saveScreenshot(page, ROLL_REVIEW_SCREENSHOT);

    await continueButton.click();
    const rewardBanner = page.getByTestId(
      "betrayal-helping-hands-reward-banner",
    );
    await expect(rewardBanner).toBeVisible();
    await expect(rewardBanner).toHaveAttribute("data-prompt-placement", "top");
    await expectReadableTopPrompt(rewardBanner, 72);
    await expect(rewardBanner).toHaveAttribute(
      "data-helping-hands-reward-state",
      "choose",
    );
    const damageButton = page.getByTestId("betrayal-helping-hands-reward-damage");
    await expect(damageButton).toBeVisible();
    await expectReadableBottomAction(damageButton);
    const stealMedicalKitButton = page.getByTestId(
      "betrayal-helping-hands-reward-steal-medical-kit",
    );
    await expect(stealMedicalKitButton).toContainText("偷走急救包");
    await expectReadableBottomAction(stealMedicalKitButton);
    await saveScreenshot(page, REWARD_CHOICE_SCREENSHOT);

    await stealMedicalKitButton.click();
    await expect(rewardBanner).toHaveCount(0);
    await expect(page.getByTestId("betrayal-inventory-medical-kit")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-latest-feedback")).toContainText(
      "偷走急救包",
    );
    const stealState = await readHelpingHandsState(page);
    expect(stealState.pendingReward).toBe(false);
    expect(stealState.player0InventoryIds).toContain("medical-kit");
    expect(stealState.player1InventoryIds).not.toContain("medical-kit");
    await saveScreenshot(page, STEAL_SETTLED_SCREENSHOT);

    await injectCore(page, createHelpingHandsTrollHandAttackRuntimeCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await dismissHelpingHandsMonsterMoveRoll(page);
    const trollStatusBanner = page.getByTestId(
      "betrayal-helping-hands-monster-turn-status",
    );
    await expect(trollStatusBanner).toHaveAttribute(
      "data-prompt-placement",
      "top",
    );
    await expectReadableTopPrompt(trollStatusBanner, 60);
    const trollBanner = page.getByTestId(
      "betrayal-helping-hands-troll-attack-banner",
    );
    await expect(trollBanner).toBeVisible();
    await expect(trollBanner).toHaveAttribute("data-prompt-placement", "top");
    await expectReadableTopPrompt(trollBanner, 70);
    await expect(
      page.getByTestId("betrayal-helping-hands-troll-target"),
    ).toContainText("目标：");
    const combinedAttackButton = page.getByTestId(
      "betrayal-helping-hands-troll-combined",
    );
    await expect(combinedAttackButton).toContainText("合击 力量8");
    await expectReadableBottomAction(combinedAttackButton);
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      "巨魔手合击",
    );
    const trollReadyState = await readHelpingHandsState(page);
    expect(trollReadyState.trollHandIds).toHaveLength(2);
    expect(trollReadyState.usedTrollHandIds).toEqual([]);
    await saveScreenshot(page, TROLL_COMBINED_READY_SCREENSHOT);

    await setHarnessRandomQueue(page, [
      0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99,
      0,
      0,
    ]);
    await combinedAttackButton.click();
    await expect(combinedAttackButton).toHaveCount(0);
    await expect(page.getByTestId("betrayal-room-latest-feedback")).toContainText(
      "巨魔手合击",
    );
    await expect.poll(async () => {
      const state = await readHelpingHandsState(page);
      return [...state.usedTrollHandIds].sort();
    }).toEqual([...trollReadyState.trollHandIds].sort());
    await saveScreenshot(page, TROLL_COMBINED_SETTLED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-helping-hands-combat", diagnostics },
    ]);
  });

  test("奇异护符换手会改变巨魔手控制入口，无人持有时跳过怪物回合", async ({
    page,
    context,
  }) => {
    test.setTimeout(150000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-helping-hands-control",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(HELPING_HANDS_TEST_URL, { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(
      page,
      createHelpingHandsTransferredAmuletOldHolderRuntimeCore(),
    );
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect.poll(() => readHelpingHandsState(page)).toEqual(
      expect.objectContaining({
        currentExplorerPlayerId: "1",
        controllerPlayerId: "1",
        monsterTurnActive: true,
      }),
    );
    await dismissHelpingHandsMonsterMoveRoll(page);
    await expect(
      page.getByTestId("betrayal-helping-hands-monster-turn-status"),
    ).toHaveAttribute("data-helping-hands-monster-state", "controlled");
    await expect(
      page.getByTestId("betrayal-helping-hands-monster-turn-status"),
    ).toContainText("控制");
    await expect(
      page.getByTestId("betrayal-helping-hands-troll-attack-banner"),
      "旧持有人已没有巨魔手行动入口",
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-action-use")).not.toContainText(
      "巨魔手",
    );
    await saveScreenshot(page, AMULET_OLD_HOLDER_SCREENSHOT);

    await page.goto(HELPING_HANDS_CONTROLLER_TEST_URL, {
      waitUntil: "domcontentloaded",
    });
    await waitForBetrayalPageReady(page);
    await injectCore(
      page,
      createHelpingHandsTransferredAmuletControllerRuntimeCore(),
    );
    await expect.poll(() => readHelpingHandsState(page)).toEqual(
      expect.objectContaining({
        currentExplorerPlayerId: "1",
        controllerPlayerId: "1",
        monsterTurnActive: true,
      }),
    );
    await dismissHelpingHandsMonsterMoveRoll(page);
    await expect(
      page.getByTestId("betrayal-helping-hands-monster-turn-status"),
    ).toHaveAttribute("data-helping-hands-monster-state", "controlled");
    await expect(
      page.getByTestId("betrayal-helping-hands-troll-attack-banner"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      "巨魔手",
    );
    await saveScreenshot(page, AMULET_NEW_HOLDER_SCREENSHOT);

    await injectCore(page, createHelpingHandsNoAmuletRuntimeCore());
    await expect.poll(() => readHelpingHandsState(page)).toEqual(
      expect.objectContaining({
        currentExplorerPlayerId: "0",
        controllerPlayerId: null,
        monsterTurnActive: false,
        monsterTurnReason: "无人持有奇异护符，巨魔手怪物回合跳过。",
      }),
    );
    const skippedStatus = page.getByTestId(
      "betrayal-helping-hands-monster-turn-status",
    );
    await expect(skippedStatus).toHaveAttribute(
      "data-helping-hands-monster-state",
      "skipped-no-amulet",
    );
    await expect(skippedStatus).toContainText("无人持有奇异护符");
    await expect(skippedStatus).toContainText("巨魔手跳过");
    await expect(
      page.getByTestId("betrayal-helping-hands-troll-attack-banner"),
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-action-use")).not.toContainText(
      "巨魔手",
    );
    await saveScreenshot(page, NO_AMULET_SKIP_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-helping-hands-control", diagnostics },
    ]);
  });
});
