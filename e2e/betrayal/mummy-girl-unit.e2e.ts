import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { BetrayalCore } from "../../src/games/betrayal/game";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  clickBetrayalSceneGirl,
  createFirstScenarioHauntRuntimeCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/betrayal-mummy-girl-unit";
const ROOM_STATE_SCREENSHOT = `${EVIDENCE_DIR}/01-山屋惊魂-女孩单位-房间中可拾取.jpg`;
const PICKUP_ANIMATION_SCREENSHOT = `${EVIDENCE_DIR}/02-山屋惊魂-女孩单位-拾取动画中.jpg`;
const EXPLORER_STATE_SCREENSHOT = `${EVIDENCE_DIR}/03-山屋惊魂-女孩单位-探索者持有.jpg`;
const GIVE_ANIMATION_SCREENSHOT = `${EVIDENCE_DIR}/04-山屋惊魂-女孩单位-交出动画中.jpg`;
const MUMMY_STATE_SCREENSHOT = `${EVIDENCE_DIR}/05-山屋惊魂-女孩单位-木乃伊持有.jpg`;

async function expectNativeGirlTransfer(token: Locator, origin: string, picture: string) {
  const page = token.page();
  const id = (await token.getAttribute("data-testid"))!;
  await page.waitForFunction(({ id, origin }) => {
    const blocker = document.querySelector('[data-testid="betrayal-visual-transition-blocker"][data-transition-renderer="three"]');
    const graphic = document.querySelector(`[data-testid="${id}"]`);
    const bounds = graphic?.getAttribute("data-tutorial-screen-bounds");
    return blocker && bounds && bounds !== origin &&
      !blocker.querySelector('[data-testid^="betrayal-visual-transition-transition-"]');
  }, { id, origin }, { timeout: 10000 });
  await saveScreenshot(page, picture);
}

function createMummyGirlUnitReadyRuntimeCore(): {
  core: BetrayalCore;
  roomId: string;
} {
  const core = createFirstScenarioHauntRuntimeCore();
  const mummyRuntime = core.scenarioRuntime.mummy;
  if (!mummyRuntime) {
    throw new Error("女孩单位 E2E 夹具缺少木乃伊运行态");
  }

  const roomId = mummyRuntime.sarcophagusRoomId;
  const activeExplorer = [core.currentExplorer, ...core.otherExplorers].find(
    (explorer) => explorer.playerId === "2",
  );
  if (!activeExplorer) {
    throw new Error("女孩单位 E2E 夹具缺少玩家 2");
  }

  core.currentPlayer = "2";
  core.currentExplorer = { ...activeExplorer, roomId };
  core.otherExplorers = [core.currentExplorer, ...core.otherExplorers]
    .filter((explorer) => explorer.playerId !== "2")
    .map((explorer) => ({ ...explorer }));
  core.activeRoomId = roomId;
  core.currentExplorerRoomId = roomId;
  core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({
    ...card,
  }));
  core.turnStartInventoryCardIds = core.currentExplorer.inventory.map(
    (card) => card.id,
  );
  core.usedCardIdsThisTurn = [];
  core.recommendedAction = "use";
  core.latestDiscovery = null;
  core.latestDiscoveryOwnerPlayerId = null;
  core.pendingCardResolutionQueue = [];
  core.pendingEventChoice = null;
  core.pendingDamageAllocation = null;
  core.recentRoll = null;

  core.scenarioRuntime.mummy = {
    ...mummyRuntime,
    sarcophagusRoomId: roomId,
    girlRoomId: roomId,
    girlHolderPlayerId: null,
    girlHeldByMummy: false,
    mummyCarriedOmenIds: [],
    mummyCarriedCards: [],
  };
  core.monsters = core.monsters.map((monster) =>
    monster.id === mummyRuntime.mummyMonsterId || monster.definitionId === "mummy"
      ? { ...monster, roomId }
      : monster,
  );

  const completedMonsterIds = core.monsters.map((monster) => monster.id);
  core.scenarioRuntime.monsterTurn = {
    ...core.scenarioRuntime.monsterTurn,
    resolvedStartMonsterIds: completedMonsterIds,
    skippedMonsterIdsThisTurn: completedMonsterIds,
    attackedMonsterIdsThisTurn: completedMonsterIds,
    movedMonsterIdsThisTurn: completedMonsterIds,
    movementRollsByGroupId: {},
    moveRemainingById: Object.fromEntries(
      completedMonsterIds.map((monsterId) => [monsterId, 0]),
    ),
  };

  return { core, roomId };
}

async function openMummyGirlFixture(page: Page, context: BrowserContext) {
  await initBetrayalContext(context);
  await page.setViewportSize({ width: 1600, height: 900 });
  await warmBetrayalFrontend(context);
  await page.goto("/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=2&seed=mummy-girl-unit", {
    waitUntil: "domcontentloaded",
  });
  await waitForBetrayalPageReady(page);
  const { core, roomId } = createMummyGirlUnitReadyRuntimeCore();
  await injectCore(page, core);
  await expect(page.getByTestId("betrayal-board")).toBeVisible({ timeout: 30000 });
  return roomId;
}

test.describe("山屋惊魂女孩单位重构", () => {
  test("女孩作为单位显示，并在拾取后附着到探索者和木乃伊", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(page, "betrayal-mummy-girl-unit");
    const roomId = await openMummyGirlFixture(page, context);
    const observedExplorerPanel = page.getByTestId(
      "betrayal-observed-explorer-panel",
    );
    await expect(observedExplorerPanel).toBeVisible();
    await expect(observedExplorerPanel).toHaveAttribute("data-player-id", "2");
    await expect(observedExplorerPanel).toHaveAttribute(
      "data-token-asset",
      "betrayal/tokens/explorers/father-warren-leung",
    );
    await expect(page.getByTestId("betrayal-room-floor-down")).toBeEnabled();
    await page.getByTestId("betrayal-room-floor-down").click();
    await expect(page.getByTestId("betrayal-room-floor-basement")).toBeVisible();

    const explorerRoomOccupant = page.getByTestId(
      `betrayal-room-occupant-${roomId}-2`,
    );
    await expect(explorerRoomOccupant).toBeVisible();
    await expect(
      explorerRoomOccupant.getByTestId("betrayal-explorer-figure-token-2"),
    ).toHaveAttribute("data-token-state", "official");
    await expect(
      explorerRoomOccupant.getByTestId("betrayal-explorer-figure-token-missing-2"),
    ).toHaveCount(0);

    const girlToken = page.getByTestId(
      `betrayal-room-haunt-token-${roomId}-mummy-girl-token`,
    );
    const girlSvg = page.getByTestId(`betrayal-girl-svg-token-${roomId}`);
    const roomMarkerLayer = page.getByTestId(
      `betrayal-room-haunt-token-layer-${roomId}`,
    );

    await expect(girlToken).toBeVisible();
    await expect(girlToken).toHaveAttribute("data-token-status", "placed");
    await expect(girlToken).toHaveAttribute("data-token-placement", "room");
    await expect(girlToken).toHaveAttribute("data-direct-target", "true");
    await expect(girlToken).toHaveAccessibleName("女孩预兆标记，可拾取");
    await expect(girlSvg).toHaveAttribute("data-token-attachment", "room");
    await expect(
      roomMarkerLayer.getByTestId(
        `betrayal-room-haunt-token-${roomId}-mummy-girl-token`,
      ),
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-action-use")).toHaveText(
      "拾起女孩",
    );
    await expect(page.getByTestId("betrayal-room-focus-target")).toHaveCount(0);
    await saveScreenshot(page, ROOM_STATE_SCREENSHOT);

    await expect(girlSvg).toHaveAttribute("data-three-marker-ready", "");
    const groundBounds = (await girlSvg.getAttribute("data-tutorial-screen-bounds"))!;
    await clickBetrayalSceneGirl(girlToken);
    const pickupTransitionBlocker = page.getByTestId("betrayal-visual-transition-blocker");
    await expectNativeGirlTransfer(girlSvg, groundBounds, PICKUP_ANIMATION_SCREENSHOT);
    await expect(pickupTransitionBlocker).toHaveCount(0);
    await expect(girlToken).toHaveAttribute("data-token-status", "held-by-player");
    await expect(girlToken).toHaveAttribute("data-token-placement", "explorer");
    await expect(girlToken).toHaveAttribute("data-token-owner-player-id", "2");
    await expect(girlSvg).toHaveAttribute("data-token-attachment", "explorer");
    await expect(page.getByTestId("betrayal-action-use")).toHaveText(
      "交出女孩",
    );
    await expect(page.getByTestId("betrayal-room-focus-target")).toHaveCount(0);
    await saveScreenshot(page, EXPLORER_STATE_SCREENSHOT);

    await expect(girlSvg).toHaveAttribute("data-three-marker-ready", "");
    const explorerBounds = (await girlSvg.getAttribute("data-tutorial-screen-bounds"))!;
    await page.getByTestId("betrayal-action-use").click();
    const giveTransitionBlocker = page.getByTestId("betrayal-visual-transition-blocker");
    await expectNativeGirlTransfer(girlSvg, explorerBounds, GIVE_ANIMATION_SCREENSHOT);
    await expect(giveTransitionBlocker).toHaveCount(0);
    await expect(girlToken).toHaveAttribute("data-token-status", "held-by-mummy");
    await expect(girlToken).toHaveAttribute("data-token-placement", "mummy");
    await expect(girlToken).toHaveAttribute("data-token-owner-monster-id", "mummy");
    await expect(girlSvg).toHaveAttribute("data-token-attachment", "mummy");
    await expect(page.getByTestId("betrayal-action-use")).toHaveCount(0);
    await saveScreenshot(page, MUMMY_STATE_SCREENSHOT);

    assertNoFatalFrontendErrors([{ label: "betrayal-mummy-girl-unit", diagnostics }]);
  });

  test("三维筹码交接途中失去画布时，棋桌降级并完成原动作", async ({ page, context }) => {
    test.setTimeout(120000);
    const roomId = await openMummyGirlFixture(page, context);
    await page.getByTestId("betrayal-room-floor-down").click();
    await expect(page.getByTestId("betrayal-room-floor-basement")).toBeVisible();
    const grid = page.getByTestId("betrayal-room-grid");
    const canvas = page.getByTestId("betrayal-three-map-canvas");
    const blocker = page.getByTestId("betrayal-visual-transition-blocker");
    const girl = page.getByTestId(`betrayal-room-haunt-token-${roomId}-mummy-girl-token`);
    const graphic = girl.locator("[data-scene-marker-visual]");
    await expect(grid).toHaveAttribute("data-map-renderer", "three");
    await expect(graphic).toHaveAttribute("data-tutorial-screen-bounds", /\S/);
    const [left, top, right, bottom] = (await graphic.getAttribute("data-tutorial-screen-bounds"))!.split(",").map(Number);
    await canvas.evaluate((element: HTMLCanvasElement) => {
      const extension = element.getContext("webgl2")?.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("浏览器没有提供 WEBGL_lose_context");
      const host = element.closest<HTMLElement>('[data-testid="betrayal-room-grid"]');
      if (!host) throw new Error("缺少棋桌的场景命中记录");
      const observer = new MutationObserver(() => {
        const transfer = document.querySelector('[data-transition-kind="girl-transfer"][data-transition-renderer="three"]');
        if (!transfer) return;
        observer.disconnect();
        document.documentElement.dataset.betrayalTestContextLoss = host.dataset.lastScenePick;
        extension.loseContext();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    await page.mouse.click((left + right) / 2, (top + bottom) / 2);
    await expect(page.locator("html")).toHaveAttribute("data-betrayal-test-context-loss", "marker:mummy-girl");
    await expect(grid.getByTestId("betrayal-pixi-map-canvas")).toBeVisible();
    await expect(canvas).toHaveCount(0);
    await expect(blocker).toHaveCount(0);
    await expect(girl).toHaveAttribute("data-token-status", "held-by-player");
    await expect(page.getByTestId("betrayal-action-use")).toHaveText("交出女孩");
  });
});
