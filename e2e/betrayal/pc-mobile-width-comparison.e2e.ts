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
const FINAL_REVIEW_EVIDENCE_DIR = "evidence/betrayal-mobile-acceptance-20261008";
const SCENARIO_BOOK_PC_SCREENSHOT = `${FINAL_REVIEW_EVIDENCE_DIR}/03-PC-剧本书正文无额外标题.png`;
const SCENARIO_BOOK_PHONE_SCREENSHOT = `${FINAL_REVIEW_EVIDENCE_DIR}/04-手机-剧本书正文无额外标题.png`;
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
const SCENARIO_ACTIONS_EVIDENCE_DIR =
  "evidence/betrayal-scenario-actions-pc-mobile-20261006";
const SCENARIO_ACTIONS_PC_SCREENSHOT = `${SCENARIO_ACTIONS_EVIDENCE_DIR}/01-PC-剧本选择三按钮同排.png`;
const SCENARIO_ACTIONS_PHONE_SCREENSHOT = `${SCENARIO_ACTIONS_EVIDENCE_DIR}/02-手机横屏-剧本选择三按钮同排.png`;

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

async function enterScenarioSelectionState(
  page: Page,
  viewport: { width: number; height: number },
) {
  await enterCharacterSelectState(page, viewport);
  const confirmationHitTarget = await page
    .getByTestId("betrayal-character-confirm")
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return {
        hitFabId:
          hit instanceof HTMLElement
            ? hit.closest<HTMLElement>("[data-fab-id]")?.dataset.fabId ?? null
            : null,
      };
    });
  expect(
    confirmationHitTarget.hitFabId,
    "角色确认中心点不能被共享 FAB 遮挡",
  ).toBeNull();
  await page.getByTestId("betrayal-character-confirm").click();
  await expect(page.getByTestId("betrayal-character-scenario-button")).toContainText(
    "木乃伊横行",
  );
  await page.getByTestId("betrayal-character-scenario-button").click();
  await expect(page.getByTestId("betrayal-scenario-select-dialog")).toBeVisible();
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
    const textMetrics = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: style.lineHeight,
      };
    };
    const movementTextMetrics = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="betrayal-movement-snapshot"] div',
      ),
    )
      .slice(0, 3)
      .map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          width: Number(box.width.toFixed(2)),
          height: Number(box.height.toFixed(2)),
          fontSize: Number.parseFloat(style.fontSize),
          lineHeight: style.lineHeight,
        };
      });
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: rect(".mobile-board-shell"),
      background: {
        rect: rect('[data-testid="game-page-background"]'),
        size: document.querySelector<HTMLElement>(
          '[data-testid="game-page-background"]',
        )
          ? getComputedStyle(
              document.querySelector<HTMLElement>(
                '[data-testid="game-page-background"]',
              )!,
            ).backgroundSize
          : null,
        position: document.querySelector<HTMLElement>(
          '[data-testid="game-page-background"]',
        )
          ? getComputedStyle(
              document.querySelector<HTMLElement>(
                '[data-testid="game-page-background"]',
              )!,
            ).backgroundPosition
          : null,
      },
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
      text: {
        phaseLabel: textMetrics(
          '[data-testid="betrayal-phase-chip"] span:first-child',
        ),
        phaseValue: textMetrics(
          '[data-testid="betrayal-phase-chip"] span:nth-child(2)',
        ),
        turnLabel: textMetrics(
          '[data-testid="betrayal-status-chip"] > div:first-child > div:first-child',
        ),
        turnName: textMetrics(
          '[data-testid="betrayal-status-chip"] > div:first-child > div:nth-child(2)',
        ),
        movement: movementTextMetrics,
        currentAbility: textMetrics(
          '[data-testid="betrayal-current-ability"]',
        ),
        teammateNames: rectList(
          '[data-testid^="betrayal-teammate-panel-"] [data-testid="betrayal-teammate-name"]',
        ),
      },
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
        Boolean(
          element.closest('[data-testid="betrayal-character-selection-grid"]'),
        ) &&
        !element.dataset.testid?.endsWith("-state-outline") &&
        !element.dataset.testid?.endsWith("-ability-trigger"),
    );
    const readText = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: style.lineHeight,
      };
    };
    const detailScroll = document.querySelector<HTMLElement>(
      '[data-testid="betrayal-character-detail-scroll"]',
    );
    const root = document.documentElement;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: rect(".mobile-board-shell"),
      background: {
        rect: rect('[data-testid="game-page-background"]'),
        size: document.querySelector<HTMLElement>(
          '[data-testid="game-page-background"]',
        )
          ? getComputedStyle(
              document.querySelector<HTMLElement>(
                '[data-testid="game-page-background"]',
              )!,
            ).backgroundSize
          : null,
        position: document.querySelector<HTMLElement>(
          '[data-testid="game-page-background"]',
        )
          ? getComputedStyle(
              document.querySelector<HTMLElement>(
                '[data-testid="game-page-background"]',
              )!,
            ).backgroundPosition
          : null,
      },
      shellWidth: root.style.getPropertyValue(
        "--mobile-board-shell-design-width",
      ),
      shellScale: root.style.getPropertyValue("--mobile-board-shell-scale"),
      screen: rect('[data-testid="betrayal-character-select-screen"]'),
      grid: rect('[data-testid="betrayal-character-selection-grid"]'),
      detail: rect('[data-testid="betrayal-character-detail-scroll"]'),
      detailAspectRatio: detailScroll
        ? Number(
            (
              detailScroll.getBoundingClientRect().width /
              detailScroll.getBoundingClientRect().height
            ).toFixed(6),
          )
        : null,
      detailScrollMetrics: detailScroll
        ? {
            scrollHeight: detailScroll.scrollHeight,
            clientHeight: detailScroll.clientHeight,
            scrollWidth: detailScroll.scrollWidth,
            clientWidth: detailScroll.clientWidth,
          }
        : null,
      detailTitle: readText(
        '[data-testid="betrayal-character-detail-scroll"] h2',
      ),
      detailBody: readText(
        '[data-testid="betrayal-character-detail-scroll"] .text-sm',
      ),
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

async function readScenarioActionMetrics(page: Page) {
  return page.evaluate(() => {
    const actionIds = [
      "betrayal-scenario-detail-toggle",
      "betrayal-scenario-select-current",
      "betrayal-scenario-dialog-close",
    ];
    const read = (id: string) => {
      const element = document.querySelector<HTMLElement>(
        `[data-testid="${id}"]`,
      );
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        id,
        left: Number(rect.left.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
        fontSize: Number.parseFloat(style.fontSize),
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight + 1 &&
          rect.left >= 0 &&
          rect.right <= window.innerWidth + 1,
      };
    };
    return {
      actions: actionIds.map(read),
      fab: Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="fab-menu"]'),
      ).map((element) => {
        const box = element.getBoundingClientRect();
        return {
          position: element.dataset.fabPosition ?? null,
          left: Number(box.left.toFixed(2)),
          top: Number(box.top.toFixed(2)),
          right: Number(box.right.toFixed(2)),
          bottom: Number(box.bottom.toFixed(2)),
        };
      }),
      actionRow: (() => {
        const element = document.querySelector<HTMLElement>(
          '[data-testid="betrayal-scenario-select-actions"]',
        );
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          left: Number(rect.left.toFixed(2)),
          top: Number(rect.top.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= 0 &&
            rect.bottom <= window.innerHeight + 1 &&
            rect.left >= 0 &&
            rect.right <= window.innerWidth + 1,
        };
      })(),
      candidateList: (() => {
        const element = document.querySelector<HTMLElement>(
          '[data-testid="betrayal-scenario-candidate-list"]',
        );
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const firstCandidate = element.querySelector<HTMLElement>(
          'button[data-testid^="betrayal-scenario-option-"]',
        );
        const firstRect = firstCandidate?.getBoundingClientRect() ?? null;
        const fullyVisibleCandidates = Array.from(
          element.querySelectorAll<HTMLElement>(
            'button[data-testid^="betrayal-scenario-option-"]',
          ),
        ).filter((candidate) => {
          const candidateRect = candidate.getBoundingClientRect();
          return (
            candidateRect.width > 0 &&
            candidateRect.height > 0 &&
            candidateRect.top >= rect.top - 1 &&
            candidateRect.bottom <= rect.bottom + 1
          );
        });
        return {
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
          fullyVisibleCount: fullyVisibleCandidates.length,
          firstCandidate: firstRect
            ? {
                width: Number(firstRect.width.toFixed(2)),
                height: Number(firstRect.height.toFixed(2)),
              }
            : null,
        };
      })(),
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
      expect(phoneMetrics.background.rect).toEqual({
        left: 0,
        top: 0,
        right: PHONE_VIEWPORT.width,
        bottom: PHONE_VIEWPORT.height,
        width: PHONE_VIEWPORT.width,
        height: PHONE_VIEWPORT.height,
      });
      expect(phoneMetrics.background.size).toBe("cover");
      expect(phoneMetrics.background.position).toBe("50% 50%");
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
      expect(phoneMetrics.detail?.height ?? 0).toBeCloseTo(
        (pcMetrics.detail?.height ?? 0) * 0.4,
        0,
      );
      expect(phoneMetrics.detailAspectRatio ?? 0).toBeCloseTo(
        pcMetrics.detailAspectRatio ?? 0,
        2,
      );
      expect(phoneMetrics.detailScrollMetrics?.scrollWidth ?? 0).toBeLessThanOrEqual(
        phoneMetrics.detailScrollMetrics?.clientWidth ?? 0,
      );
      expect(phoneMetrics.detailTitle?.height ?? 0).toBeCloseTo(
        (pcMetrics.detailTitle?.height ?? 0) * PHONE_SHELL_SCALE,
        0,
      );
      expect(phoneMetrics.detailBody?.height ?? 0).toBeCloseTo(
        (pcMetrics.detailBody?.height ?? 0) * PHONE_SHELL_SCALE,
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

  test("剧本选择三项主操作在 PC 与手机保持同排和同一视觉层级", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    await initBetrayalContext(context);
    await warmBetrayalFrontend(context);

    await enterScenarioSelectionState(page, PC_VIEWPORT);
    const pcMetrics = await readScenarioActionMetrics(page);
    await saveScreenshot(page, SCENARIO_ACTIONS_PC_SCREENSHOT);

    const phonePage = await context.newPage();
    try {
      await enterScenarioSelectionState(phonePage, PHONE_VIEWPORT);
      const phoneMetrics = await readScenarioActionMetrics(phonePage);
      await saveScreenshot(phonePage, SCENARIO_ACTIONS_PHONE_SCREENSHOT);

      for (const [label, metrics] of [
        ["PC", pcMetrics],
        ["手机", phoneMetrics],
      ] as const) {
        const actions = metrics.actions.filter(
          (action): action is NonNullable<typeof action> => Boolean(action),
        );
        expect(actions, `${label}三项主操作必须全部存在`).toHaveLength(3);
        expect(
          Math.max(...actions.map((action) => action.top)) -
            Math.min(...actions.map((action) => action.top)),
          `${label}三项主操作必须同排`,
        ).toBeLessThanOrEqual(1);
        expect(
          Math.min(...actions.map((action) => action.fontSize)),
          `${label}按钮文字不得低于16px`,
        ).toBeGreaterThanOrEqual(16);
        expect(
          actions.every((action) => Math.abs(action.height - 44) <= 1),
          `${label}三项主操作必须保持与正文匹配的44px高度`,
        ).toBe(true);
        expect(
          actions.every((action) => Math.abs(action.fontSize - 16) <= 0.5),
          `${label}三项主操作字号必须与正文16px一致`,
        ).toBe(true);
        expect(
          actions.every((action) => action.visible),
          `${label}三项主操作必须完整落在当前视口内`,
        ).toBe(true);
        expect(
          metrics.fab.some((fab) => fab.position === "top-right"),
          `${label}选角阶段 FAB 必须让位到右上角`,
        ).toBe(true);
      }

      expect(pcMetrics.overflow.document).toBeLessThanOrEqual(
        PC_VIEWPORT.width + 1,
      );
      expect(pcMetrics.overflow.body).toBeLessThanOrEqual(
        PC_VIEWPORT.width + 1,
      );
      expect(phoneMetrics.overflow.document).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );
      expect(phoneMetrics.overflow.body).toBeLessThanOrEqual(
        PHONE_VIEWPORT.width + 1,
      );

      expect(phoneMetrics.actionRow?.width ?? 0).toBeGreaterThan(0);
      expect(pcMetrics.actionRow?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.actions[0]?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.actions[1]?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.actions[2]?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.actionRow?.visible).toBe(true);
      expect(pcMetrics.actionRow?.visible).toBe(true);
      expect(phoneMetrics.actions.map((action) => action?.fontSize)).toEqual(
        pcMetrics.actions.map((action) => action?.fontSize),
      );
      for (const [label, metrics] of [
        ["PC", pcMetrics],
        ["手机", phoneMetrics],
      ] as const) {
        expect(metrics.candidateList, `${label}候选滚动框必须存在`).not.toBeNull();
        expect(
          metrics.candidateList?.scrollWidth ?? 0,
          `${label}候选滚动框不得横向溢出`,
        ).toBeLessThanOrEqual(metrics.candidateList?.clientWidth ?? 0);
        expect(
          metrics.candidateList?.scrollHeight ?? 0,
          `${label}候选滚动框必须实际可滚动`,
        ).toBeGreaterThan(metrics.candidateList?.clientHeight ?? 0);
        expect(
          metrics.candidateList?.fullyVisibleCount ?? 0,
          `${label}候选滚动框默认至少要完整显示两条候选卡`,
        ).toBeGreaterThanOrEqual(2);
        expect(
          metrics.candidateList?.firstCandidate?.width ?? 0,
          `${label}首条候选卡必须有真实宽度`,
        ).toBeGreaterThan(0);
        expect(
          metrics.candidateList?.firstCandidate?.height ?? 0,
          `${label}首条候选卡必须有真实高度`,
        ).toBeGreaterThan(0);
      }
      // 候选列表属于 portal：宽度与条目保持稳定，滚动框高度由真实视口约束，
      // 不能把手机的可视高度误判成壳内结构尺寸回归。
      expect(phoneMetrics.candidateList?.firstCandidate?.width ?? 0).toBeCloseTo(
        pcMetrics.candidateList?.firstCandidate?.width ?? 0,
        0,
      );
      expect(phoneMetrics.candidateList?.firstCandidate?.height ?? 0).toBeCloseTo(
        pcMetrics.candidateList?.firstCandidate?.height ?? 0,
        0,
      );

      for (const [label, targetPage, screenshotPath] of [
        ["PC", page, SCENARIO_BOOK_PC_SCREENSHOT],
        ["手机", phonePage, SCENARIO_BOOK_PHONE_SCREENSHOT],
      ] as const) {
        await targetPage.getByTestId("betrayal-scenario-detail-toggle").click();
        const scenarioReader = targetPage.getByTestId(
          "betrayal-scenario-reader-dialog",
        );
        await expect(scenarioReader, `${label}剧本书必须打开`).toBeVisible();
        await expect(
          scenarioReader.getByTestId("betrayal-scenario-reader-title"),
          `${label}剧本书不显示额外标题`,
        ).toHaveCount(0);
        await expect(
          scenarioReader.getByTestId("betrayal-scenario-book"),
        ).toBeVisible();
        await saveScreenshot(targetPage, screenshotPath);
        await scenarioReader
          .getByTestId("betrayal-scenario-reader-close")
          .click();
        await expect(scenarioReader).toBeHidden();
      }
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
    console.log("PC_TEXT_METRICS", JSON.stringify(pcMetrics.text));
    await saveScreenshot(page, RUNTIME_PC_SCREENSHOT);

    const phonePage = await context.newPage();
    try {
      await enterStartedBoardState(phonePage, PHONE_VIEWPORT);
      const phoneMetrics = await readLayoutMetrics(phonePage);
      console.log("PHONE_TEXT_METRICS", JSON.stringify(phoneMetrics.text));
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
      expect(
        phoneMetrics.actions
          .filter((action) => action.testId.startsWith("betrayal-action-") && action.testId !== "betrayal-action-rail" && action.testId !== "betrayal-action-cue")
          .every((action) => {
            const pcAction = pcMetrics.actions.find(
              (candidate) => candidate.testId === action.testId,
            );
            return Math.abs(
              action.height - (pcAction?.height ?? 0) * phoneMetrics.hudScale,
            ) <= 1;
          }),
      ).toBe(true);
      expect(phoneMetrics.phaseChip?.width ?? 0).toBeCloseTo(
        (pcMetrics.phaseChip?.width ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.text.phaseLabel?.height ?? 0).toBeCloseTo(
        (pcMetrics.text.phaseLabel?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.text.phaseValue?.height ?? 0).toBeCloseTo(
        (pcMetrics.text.phaseValue?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.text.turnLabel?.height ?? 0).toBeCloseTo(
        (pcMetrics.text.turnLabel?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.text.turnName?.height ?? 0).toBeCloseTo(
        (pcMetrics.text.turnName?.height ?? 0) * phoneMetrics.hudScale,
        0,
      );
      expect(phoneMetrics.text.currentAbility?.fontSize ?? 0).toBeCloseTo(
        pcMetrics.text.currentAbility?.fontSize ?? 16,
        1,
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
      expect(phoneMetrics.roomCanvas?.width ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.roomCanvas?.height ?? 0).toBeGreaterThan(0);
      expect(phoneMetrics.roomCanvas?.width ?? 0).toBeLessThanOrEqual(
        phoneMetrics.roomGrid?.width ?? 0,
      );
      expect(phoneMetrics.roomCanvas?.height ?? 0).toBeLessThanOrEqual(
        phoneMetrics.roomGrid?.height ?? 0,
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
