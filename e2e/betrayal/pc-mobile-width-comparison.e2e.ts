import { expect, test, type Page } from "@playwright/test";
import {
  DESKTOP_REFERENCE_VIEWPORT,
  MOBILE_LANDSCAPE_E2E_VIEWPORT,
} from "../../src/shared/referenceViewports";
import {
  createFirstScenarioReadyToExorciseRuntimeCore,
  createFirstScenarioSurvivorEndgameCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";
import { createStartedFirstScenarioCore } from "../../src/games/betrayal/testing/firstScenarioTestUtils";

const ROUTE =
  "/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&playerID=0&bgForceCoarsePointer=1";
const PC_VIEWPORT = DESKTOP_REFERENCE_VIEWPORT;
const PHONE_VIEWPORT = MOBILE_LANDSCAPE_E2E_VIEWPORT;
const PHONE_SHELL_SCALE = Math.min(
  PHONE_VIEWPORT.width / PC_VIEWPORT.width,
  PHONE_VIEWPORT.height / PC_VIEWPORT.height,
);
const PHONE_HUD_MAX_SCALE = 0.6;
const PHONE_SHELL_WIDTH = PC_VIEWPORT.width * PHONE_SHELL_SCALE;
const PHONE_SHELL_OFFSET_X = (PHONE_VIEWPORT.width - PHONE_SHELL_WIDTH) / 2;
const EVIDENCE_DIR = "evidence/betrayal-width-comparison-20260920-board-shell";
const CHARACTER_PC_SCREENSHOT = `${EVIDENCE_DIR}/00-pc-1920x1080-角色选择.jpg`;
const CHARACTER_PHONE_SCREENSHOT = `${EVIDENCE_DIR}/00-phone-936x432-角色选择.jpg`;
const RUNTIME_PC_SCREENSHOT = `${EVIDENCE_DIR}/01-pc-1920x1080-主牌桌常态.jpg`;
const RUNTIME_PHONE_SCREENSHOT = `${EVIDENCE_DIR}/02-phone-936x432-主牌桌常态.jpg`;
const PC_SCREENSHOT = `${EVIDENCE_DIR}/01-pc-1920x1080-移动选目标.png`;
const PHONE_SCREENSHOT = `${EVIDENCE_DIR}/02-phone-936x432-移动选目标.png`;
const PRESSURE_PC_SCREENSHOT = `${EVIDENCE_DIR}/03-pc-1920x1080-驱魔目标提示.jpg`;
const PRESSURE_PHONE_SCREENSHOT = `${EVIDENCE_DIR}/04-phone-936x432-驱魔目标提示.jpg`;
const ENDGAME_PC_SCREENSHOT = `${EVIDENCE_DIR}/05-pc-1920x1080-结算页.jpg`;
const ENDGAME_PHONE_SCREENSHOT = `${EVIDENCE_DIR}/06-phone-936x432-结算页.jpg`;

async function enterCharacterSelectState(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await waitForBetrayalPageReady(page);
  await expect(page.getByTestId("betrayal-character-select-screen")).toBeVisible({
    timeout: 30000,
  });
}

async function enterStartedBoardState(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await waitForBetrayalPageReady(page);
  await injectCore(page, createStartedFirstScenarioCore(["0", "1", "2"]));
  await expect(page.getByTestId("betrayal-board")).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByTestId("betrayal-room-grid")).toBeVisible();
  await expect(page.getByTestId("betrayal-action-explore")).toBeVisible();
}

async function enterInjectedState(
  page: Page,
  viewport: { width: number; height: number },
  core: Parameters<typeof injectCore>[1],
) {
  await page.setViewportSize(viewport);
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await waitForBetrayalPageReady(page);
  await injectCore(page, core);
}

async function enterMoveTargetState(
  page: Page,
  viewport: { width: number; height: number },
) {
  await enterStartedBoardState(page, viewport);
  await expect(
    page.getByTestId("betrayal-room-occupant-entrance-hall-0"),
  ).toBeVisible();
  await page.getByTestId("betrayal-action-move").click();
  await expect(page.getByTestId("betrayal-action-move")).toContainText(
    "取消移动",
  );
  await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
  await expect(page.getByTestId("betrayal-room-hallway")).toBeEnabled();
}

async function readLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Number(box.left.toFixed(2)),
        top: Number(box.top.toFixed(2)),
        right: Number(box.right.toFixed(2)),
        bottom: Number(box.bottom.toFixed(2)),
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
      };
    };
    const root = document.documentElement;
    const shell = document.querySelector<HTMLElement>(".mobile-board-shell");
    const rectList = (selector: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).map(
        (element) => {
          const box = element.getBoundingClientRect();
          return {
            testId: element.dataset.testid ?? null,
            left: Number(box.left.toFixed(2)),
            top: Number(box.top.toFixed(2)),
            right: Number(box.right.toFixed(2)),
            bottom: Number(box.bottom.toFixed(2)),
            width: Number(box.width.toFixed(2)),
            height: Number(box.height.toFixed(2)),
            visible:
              box.width > 0 &&
              box.height > 0 &&
              box.right > 0 &&
              box.left < window.innerWidth &&
              box.bottom > 0 &&
              box.top < window.innerHeight,
          };
        },
      );
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: rect(".mobile-board-shell"),
      shellTransform: shell ? getComputedStyle(shell).transform : null,
      shellWidth: root.style.getPropertyValue(
        "--mobile-board-shell-design-width",
      ),
      shellScale: root.style.getPropertyValue("--mobile-board-shell-scale"),
      board: rect('[data-testid="betrayal-board"]'),
      layoutMode:
        document.querySelector<HTMLElement>(
          '[data-testid="betrayal-desktop-layout"]',
        )?.dataset.layoutMode ?? null,
      roomGrid: rect('[data-testid="betrayal-room-grid"]'),
      roomCanvas: rect('[data-testid="betrayal-room-canvas"]'),
      roomCanvasTransform: document.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-canvas"]',
      )
        ? getComputedStyle(
            document.querySelector<HTMLElement>(
              '[data-testid="betrayal-room-canvas"]',
            )!,
          ).transform
        : null,
      inventory: rect('[data-testid="betrayal-inventory-section"]'),
      rooms: rectList('[data-testid^="betrayal-room-shell-"]'),
      leftRail: rect('[data-testid="betrayal-left-status-rail"]'),
      statusRail: rect('[data-testid="betrayal-status-rail"]'),
      actionRail: rect('[data-testid="betrayal-action-rail"]'),
      phaseChip: rect('[data-testid="betrayal-phase-chip"]'),
      hudScale: (() => {
        const portal = document.querySelector<HTMLElement>(
          ".betrayal-hud-portal-region",
        );
        return portal
          ? Number.parseFloat(
              getComputedStyle(portal).getPropertyValue(
                "--betrayal-hud-scale",
              ),
            )
          : 1;
      })(),
      statusRailContentBottom: (() => {
        const element = document.querySelector<HTMLElement>(
          '[data-testid="betrayal-status-rail"]',
        );
        if (!element) return null;
        return Math.max(
          element.getBoundingClientRect().bottom,
          ...Array.from(element.children).map(
            (child) => (child as HTMLElement).getBoundingClientRect().bottom,
          ),
        );
      })(),
      leftRailContentBottom: (() => {
        const element = document.querySelector<HTMLElement>(
          '[data-testid="betrayal-left-status-rail"]',
        );
        if (!element) return null;
        return Math.max(
          element.getBoundingClientRect().bottom,
          ...Array.from(element.children).map(
            (child) => (child as HTMLElement).getBoundingClientRect().bottom,
          ),
        );
      })(),
      hudPlacement: {
        leftRailInShell: Boolean(
          document.querySelector<HTMLElement>(
            '[data-testid="betrayal-left-status-rail"]',
          )?.closest('.mobile-board-shell'),
        ),
        inventoryInShell: Boolean(
          document.querySelector<HTMLElement>(
            '[data-testid="betrayal-inventory-section"]',
          )?.closest('.mobile-board-shell'),
        ),
        statusRailInShell: Boolean(
          document.querySelector<HTMLElement>(
            '[data-testid="betrayal-status-rail"]',
          )?.closest('.mobile-board-shell'),
        ),
        actionRailInShell: Boolean(
          document.querySelector<HTMLElement>(
            '[data-testid="betrayal-action-rail"]',
          )?.closest('.mobile-board-shell'),
        ),
        phaseChipInShell: Boolean(
          document.querySelector<HTMLElement>(
            '[data-testid="betrayal-phase-chip"]',
          )?.closest('.mobile-board-shell'),
        ),
      },
      actions: rectList('[data-testid^="betrayal-action-"]'),
      fabs: Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="fab-menu"]'),
      ).map((element) => ({
        placement: element.dataset.hudPlacement ?? null,
        inShell: Boolean(element.closest('.mobile-board-shell')),
        position: element.dataset.fabPosition ?? null,
        rect: (() => {
          const box = element.getBoundingClientRect();
          return {
            left: Number(box.left.toFixed(2)),
            top: Number(box.top.toFixed(2)),
            right: Number(box.right.toFixed(2)),
            bottom: Number(box.bottom.toFixed(2)),
            width: Number(box.width.toFixed(2)),
            height: Number(box.height.toFixed(2)),
          };
        })(),
      })),
      fabInShell: Boolean(
        document.querySelector<HTMLElement>(
          '.mobile-board-shell [data-testid="fab-menu"]',
        ),
      ),
      fabPlacement:
        document.querySelector<HTMLElement>('[data-testid="fab-menu"]')?.dataset
          .hudPlacement ?? null,
      nativeMobileUi: {
        layout: document.querySelectorAll(
          '[data-testid="betrayal-mobile-landscape-layout"]',
        ).length,
        actionRail: document.querySelectorAll(
          '[data-testid="betrayal-mobile-action-rail"]',
        ).length,
        roles: document.querySelectorAll(
          '[data-mobile-role="native-action-rail"],' +
            '[data-mobile-role="primary-board-stage"],' +
            '[data-mobile-role="possession-rail"]',
        ).length,
      },
      overflow: {
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        root: document.querySelector<HTMLElement>("#root")?.scrollWidth ?? 0,
      },
    };
  });
}

async function readCharacterLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Number(box.left.toFixed(2)),
        top: Number(box.top.toFixed(2)),
        right: Number(box.right.toFixed(2)),
        bottom: Number(box.bottom.toFixed(2)),
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
      };
    };
    const shell = document.querySelector<HTMLElement>(".mobile-board-shell");
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid^="betrayal-character-card-"]',
      ),
    ).filter(
      (element) =>
        !element.dataset.testid?.endsWith("-state-outline") &&
        !element.dataset.testid?.endsWith("-ability-trigger"),
    );
    const root = document.documentElement;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: rect(".mobile-board-shell"),
      shellWidth: root.style.getPropertyValue(
        "--mobile-board-shell-design-width",
      ),
      shellScale: root.style.getPropertyValue("--mobile-board-shell-scale"),
      screen: rect('[data-testid="betrayal-character-select-screen"]'),
      grid: rect('[data-testid="betrayal-character-selection-grid"]'),
      detail: rect('[data-testid="betrayal-character-detail-scroll"]'),
      confirm: rect('[data-testid="betrayal-character-confirm"]'),
      cards: cards.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          testId: element.dataset.testid ?? null,
          left: Number(box.left.toFixed(2)),
          top: Number(box.top.toFixed(2)),
          width: Number(box.width.toFixed(2)),
          height: Number(box.height.toFixed(2)),
          visible:
            box.width > 0 &&
            box.height > 0 &&
            box.right > 0 &&
            box.left < window.innerWidth &&
            box.bottom > 0 &&
            box.top < window.innerHeight,
        };
      }),
      nativeMobileUi: {
        mobileGrid: document.querySelectorAll(
          '[data-testid="betrayal-character-mobile-grid"]',
        ).length,
        mobileLayout: document.querySelectorAll(
          '[data-testid="betrayal-mobile-landscape-layout"]',
        ).length,
      },
      overflow: {
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        root: document.querySelector<HTMLElement>("#root")?.scrollWidth ?? 0,
      },
    };
  });
}

async function readOverlayLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: Number(box.left.toFixed(2)),
        top: Number(box.top.toFixed(2)),
        right: Number(box.right.toFixed(2)),
        bottom: Number(box.bottom.toFixed(2)),
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
      };
    };
    const root = document.documentElement;
    return {
      shell: rect(".mobile-board-shell"),
      shellWidth: root.style.getPropertyValue(
        "--mobile-board-shell-design-width",
      ),
      shellScale: root.style.getPropertyValue("--mobile-board-shell-scale"),
      pressureTarget: rect('[data-testid="betrayal-room-focus-target"]'),
      discoveryPanel: rect('[data-testid="betrayal-discovery-panel"]'),
      endgame: rect('[data-testid="betrayal-endgame-screen"]'),
      overflow: {
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        root: document.querySelector<HTMLElement>("#root")?.scrollWidth ?? 0,
      },
    };
  });
}

test.describe("山屋惊魂 PC/手机同状态宽度对照", () => {
  test("角色选择沿用同一 PC 画布并按 contain 等比缩放", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    await warmBetrayalFrontend(context);

    await enterCharacterSelectState(page, PC_VIEWPORT);
    const pcMetrics = await readCharacterLayoutMetrics(page);
    await saveScreenshot(page, CHARACTER_PC_SCREENSHOT);

    const phonePage = await context.newPage();
    try {
      await enterCharacterSelectState(phonePage, PHONE_VIEWPORT);
      const phoneMetrics = await readCharacterLayoutMetrics(phonePage);
      expect(phoneMetrics.shellWidth).toBe("1920px");
      expect(phoneMetrics.shellScale).toBe("0.400000");
      expect(phoneMetrics.shell?.width ?? 0).toBeCloseTo(PHONE_SHELL_WIDTH, 0);
      expect(phoneMetrics.shell?.left ?? 0).toBeCloseTo(PHONE_SHELL_OFFSET_X, 0);
      expect(phoneMetrics.shell?.right ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.width - PHONE_SHELL_OFFSET_X,
        0,
      );
      expect(phoneMetrics.nativeMobileUi).toEqual({
        mobileGrid: 0,
        mobileLayout: 0,
      });
      expect(phoneMetrics.cards).toHaveLength(pcMetrics.cards.length);
      const pcVisibleCards = pcMetrics.cards.filter((card) => card.visible);
      const phoneVisibleCards = phoneMetrics.cards.filter((card) => card.visible);
      expect(phoneVisibleCards.length).toBe(pcVisibleCards.length);
      expect(phoneVisibleCards.length).toBeGreaterThan(0);
      expect(phoneVisibleCards[0]?.width ?? 0).toBeCloseTo(
        (pcVisibleCards[0]?.width ?? 0) * 0.4,
        0,
      );
      expect(phoneVisibleCards[0]?.height ?? 0).toBeCloseTo(
        (pcVisibleCards[0]?.height ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.grid?.width ?? 0).toBeCloseTo(
        (pcMetrics.grid?.width ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.grid?.height ?? 0).toBeCloseTo(
        (pcMetrics.grid?.height ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.detail?.width ?? 0).toBeCloseTo(
        (pcMetrics.detail?.width ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.confirm?.width ?? 0).toBeCloseTo(
        (pcMetrics.confirm?.width ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.overflow.document).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      expect(phoneMetrics.overflow.body).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      await saveScreenshot(phonePage, CHARACTER_PHONE_SCREENSHOT);
    } finally {
      await phonePage.close();
    }
  });

  test("主牌桌常态沿用同一 PC 画布并保持所有一级区域", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    await warmBetrayalFrontend(context);

    await enterStartedBoardState(page, PC_VIEWPORT);
    const pcMetrics = await readLayoutMetrics(page);
    await saveScreenshot(page, RUNTIME_PC_SCREENSHOT);

    const phonePage = await context.newPage();
    try {
      await enterStartedBoardState(phonePage, PHONE_VIEWPORT);
      const phoneMetrics = await readLayoutMetrics(phonePage);
      expect(phoneMetrics.shellWidth).toBe("1920px");
      expect(phoneMetrics.shellScale).toBe("0.400000");
      expect(phoneMetrics.shell?.width ?? 0).toBeCloseTo(PHONE_SHELL_WIDTH, 0);
      expect(phoneMetrics.shell?.left ?? 0).toBeCloseTo(PHONE_SHELL_OFFSET_X, 0);
      expect(phoneMetrics.shell?.right ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.width - PHONE_SHELL_OFFSET_X,
        0,
      );
      console.log(
        "PHONE_FABS",
        JSON.stringify({
          selected: {
            placement: phoneMetrics.fabPlacement,
            inShell: phoneMetrics.fabInShell,
          },
          all: phoneMetrics.fabs,
        }),
      );
      expect(phoneMetrics.fabInShell).toBe(false);
      expect(phoneMetrics.layoutMode).toBe("desktop-board");
      expect(phoneMetrics.fabs).toHaveLength(1);
      expect(phoneMetrics.fabs[0]?.placement).toBe("portal");
      expect(phoneMetrics.fabs[0]?.rect.width ?? 0).toBeCloseTo(44, 0);
      expect(phoneMetrics.fabs[0]?.rect.height ?? 0).toBeCloseTo(44, 0);
      expect(phoneMetrics.fabs[0]?.rect.left ?? -1).toBeGreaterThanOrEqual(0);
      expect(phoneMetrics.fabs[0]?.rect.right ?? 0).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width,
      );
      expect(phoneMetrics.nativeMobileUi).toEqual({
        layout: 0,
        actionRail: 0,
        roles: 0,
      });
      expect(phoneMetrics.leftRail?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.statusRail?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.actionRail?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.hudScale).toBeGreaterThan(0.5);
      expect(phoneMetrics.hudScale).toBeLessThanOrEqual(PHONE_HUD_MAX_SCALE);
      expect(phoneMetrics.rooms.length).toBe(pcMetrics.rooms.length);
      expect(phoneMetrics.rooms.every((room) => room.visible)).toBe(true);
      expect(phoneMetrics.hudPlacement).toEqual({
        leftRailInShell: false,
        inventoryInShell: false,
        statusRailInShell: false,
        actionRailInShell: false,
        phaseChipInShell: false,
      });
      expect(phoneMetrics.leftRail?.width ?? 0).toBeCloseTo(
        (pcMetrics.leftRail?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.statusRail?.width ?? 0).toBeCloseTo(
        (pcMetrics.statusRail?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.statusRail?.height ?? 0).toBeGreaterThan(300);
      expect(phoneMetrics.statusRail?.bottom ?? 0).toBeLessThanOrEqual(
        PHONE_VIEWPORT.height,
      );
      expect(phoneMetrics.statusRailContentBottom ?? 0).toBeLessThanOrEqual(
        PHONE_VIEWPORT.height,
      );
      expect(phoneMetrics.leftRailContentBottom ?? 0).toBeLessThanOrEqual(
        PHONE_VIEWPORT.height,
      );
      expect(phoneMetrics.actionRail?.height ?? 0).toBeCloseTo(
        (pcMetrics.actionRail?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.phaseChip?.width ?? 0).toBeCloseTo(
        (pcMetrics.phaseChip?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.inventory?.height ?? 0).toBeCloseTo(
        (pcMetrics.inventory?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.leftRail?.left ?? 0).toBeCloseTo(12, 0);
      expect(phoneMetrics.statusRail?.right ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.width - 12,
        0,
      );
      expect(phoneMetrics.actionRail?.width ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.width * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.roomCanvas?.width ?? 0).toBeCloseTo(
        (pcMetrics.roomCanvas?.width ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.roomCanvas?.height ?? 0).toBeCloseTo(
        (pcMetrics.roomCanvas?.height ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.overflow.document).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      expect(phoneMetrics.overflow.body).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      await saveScreenshot(phonePage, RUNTIME_PHONE_SCREENSHOT);
    } finally {
      await phonePage.close();
    }
  });

  test("驱魔目标提示沿用同一 PC 画布并保持壳内目标区域", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    await warmBetrayalFrontend(context);

    await enterInjectedState(
      page,
      PC_VIEWPORT,
      createFirstScenarioReadyToExorciseRuntimeCore(),
    );
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-action-use")).toContainText(
      /驱魔|驱散杰克之灵|驱逐木乃伊/,
    );
    await expect(page.getByTestId("betrayal-room-focus-target")).toBeVisible();
    const pcMetrics = await readOverlayLayoutMetrics(page);
    await saveScreenshot(page, PRESSURE_PC_SCREENSHOT);

    const phonePage = await context.newPage();
    try {
      await enterInjectedState(
        phonePage,
        PHONE_VIEWPORT,
        createFirstScenarioReadyToExorciseRuntimeCore(),
      );
      await expect(
        phonePage.getByTestId("betrayal-room-focus-target"),
      ).toBeVisible({ timeout: 30000 });
      const phoneMetrics = await readOverlayLayoutMetrics(phonePage);
      expect(phoneMetrics.shellWidth).toBe("1920px");
      expect(phoneMetrics.shellScale).toBe("0.400000");
      expect(phoneMetrics.shell?.width ?? 0).toBeCloseTo(PHONE_SHELL_WIDTH, 0);
      expect(phoneMetrics.shell?.left ?? 0).toBeCloseTo(PHONE_SHELL_OFFSET_X, 0);
      expect(phoneMetrics.shell?.right ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.width - PHONE_SHELL_OFFSET_X,
        0,
      );
      expect(phoneMetrics.pressureTarget?.width ?? 0).toBeCloseTo(
        (pcMetrics.pressureTarget?.width ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.pressureTarget?.height ?? 0).toBeCloseTo(
        (pcMetrics.pressureTarget?.height ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.overflow.document).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      expect(phoneMetrics.overflow.body).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      await saveScreenshot(phonePage, PRESSURE_PHONE_SCREENSHOT);
    } finally {
      await phonePage.close();
    }
  });

  test("结算页沿用同一 PC 画布并保持主区域完整可见", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    await warmBetrayalFrontend(context);

    await enterInjectedState(
      page,
      PC_VIEWPORT,
      createFirstScenarioSurvivorEndgameCore(),
    );
    await expect(page.getByTestId("betrayal-endgame-screen")).toBeVisible({
      timeout: 30000,
    }).catch(async () => {
      await expect(
        page.getByTestId("betrayal-exorcise-roll-continue"),
      ).toBeVisible({ timeout: 30000 });
      await page.getByTestId("betrayal-exorcise-roll-continue").click();
      await expect(page.getByTestId("betrayal-endgame-screen")).toBeVisible({
        timeout: 30000,
      });
    });
    await expect(page.getByTestId("betrayal-endgame-ending-stage")).toBeVisible();
    const pcMetrics = await readOverlayLayoutMetrics(page);
    await saveScreenshot(page, ENDGAME_PC_SCREENSHOT);

    const phonePage = await context.newPage();
    try {
      await enterInjectedState(
        phonePage,
        PHONE_VIEWPORT,
        createFirstScenarioSurvivorEndgameCore(),
      );
      await expect(
        phonePage.getByTestId("betrayal-endgame-screen"),
      ).toBeVisible({ timeout: 30000 }).catch(async () => {
        await expect(
          phonePage.getByTestId("betrayal-exorcise-roll-continue"),
        ).toBeVisible({ timeout: 30000 });
        await phonePage.getByTestId("betrayal-exorcise-roll-continue").click();
        await expect(
          phonePage.getByTestId("betrayal-endgame-screen"),
        ).toBeVisible({ timeout: 30000 });
      });
      await expect(
        phonePage.getByTestId("betrayal-endgame-ending-stage"),
      ).toBeVisible();
      const phoneMetrics = await readOverlayLayoutMetrics(phonePage);
      expect(phoneMetrics.shellWidth).toBe("1920px");
      expect(phoneMetrics.shellScale).toBe("0.400000");
      expect(phoneMetrics.shell?.width ?? 0).toBeCloseTo(PHONE_SHELL_WIDTH, 0);
      expect(phoneMetrics.shell?.left ?? 0).toBeCloseTo(PHONE_SHELL_OFFSET_X, 0);
      expect(phoneMetrics.shell?.right ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.width - PHONE_SHELL_OFFSET_X,
        0,
      );
      expect(phoneMetrics.endgame?.width ?? 0).toBeCloseTo(PHONE_SHELL_WIDTH, 0);
      expect(phoneMetrics.endgame?.height ?? 0).toBeCloseTo(
        (pcMetrics.endgame?.height ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.overflow.document).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      expect(phoneMetrics.overflow.body).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      await saveScreenshot(phonePage, ENDGAME_PHONE_SCREENSHOT);
    } finally {
      await phonePage.close();
    }
  });

  test("同一移动选目标状态生成 PC 与真实手机 CSS 视口截图", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    await warmBetrayalFrontend(context);

    await enterMoveTargetState(page, PC_VIEWPORT);
    const pcMetrics = await readLayoutMetrics(page);
    console.log("PC_LAYOUT_METRICS", pcMetrics);
    await saveScreenshot(page, PC_SCREENSHOT);

    const phonePage = await context.newPage();
    try {
      await enterMoveTargetState(phonePage, PHONE_VIEWPORT);
      const phoneMetrics = await readLayoutMetrics(phonePage);
      console.log("PHONE_LAYOUT_METRICS", phoneMetrics);
      expect(phoneMetrics.shellWidth).toBe("1920px");
      expect(phoneMetrics.shellScale).toBe("0.400000");
      expect(phoneMetrics.shell?.width ?? 0).toBeCloseTo(PHONE_SHELL_WIDTH, 0);
      expect(phoneMetrics.shell?.height ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.height,
        0,
      );
      expect(phoneMetrics.shell?.left ?? 0).toBeCloseTo(PHONE_SHELL_OFFSET_X, 0);
      expect(phoneMetrics.shell?.right ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.width - PHONE_SHELL_OFFSET_X,
        0,
      );
      expect(phoneMetrics.layoutMode).toBe("desktop-board");
      expect(phoneMetrics.nativeMobileUi).toEqual({
        layout: 0,
        actionRail: 0,
        roles: 0,
      });
      expect(phoneMetrics.phaseChip?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.leftRail?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.statusRail?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.actionRail?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.hudScale).toBeGreaterThan(0.5);
      expect(phoneMetrics.hudScale).toBeLessThanOrEqual(PHONE_HUD_MAX_SCALE);
      expect(phoneMetrics.fabPlacement).toBe("portal");
      expect(phoneMetrics.fabInShell).toBe(false);
      expect(phoneMetrics.fabs.every((fab) => fab.placement === "portal")).toBe(
        true,
      );
      expect(
        phoneMetrics.fabs.every(
          (fab) =>
            !fab.inShell &&
            (fab.rect?.left ?? -1) >= 0 &&
            (fab.rect?.right ?? 0) <= PHONE_VIEWPORT.width,
        ),
      ).toBe(true);
      expect(phoneMetrics.rooms.length).toBe(pcMetrics.rooms.length);
      expect(phoneMetrics.rooms.every((room) => room.visible)).toBe(true);
      expect(phoneMetrics.roomCanvas?.width ?? 0).toBeCloseTo(
        (pcMetrics.roomCanvas?.width ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.roomCanvas?.height ?? 0).toBeCloseTo(
        (pcMetrics.roomCanvas?.height ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.hudPlacement).toEqual({
        leftRailInShell: false,
        inventoryInShell: false,
        statusRailInShell: false,
        actionRailInShell: false,
        phaseChipInShell: false,
      });
      expect(phoneMetrics.leftRail?.width ?? 0).toBeCloseTo(
        (pcMetrics.leftRail?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.statusRail?.width ?? 0).toBeCloseTo(
        (pcMetrics.statusRail?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.statusRail?.height ?? 0).toBeGreaterThan(300);
      expect(phoneMetrics.statusRail?.bottom ?? 0).toBeLessThanOrEqual(
        PHONE_VIEWPORT.height,
      );
      expect(phoneMetrics.statusRailContentBottom ?? 0).toBeLessThanOrEqual(
        PHONE_VIEWPORT.height,
      );
      expect(phoneMetrics.leftRailContentBottom ?? 0).toBeLessThanOrEqual(
        PHONE_VIEWPORT.height,
      );
      expect(phoneMetrics.actionRail?.height ?? 0).toBeCloseTo(
        (pcMetrics.actionRail?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.phaseChip?.width ?? 0).toBeCloseTo(
        (pcMetrics.phaseChip?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.fabPlacement).toBe("portal");
      expect(phoneMetrics.fabInShell).toBe(false);
      expect(phoneMetrics.fabs.every((fab) => fab.placement === "portal")).toBe(
        true,
      );
      expect(
        phoneMetrics.fabs.every(
          (fab) =>
            !fab.inShell &&
            (fab.rect?.left ?? -1) >= 0 &&
            (fab.rect?.right ?? 0) <= PHONE_VIEWPORT.width,
        ),
      ).toBe(true);
      expect(phoneMetrics.inventory?.width ?? 0).toBeCloseTo(
        (pcMetrics.inventory?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.inventory?.height ?? 0).toBeCloseTo(
        (pcMetrics.inventory?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.inventory?.left ?? 0).toBeCloseTo(4, 0);
      expect(phoneMetrics.inventory?.bottom ?? 0).toBeCloseTo(
        PHONE_VIEWPORT.height,
        0,
      );
      expect(phoneMetrics.overflow.document).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      expect(phoneMetrics.overflow.body).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      await saveScreenshot(phonePage, PHONE_SCREENSHOT);
    } finally {
      await phonePage.close();
    }
  });
});
