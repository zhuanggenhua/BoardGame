import { expect, test } from "@playwright/test";
import type { BetrayalCore } from "../../src/games/betrayal/game";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
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

test.describe("山屋惊魂女孩单位重构", () => {
  test("女孩作为单位显示，并在拾取后附着到探索者和木乃伊", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context);
    const diagnostics = attachPageDiagnostics(page, "betrayal-mummy-girl-unit");

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto(
      "/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=2&seed=mummy-girl-unit",
      { waitUntil: "domcontentloaded" },
    );
    await waitForBetrayalPageReady(page);

    const { core, roomId } = createMummyGirlUnitReadyRuntimeCore();
    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    const observedExplorerPanel = page.getByTestId(
      "betrayal-observed-explorer-panel",
    );
    await expect(observedExplorerPanel).toBeVisible();
    await expect(observedExplorerPanel).toHaveAttribute("data-player-id", "2");
    await expect(observedExplorerPanel).not.toHaveAttribute(
      "data-token-asset",
      /.*/,
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
    await expect(girlToken).toHaveAccessibleName("女孩，可拾取");
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

    await girlToken.click();
    const pickupTransitionBlocker = page.getByTestId("betrayal-visual-transition-blocker");
    await expect(pickupTransitionBlocker).toBeVisible();
    await expect(page.getByTestId("betrayal-board")).toHaveAttribute(
      "data-betrayal-visual-busy",
      "true",
    );
    await expect(girlToken).toHaveAttribute("data-token-status", "placed");
    await saveScreenshot(page, PICKUP_ANIMATION_SCREENSHOT);
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

    await page.getByTestId("betrayal-action-use").click();
    const giveTransitionBlocker = page.getByTestId("betrayal-visual-transition-blocker");
    await expect(giveTransitionBlocker).toBeVisible();
    await expect(page.getByTestId("betrayal-board")).toHaveAttribute(
      "data-betrayal-visual-busy",
      "true",
    );
    await expect(girlToken).toHaveAttribute("data-token-status", "held-by-player");
    await saveScreenshot(page, GIVE_ANIMATION_SCREENSHOT);
    await expect(giveTransitionBlocker).toHaveCount(0);
    await expect(girlToken).toHaveAttribute("data-token-status", "held-by-mummy");
    await expect(girlToken).toHaveAttribute("data-token-placement", "mummy");
    await expect(girlToken).toHaveAttribute("data-token-owner-monster-id", "mummy");
    await expect(girlSvg).toHaveAttribute("data-token-attachment", "mummy");
    await expect(page.getByTestId("betrayal-action-use")).toHaveText("使用");
    await expect(page.getByTestId("betrayal-action-use")).toBeDisabled();
    await saveScreenshot(page, MUMMY_STATE_SCREENSHOT);

    assertNoFatalFrontendErrors([{ label: "betrayal-mummy-girl-unit", diagnostics }]);
  });
});
