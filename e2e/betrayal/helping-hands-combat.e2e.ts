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
const TROLL_COMBINED_DAMAGE_ALLOCATION_SCREENSHOT = `${EVIDENCE_DIR}/05-大宅饿了-巨魔手合击后伤害分配.jpg`;
const TROLL_MOVE_TARGETS_SCREENSHOT = `${EVIDENCE_DIR}/06-大宅饿了-巨魔手移动目标高亮.jpg`;
const TROLL_MOVE_SETTLED_SCREENSHOT = `${EVIDENCE_DIR}/07-大宅饿了-巨魔手移动后回牌桌.jpg`;
const TROLL_MONSTER_TURN_ENDED_SCREENSHOT = `${EVIDENCE_DIR}/08-大宅饿了-结束巨魔手回合后下一位.jpg`;
const AMULET_OLD_HOLDER_SCREENSHOT = `${EVIDENCE_DIR}/09-大宅饿了-护符换手后旧持有人无巨魔手入口.jpg`;
const AMULET_NEW_HOLDER_SCREENSHOT = `${EVIDENCE_DIR}/10-大宅饿了-护符新持有人获得巨魔手入口.jpg`;
const NO_AMULET_SKIP_SCREENSHOT = `${EVIDENCE_DIR}/11-大宅饿了-无人持护符巨魔手跳过.jpg`;
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
  pendingDamageAllocation: {
    playerId: string;
    sourceTitle: string;
    damageKind: string;
    amount: number;
    allowedTraits: string[];
    allowSkull: boolean;
  } | null;
  trollHandIds: string[];
  trollHandRooms: Record<string, string>;
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
    const pendingDamageAllocation = core.pendingDamageAllocation
      ? {
          playerId: core.pendingDamageAllocation.playerId,
          sourceTitle: core.pendingDamageAllocation.sourceTitle,
          damageKind: core.pendingDamageAllocation.damageKind,
          amount: core.pendingDamageAllocation.amount,
          allowedTraits: [...core.pendingDamageAllocation.allowedTraits],
          allowSkull: core.pendingDamageAllocation.allowSkull,
        }
      : null;
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
      pendingDamageAllocation,
      trollHandIds: [
        ...(core.scenarioRuntime.helpingHands?.trollHandIds ?? []),
      ],
      trollHandRooms: Object.fromEntries(
        (core.scenarioRuntime.helpingHands?.trollHandIds ?? [])
          .map((monsterId) => {
            const monster = core.monsters.find((item) => item.id === monsterId);
            return monster ? [monsterId, monster.roomId] : null;
          })
          .filter((entry): entry is [string, string] => Boolean(entry)),
      ),
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
    await expect(
      page.locator('[data-testid^="betrayal-helping-hands-troll-single-"]'),
    ).toHaveCount(2);
    for (const [index, trollHandId] of trollReadyState.trollHandIds.entries()) {
      const singleAttackButton = page.getByTestId(
        `betrayal-helping-hands-troll-single-${trollHandId}`,
      );
      await expect(singleAttackButton).toContainText(`第${index + 1}只`);
      await expect(singleAttackButton).toContainText("攻击 力量5");
      await expectReadableBottomAction(singleAttackButton);
    }
    await saveScreenshot(page, TROLL_COMBINED_READY_SCREENSHOT);

    await setHarnessRandomQueue(page, [
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
      0,
      0,
    ]);
    await combinedAttackButton.click();
    await expect(combinedAttackButton).toHaveCount(0);
    await expect(page.getByTestId("betrayal-room-latest-feedback")).toContainText(
      "巨魔手合击",
    );
    const damageAllocationPanel = page.getByTestId(
      "betrayal-damage-allocation-panel",
    );
    await expect(damageAllocationPanel).toBeVisible();
    await expect(damageAllocationPanel).toHaveAttribute("data-player-id", "1");
    await expect(
      page.getByTestId("betrayal-damage-allocation-source"),
    ).toContainText("巨魔手攻击");
    await expect(
      page.getByTestId("betrayal-damage-allocation-amount"),
    ).toContainText("8 点物理伤害");
    await expect(
      page.getByTestId("betrayal-damage-allocation-traits"),
    ).toContainText("力量");
    await expect(
      page.getByTestId("betrayal-damage-allocation-traits"),
    ).toContainText("速度");
    const damageConfirmButton = page.getByTestId(
      "betrayal-damage-allocation-confirm",
    );
    await expect(damageConfirmButton).toBeDisabled();
    await expect(damageConfirmButton).toContainText("等待");
    await expect.poll(async () => {
      const state = await readHelpingHandsState(page);
      return state.pendingDamageAllocation;
    }).toEqual(
      expect.objectContaining({
        playerId: "1",
        sourceTitle: "巨魔手攻击",
        damageKind: "physical",
        amount: 8,
        allowedTraits: ["might", "speed"],
        allowSkull: true,
      }),
    );
    await expect.poll(async () => {
      const state = await readHelpingHandsState(page);
      return [...state.usedTrollHandIds].sort();
    }).toEqual([...trollReadyState.trollHandIds].sort());
    await saveScreenshot(page, TROLL_COMBINED_DAMAGE_ALLOCATION_SCREENSHOT);

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
    await expect(
      page.getByTestId("betrayal-action-use").filter({ hasText: "巨魔手" }),
    ).toHaveCount(0);
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
    await expect(
      page.getByTestId("betrayal-action-use").filter({ hasText: "巨魔手" }),
    ).toHaveCount(0);
    await saveScreenshot(page, NO_AMULET_SKIP_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-helping-hands-control", diagnostics },
    ]);
  });

  test("巨魔手移动必须由地图房间本体承接，并可明确结束怪物回合", async ({
    page,
    context,
  }) => {
    test.setTimeout(150000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-helping-hands-monster-turn",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(HELPING_HANDS_TEST_URL, { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);

    await injectCore(page, createHelpingHandsTrollHandAttackRuntimeCore());
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await dismissHelpingHandsMonsterMoveRoll(page);
    const initialState = await readHelpingHandsState(page);
    expect(initialState.monsterTurnActive).toBe(true);
    expect(initialState.controllerPlayerId).toBe("0");
    expect(initialState.trollHandIds).toHaveLength(2);
    const selectedTrollHandId = initialState.trollHandIds[0];
    const selectedTrollHandRoomId = initialState.trollHandRooms[selectedTrollHandId];
    expect(selectedTrollHandRoomId).toBeTruthy();

    const monsterStatus = page.getByTestId(
      "betrayal-helping-hands-monster-turn-status",
    );
    await expect(monsterStatus).toBeVisible();
    await expect(monsterStatus).toContainText("控制");
    await expect(page.getByTestId("betrayal-action-move")).toContainText(
      "移动巨魔手",
    );
    await expect(page.getByTestId("betrayal-action-endTurn")).toContainText(
      "结束巨魔手回合",
    );
    await expect(page.getByTestId("betrayal-action-explore")).toHaveCount(0);

    await page.getByTestId("betrayal-action-move").click();
    const selectedTrollHandToken = page.getByTestId(
      `betrayal-room-monster-${selectedTrollHandRoomId}-${selectedTrollHandId}`,
    );
    await expect(selectedTrollHandToken).toHaveAttribute(
      "data-direct-target",
      "true",
    );
    const moveTargets = page.locator(
      '[data-testid^="betrayal-room-helping-hands-troll-move-target-"]',
    );
    await expect(moveTargets.first()).toBeVisible();
    const targetTestId = await moveTargets.first().getAttribute("data-testid");
    expect(targetTestId).toBeTruthy();
    const targetRoomId = targetTestId!.replace(
      "betrayal-room-helping-hands-troll-move-target-",
      "",
    );
    const targetRoomButton = page.getByTestId(`betrayal-room-${targetRoomId}`);
    await expect(targetRoomButton).toHaveAttribute(
      "data-direct-action",
      "helping-hands-troll-move",
    );
    await saveScreenshot(page, TROLL_MOVE_TARGETS_SCREENSHOT);

    await targetRoomButton.click({ position: { x: 12, y: 12 } });
    await expect(page.getByTestId("betrayal-room-latest-feedback")).toContainText(
      "移动到",
    );
    await expect(
      page.getByTestId(`betrayal-room-monster-${targetRoomId}-${selectedTrollHandId}`),
    ).toBeVisible();
    const movedState = await readHelpingHandsState(page);
    expect(movedState.trollHandRooms[selectedTrollHandId]).toBe(targetRoomId);
    expect(movedState.monsterTurnActive).toBe(true);
    await saveScreenshot(page, TROLL_MOVE_SETTLED_SCREENSHOT);

    await page.getByTestId("betrayal-action-endTurn").click();
    await expect(
      page.getByTestId("betrayal-helping-hands-monster-turn-status"),
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-room-latest-feedback")).toContainText(
      "巨魔手怪物回合结束",
    );
    await expect.poll(() => readHelpingHandsState(page)).toEqual(
      expect.objectContaining({
        currentExplorerPlayerId: "1",
        monsterTurnActive: false,
      }),
    );
    await saveScreenshot(page, TROLL_MONSTER_TURN_ENDED_SCREENSHOT);

    assertNoFatalFrontendErrors([
      { label: "betrayal-helping-hands-monster-turn", diagnostics },
    ]);
  });
});
