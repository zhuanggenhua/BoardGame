import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "path";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  initBetrayalContext,
  saveScreenshot,
  setHarnessRandomQueue,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";
import { MOBILE_LANDSCAPE_REFERENCE_VIEWPORT } from "../../src/shared/referenceViewports";

const EVIDENCE_DIR = resolve(process.cwd(), "evidence/betrayal-tutorial");
const STEP_00 = `${EVIDENCE_DIR}/00-山屋惊魂-教程-章节目录.jpg`;
const STEP_01 = `${EVIDENCE_DIR}/01-山屋惊魂-教程-恶兆前动作区.jpg`;
const STEP_02 = `${EVIDENCE_DIR}/02-山屋惊魂-教程-剩余移动.jpg`;
const STEP_03 = `${EVIDENCE_DIR}/03-山屋惊魂-教程-房间主视区.jpg`;
const STEP_04 = `${EVIDENCE_DIR}/04-山屋惊魂-教程-持有区与帮助入口.jpg`;
const STEP_05 = `${EVIDENCE_DIR}/05-山屋惊魂-教程-书本使用前.jpg`;
const STEP_06 = `${EVIDENCE_DIR}/06-山屋惊魂-教程-书本已选中准备使用.jpg`;
const STEP_07 = `${EVIDENCE_DIR}/07-山屋惊魂-教程-已用书本预览清晰.jpg`;
const STEP_08 = `${EVIDENCE_DIR}/08-山屋惊魂-教程-使用后准备移动.jpg`;
const STEP_09 = `${EVIDENCE_DIR}/09-山屋惊魂-教程-房间牌整张承接-点击前.jpg`;
const STEP_10 = `${EVIDENCE_DIR}/10-山屋惊魂-教程-房间牌整张承接-点击后.jpg`;
const STEP_11 = `${EVIDENCE_DIR}/11-山屋惊魂-教程-探索未知房间前.jpg`;
const STEP_11A = `${EVIDENCE_DIR}/11a-山屋惊魂-教程-确认放置新房间.jpg`;
const STEP_12 = `${EVIDENCE_DIR}/12-山屋惊魂-教程-探索后发现牌.jpg`;
const STEP_13 = `${EVIDENCE_DIR}/13-山屋惊魂-教程-点击兔脚后选择骰子.jpg`;
const STEP_14 = `${EVIDENCE_DIR}/14-山屋惊魂-教程-兔脚选中改骰高亮.jpg`;
const STEP_15 = `${EVIDENCE_DIR}/15-山屋惊魂-教程-兔脚重投结束.jpg`;
const STEP_16 = `${EVIDENCE_DIR}/16-山屋惊魂-教程-探索后牌桌结果.jpg`;
const STEP_17 = `${EVIDENCE_DIR}/17-山屋惊魂-教程-木乃伊作祟目标改变.jpg`;
const STEP_18 = `${EVIDENCE_DIR}/18-山屋惊魂-教程-打开木乃伊剧本目标页.jpg`;
const STEP_19 = `${EVIDENCE_DIR}/19-山屋惊魂-教程-驱逐木乃伊前因果说明.jpg`;
const STEP_20 = `${EVIDENCE_DIR}/20-山屋惊魂-教程-驱逐木乃伊神志对抗骰盘.jpg`;
const STEP_21 = `${EVIDENCE_DIR}/21-山屋惊魂-教程-驱逐木乃伊成功后的终局页.jpg`;
const STEP_22 = `${EVIDENCE_DIR}/22-山屋惊魂-教程-英雄攻击叛徒前.jpg`;
const STEP_23 = `${EVIDENCE_DIR}/23-山屋惊魂-教程-英雄攻击叛徒骰盘.jpg`;
const STEP_24 = `${EVIDENCE_DIR}/24-山屋惊魂-教程-叛徒视角敌方攻击前.jpg`;
const STEP_25 = `${EVIDENCE_DIR}/25-山屋惊魂-教程-叛徒终局页.jpg`;
const STEP_26 = `${EVIDENCE_DIR}/26-山屋惊魂-教程-杰克之灵目标页.jpg`;
const STEP_27 = `${EVIDENCE_DIR}/27-山屋惊魂-教程-杰克之灵攻击英雄前.jpg`;
const STEP_28 = `${EVIDENCE_DIR}/28-山屋惊魂-教程-杰克之灵攻击骰盘.jpg`;
const STEP_29 = `${EVIDENCE_DIR}/29-山屋惊魂-教程-交易同房间说明.jpg`;
const STEP_30 = `${EVIDENCE_DIR}/30-山屋惊魂-教程-交易选择兔脚.jpg`;
const STEP_31 = `${EVIDENCE_DIR}/31-山屋惊魂-教程-交易选择队友.jpg`;
const STEP_32 = `${EVIDENCE_DIR}/32-山屋惊魂-教程-交易选择对方地图.jpg`;
const STEP_33 = `${EVIDENCE_DIR}/33-山屋惊魂-教程-交易请求等待同意.jpg`;
const STEP_34 = `${EVIDENCE_DIR}/34-山屋惊魂-教程-交易接收方同意.jpg`;
const STEP_35 = `${EVIDENCE_DIR}/35-山屋惊魂-教程-交易后互换结果.jpg`;
const STEP_36 = `${EVIDENCE_DIR}/36-山屋惊魂-教程-属性轨读法.jpg`;
const STEP_37 = `${EVIDENCE_DIR}/37-山屋惊魂-教程-观察队友视角.jpg`;
const STEP_37A = `${EVIDENCE_DIR}/37a-山屋惊魂-教程-切到第二名队友视角.jpg`;
const STEP_37B = `${EVIDENCE_DIR}/37b-山屋惊魂-教程-再次点队友返回上一视角.jpg`;
const STEP_38 = `${EVIDENCE_DIR}/38-山屋惊魂-教程-聚焦回自己房间.jpg`;
const STEP_39 = `${EVIDENCE_DIR}/39-山屋惊魂-教程-预兆作祟进度条.jpg`;
const STEP_40 = `${EVIDENCE_DIR}/40-山屋惊魂-教程-同屏确认预兆与作祟检定.jpg`;
const STEP_42 = `${EVIDENCE_DIR}/42-山屋惊魂-教程-确认后回牌桌持有区.jpg`;
const STEP_43 = `${EVIDENCE_DIR}/43-山屋惊魂-教程-确认后预兆进度条.jpg`;
const STEP_44 = `${EVIDENCE_DIR}/44-山屋惊魂-教程-叛徒打开木乃伊剧本目标页.jpg`;
const STEP_45 = `${EVIDENCE_DIR}/45-山屋惊魂-教程-叛徒拾起女孩前.jpg`;
const STEP_46 = `${EVIDENCE_DIR}/46-山屋惊魂-教程-女孩交给木乃伊前.jpg`;
const STEP_47 = `${EVIDENCE_DIR}/47-山屋惊魂-教程-圣符交给木乃伊前.jpg`;
const STEP_48 = `${EVIDENCE_DIR}/48-山屋惊魂-教程-木乃伊叛徒胜利.jpg`;
const STEP_49 = `${EVIDENCE_DIR}/49-山屋惊魂-教程-木乃伊怪物回合开始前.jpg`;
const STEP_50 = `${EVIDENCE_DIR}/50-山屋惊魂-教程-木乃伊移动骰盘.jpg`;
const STEP_51 = `${EVIDENCE_DIR}/51-山屋惊魂-教程-木乃伊瞬移目标.jpg`;
const STEP_52 = `${EVIDENCE_DIR}/52-山屋惊魂-教程-木乃伊拾起女孩结果.jpg`;
const STEP_53 = `${EVIDENCE_DIR}/53-山屋惊魂-教程-木乃伊同房必须先攻击.jpg`;
const STEP_54 = `${EVIDENCE_DIR}/54-山屋惊魂-教程-木乃伊攻击目标高亮.jpg`;
const STEP_55 = `${EVIDENCE_DIR}/55-山屋惊魂-教程-木乃伊攻击骰盘.jpg`;
const STEP_56 = `${EVIDENCE_DIR}/56-山屋惊魂-教程-木乃伊偷取奖励入口.jpg`;
const STEP_57 = `${EVIDENCE_DIR}/57-山屋惊魂-教程-木乃伊偷走地图结果.jpg`;
const TECHNICAL_ASSET_GATE_STEP = `${EVIDENCE_DIR}/技术证据-山屋惊魂-教程-素材加载门禁.jpg`;
const MOBILE_EVIDENCE_DIR = resolve(
  process.cwd(),
  "test-results/evidence-screenshots/betrayal/山屋惊魂-教程移动端横屏验收",
);
const MOBILE_STEP_01 = `${MOBILE_EVIDENCE_DIR}/01-手机横屏-教程书本使用入口.png`;
const PC_REGRESSION_EVIDENCE_DIR = resolve(
  process.cwd(),
  "test-results/evidence-screenshots/betrayal/pc-regression-current",
);
const PC_REGRESSION_STEP_USE_BOOK = `${PC_REGRESSION_EVIDENCE_DIR}/09-pc-第二章使用书本前-current.png`;
const PC_REGRESSION_STEP_BOARD = `${PC_REGRESSION_EVIDENCE_DIR}/03-pc-房间主视区-current.png`;

const waitForStep = async (
  page: Parameters<typeof test>[0]["page"],
  stepId: string,
  timeout = 15000,
) => {
  try {
    await expect(page.locator(`[data-tutorial-step="${stepId}"]`)).toBeVisible({
      timeout,
    });
  } catch (error) {
    const diagnostics = await page.evaluate((expectedStepId) => {
      const snapshot = (
        window as unknown as {
          __BG_TEST_HARNESS__?: {
            state?: {
              get?: () => {
                sys?: {
                  tutorial?: {
                    active?: boolean;
                    manifestId?: string | null;
                    stepIndex?: number;
                    steps?: unknown[];
                    totalSteps?: number;
                    step?: {
                      id?: string;
                      highlightTarget?: string;
                      aiActions?: unknown[];
                    } | null;
                    aiActions?: unknown[];
                    pendingAnimationAdvance?: boolean;
                  };
                };
                core?: { phase?: string };
              };
            };
          };
          __BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?: unknown;
        }
      ).__BG_TEST_HARNESS__?.state?.get?.();
      const tutorial = snapshot?.sys?.tutorial;
      const highlightTarget = tutorial?.step?.highlightTarget ?? null;
      const target = highlightTarget
        ? document.querySelector(`[data-tutorial-id="${highlightTarget}"]`)
          ?? document.getElementById(highlightTarget)
          ?? document.querySelector(`[data-testid="${highlightTarget}"]`)
        : null;
      const activeStep = document.querySelector("[data-tutorial-step]");
      const overlayCard = document.querySelector('[data-testid="tutorial-overlay-card"]');
      const targetRect = target?.getBoundingClientRect();
      return {
        expectedStepId,
        href: window.location.href,
        contextDiagnostics:
          (window as unknown as { __BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?: unknown })
            .__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__ ?? null,
        tutorialActive: tutorial?.active ?? null,
        manifestId: tutorial?.manifestId ?? null,
        stepIndex: tutorial?.stepIndex ?? null,
        stepId: tutorial?.step?.id ?? null,
        stepsLength: tutorial?.steps?.length ?? null,
        totalSteps: tutorial?.totalSteps ?? null,
        stepAiActionCount: tutorial?.step?.aiActions?.length ?? 0,
        aiActionCount: tutorial?.aiActions?.length ?? 0,
        pendingAnimationAdvance: tutorial?.pendingAnimationAdvance ?? false,
        highlightTarget,
        highlightTargetFound: Boolean(target),
        highlightTargetRect: targetRect
          ? {
              x: Math.round(targetRect.x),
              y: Math.round(targetRect.y),
              width: Math.round(targetRect.width),
              height: Math.round(targetRect.height),
            }
          : null,
        activeStepDom: activeStep?.getAttribute("data-tutorial-step") ?? null,
        hasTutorialOverlayCard: Boolean(overlayCard),
        overlayText:
          overlayCard?.textContent?.replace(/\s+/g, " ").trim().slice(0, 300)
          ?? null,
        phase: snapshot?.core?.phase ?? null,
        bodyText:
          document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 800)
          ?? "",
      };
    }, stepId);
    throw new Error(
      `等待教程步骤 ${stepId} 超时。\n诊断：${JSON.stringify(
        diagnostics,
        null,
        2,
      )}\n原始错误：${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const waitForTradeAgreementState = async (
  page: Parameters<typeof test>[0]["page"],
  state: "waiting" | "incoming",
  timeout = 15000,
) => {
  await expect(page.getByTestId("betrayal-trade-flow-banner")).toHaveAttribute(
    "data-trade-agreement-state",
    state,
    { timeout },
  );
};

const waitForStableIncomingTradeAgreement = async (
  page: Parameters<typeof test>[0]["page"],
  timeout = 30000,
) => {
  await waitForStep(page, "accept-trade-request", timeout);
  await waitForTradeAgreementState(page, "incoming", timeout);
  await expect(
    page.getByTestId("betrayal-trade-agreement-panel"),
  ).toBeVisible({ timeout });
  await expect(
    page.getByTestId("betrayal-trade-agreement-accept"),
  ).toBeVisible({ timeout });
  await expect(
    page.getByTestId("betrayal-trade-agreement-decline"),
  ).toBeVisible({ timeout });

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const banner = document.querySelector(
            '[data-testid="betrayal-trade-flow-banner"]',
          );
          const accept = document.querySelector(
            '[data-testid="betrayal-trade-agreement-accept"]',
          ) as HTMLElement | null;
          const panel = document.querySelector(
            '[data-testid="betrayal-trade-agreement-panel"]',
          ) as HTMLElement | null;
          const step = document.querySelector(
            '[data-tutorial-step="accept-trade-request"]',
          );
          const state = (
            window as unknown as {
              __BG_TEST_HARNESS__?: {
                state?: {
                  get?: () => {
                    core?: {
                      pendingTradeAgreement?: {
                        playerId?: string;
                        targetPlayerId?: string;
                      } | null;
                    };
                  };
                };
              };
            }
          ).__BG_TEST_HARNESS__?.state?.get?.();
          const pending = state?.core?.pendingTradeAgreement ?? null;

          return {
            stepReady: Boolean(step),
            incoming:
              banner?.getAttribute("data-trade-agreement-state") ===
              "incoming",
            panelVisible: Boolean(
              panel &&
                panel.offsetWidth > 0 &&
                panel.offsetHeight > 0,
            ),
            acceptVisible: Boolean(
              accept &&
                accept.offsetWidth > 0 &&
                accept.offsetHeight > 0,
            ),
            pendingRequester: pending?.playerId ?? null,
            pendingTarget: pending?.targetPlayerId ?? null,
          };
        }),
      {
        message:
          "交易教程必须稳定停在接收方同意态：教程步骤、incoming 横幅、同意按钮和领域待同意状态要同时成立",
        timeout,
      },
    )
    .toEqual({
      stepReady: true,
      incoming: true,
      panelVisible: true,
      acceptVisible: true,
      pendingRequester: "0",
      pendingTarget: "1",
    });
};

const waitForHauntRuntime = async (
  page: Parameters<typeof test>[0]["page"],
  timeout = 30000,
) => {
  await expect(page.getByTestId("betrayal-board")).toBeVisible({ timeout });
  await expect(page.getByTestId("betrayal-runtime-header-grid")).toContainText(
    /作祟中|Haunt/i,
    { timeout },
  );
};

const resolveCurrentRoomExplorerTarget = async (
  page: Page,
  mode: "attack-hero" | "attack-traitor",
): Promise<{ roomId: string; playerId: string }> => {
  const target = await page.evaluate((targetMode) => {
    const state = (
      window as unknown as {
        __BG_TEST_HARNESS__?: {
          state?: {
            get?: () => {
              core?: {
                activeRoomId?: string;
                currentExplorer?: { playerId?: string; roomId?: string };
                otherExplorers?: Array<{
                  playerId: string;
                  roomId: string;
                  displayName?: string;
                }>;
                scenarioRuntime?: {
                  traitorPlayerId?: string;
                  deadExplorerPlayerIds?: string[];
                };
              };
            };
          };
        };
      }
    ).__BG_TEST_HARNESS__?.state?.get?.();
    const core = state?.core;
    const roomId = core?.activeRoomId ?? core?.currentExplorer?.roomId;
    if (!core || !roomId) return null;
    const deadIds = core.scenarioRuntime?.deadExplorerPlayerIds ?? [];
    const candidates =
      core.otherExplorers?.filter(
        (explorer) =>
          explorer.roomId === roomId && !deadIds.includes(explorer.playerId),
      ) ?? [];
    const playerId =
      targetMode === "attack-traitor"
        ? candidates.find(
            (explorer) =>
              explorer.playerId === core.scenarioRuntime?.traitorPlayerId,
          )?.playerId
        : candidates.find(
            (explorer) =>
              explorer.playerId !== core.scenarioRuntime?.traitorPlayerId,
          )?.playerId;
    if (!playerId) return null;
    return { roomId, playerId };
  }, mode);

  expect(
    target,
    `山屋教程 ${mode} 必须能从当前运行状态找到同房间目标 token`,
  ).not.toBeNull();
  return target!;
};

const resolveMummyBanishRoomTarget = async (
  page: Page,
): Promise<{ roomId: string; monsterId: string }> => {
  const target = await page.evaluate(() => {
    const state = (
      window as unknown as {
        __BG_TEST_HARNESS__?: {
          state?: {
            get?: () => {
              core?: {
                currentExplorer?: { roomId?: string };
                monsters?: Array<{ id: string; roomId: string }>;
                scenarioRuntime?: {
                  mummy?: {
                    mummyMonsterId?: string;
                    sarcophagusRoomId?: string;
                  };
                };
              };
            };
          };
        };
      }
    ).__BG_TEST_HARNESS__?.state?.get?.();
    const core = state?.core;
    const mummyMonsterId = core?.scenarioRuntime?.mummy?.mummyMonsterId;
    const sarcophagusRoomId = core?.scenarioRuntime?.mummy?.sarcophagusRoomId;
    if (!core || !mummyMonsterId || !sarcophagusRoomId) return null;
    const mummy = core.monsters?.find((monster) => monster.id === mummyMonsterId);
    if (!mummy || mummy.roomId !== sarcophagusRoomId) return null;
    if (core.currentExplorer?.roomId !== sarcophagusRoomId) return null;
    return { roomId: sarcophagusRoomId, monsterId: mummyMonsterId };
  });

  expect(
    target,
    "木乃伊驱逐教程必须从当前运行态找到英雄、木乃伊和石棺同房的房间牌目标",
  ).not.toBeNull();
  return target!;
};

const resolveMummyTraitorTutorialTarget = async (
  page: Page,
): Promise<{ roomId: string; traitorId: string; girlTokenTestId: string; sarcophagusTokenTestId: string }> => {
  const target = await page.evaluate(() => {
    const state = (
      window as unknown as {
        __BG_TEST_HARNESS__?: {
          state?: {
            get?: () => {
              core?: {
                currentExplorer?: { playerId?: string; roomId?: string };
                monsters?: Array<{ id: string; roomId: string }>;
                scenarioRuntime?: {
                  traitorPlayerId?: string | null;
                  mummy?: {
                    mummyMonsterId?: string;
                    sarcophagusRoomId?: string;
                    girlRoomId?: string | null;
                  };
                };
              };
            };
          };
        };
      }
    ).__BG_TEST_HARNESS__?.state?.get?.();
    const core = state?.core;
    const traitorId = core?.scenarioRuntime?.traitorPlayerId ?? null;
    const mummy = core?.scenarioRuntime?.mummy;
    const roomId = core?.currentExplorer?.roomId;
    const mummyMonster = core?.monsters?.find((monster) => monster.id === mummy?.mummyMonsterId);
    if (!core || !traitorId || !mummy || !roomId || !mummyMonster) return null;
    if (core.currentExplorer?.playerId !== traitorId) return null;
    if (mummy.sarcophagusRoomId !== roomId || mummy.girlRoomId !== roomId) return null;
    if (mummyMonster.roomId !== roomId) return null;
    return {
      roomId,
      traitorId,
      girlTokenTestId: `betrayal-room-haunt-token-${roomId}-mummy-girl-token`,
      sarcophagusTokenTestId: `betrayal-room-haunt-token-${roomId}-mummy-sarcophagus`,
    };
  });

  expect(
    target,
    "木乃伊叛徒教程必须从叛徒、女孩、木乃伊、石棺同房且圣符在手的真实状态开始",
  ).not.toBeNull();
  return target!;
};

const resolveMummyMonsterMoveTutorialTarget = async (
  page: Page,
): Promise<{
  traitorId: string;
  mummyRoomId: string;
  mummyRoomFloor: string;
  girlRoomId: string;
  girlRoomFloor: string;
  girlRoomName: string;
  girlTokenTestId: string;
  unrevealedRoomId: string | null;
}> => {
  const target = await page.evaluate(() => {
    const state = (
      window as unknown as {
        __BG_TEST_HARNESS__?: {
          state?: {
            get?: () => {
              core?: {
                currentExplorer?: { playerId?: string };
                rooms?: Array<{ id: string; name: string; floor: string; state?: string }>;
                monsters?: Array<{ id: string; roomId: string }>;
                scenarioRuntime?: {
                  traitorPlayerId?: string | null;
                  mummy?: {
                    mummyMonsterId?: string;
                    sarcophagusRoomId?: string;
                    girlRoomId?: string | null;
                    girlHeldByMummy?: boolean;
                  };
                };
              };
            };
          };
        };
      }
    ).__BG_TEST_HARNESS__?.state?.get?.();
    const core = state?.core;
    const traitorId = core?.scenarioRuntime?.traitorPlayerId ?? null;
    const mummy = core?.scenarioRuntime?.mummy;
    const mummyMonster = core?.monsters?.find((monster) => monster.id === mummy?.mummyMonsterId);
    const mummyRoom = core?.rooms?.find((room) => room.id === mummyMonster?.roomId);
    const girlRoom = core?.rooms?.find((room) => room.id === mummy?.girlRoomId);
    const unrevealedRoom = core?.rooms?.find((room) => room.state !== "discovered") ?? null;
    if (!core || !traitorId || !mummy || !mummyMonster || !mummyRoom || !girlRoom || !mummy.girlRoomId) {
      return null;
    }
    if (core.currentExplorer?.playerId !== traitorId || mummy.girlHeldByMummy) {
      return null;
    }
    return {
      traitorId,
      mummyRoomId: mummyMonster.roomId,
      mummyRoomFloor: mummyRoom.floor,
      girlRoomId: mummy.girlRoomId,
      girlRoomFloor: girlRoom.floor,
      girlRoomName: girlRoom.name,
      girlTokenTestId: `betrayal-room-haunt-token-${mummy.girlRoomId}-mummy-girl-token`,
      unrevealedRoomId: unrevealedRoom?.id ?? null,
    };
  });

  expect(
    target,
    "木乃伊怪物移动教程必须从叛徒操控、木乃伊和女孩分处已发现房间的真实状态开始",
  ).not.toBeNull();
  return target!;
};

const resolveMummyMonsterAttackTutorialTarget = async (
  page: Page,
): Promise<{
  traitorId: string;
  mummyRoomId: string;
  mummyRoomFloor: string;
  heroTargetId: string;
  deadHeroId: string | null;
}> => {
  const target = await page.evaluate(() => {
    const state = (
      window as unknown as {
        __BG_TEST_HARNESS__?: {
          state?: {
            get?: () => {
              core?: {
                currentExplorer?: { playerId?: string };
                otherExplorers?: Array<{ playerId: string; roomId: string; inventory?: Array<{ id: string }> }>;
                rooms?: Array<{ id: string; floor: string }>;
                monsters?: Array<{ id: string; roomId: string }>;
                scenarioRuntime?: {
                  traitorPlayerId?: string | null;
                  deadExplorerPlayerIds?: string[];
                  mummy?: { mummyMonsterId?: string };
                };
              };
            };
          };
        };
      }
    ).__BG_TEST_HARNESS__?.state?.get?.();
    const core = state?.core;
    const traitorId = core?.scenarioRuntime?.traitorPlayerId ?? null;
    const deadIds = core?.scenarioRuntime?.deadExplorerPlayerIds ?? [];
    const mummyMonster = core?.monsters?.find((monster) => monster.id === core?.scenarioRuntime?.mummy?.mummyMonsterId);
    const mummyRoom = core?.rooms?.find((room) => room.id === mummyMonster?.roomId);
    if (!core || !traitorId || !mummyMonster || !mummyRoom || core.currentExplorer?.playerId !== traitorId) {
      return null;
    }
    const sameRoomExplorers = core.otherExplorers?.filter((explorer) => explorer.roomId === mummyMonster.roomId) ?? [];
    const heroTarget = sameRoomExplorers.find((explorer) => (
      explorer.playerId !== traitorId
      && !deadIds.includes(explorer.playerId)
      && explorer.inventory?.some((card) => card.id === "map")
    ));
    if (!heroTarget) {
      return null;
    }
    return {
      traitorId,
      mummyRoomId: mummyMonster.roomId,
      mummyRoomFloor: mummyRoom.floor,
      heroTargetId: heroTarget.playerId,
      deadHeroId: sameRoomExplorers.find((explorer) => deadIds.includes(explorer.playerId))?.playerId ?? null,
    };
  });

  expect(
    target,
    "木乃伊攻击教程必须从木乃伊、叛徒和持地图英雄同房的真实状态开始",
  ).not.toBeNull();
  return target!;
};

const switchRoomMapToFloor = async (page: Page, floor: string): Promise<void> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await page.getByTestId(`betrayal-room-floor-${floor}`).isVisible({ timeout: 500 }).catch(() => false)) {
      return;
    }
    const upperVisible = await page.getByTestId("betrayal-room-floor-upper")
      .isVisible({ timeout: 250 })
      .catch(() => false);
    const basementVisible = await page.getByTestId("betrayal-room-floor-basement")
      .isVisible({ timeout: 250 })
      .catch(() => false);
    if (floor === "upper" || (floor === "ground" && basementVisible)) {
      await page.getByTestId("betrayal-room-floor-up").click();
    } else if (floor === "basement" || (floor === "ground" && upperVisible)) {
      await page.getByTestId("betrayal-room-floor-down").click();
    }
  }
  await expect(page.getByTestId(`betrayal-room-floor-${floor}`)).toBeVisible();
};

const expectImageLoaded = async (
  locator: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
) => {
  await expect
    .poll(async () =>
      locator.evaluate((node) => {
        const image =
          node instanceof HTMLImageElement ? node : node.querySelector("img");
        return Boolean(
          image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
        );
      }),
    )
    .toBe(true);
};

const expectVisiblePhysicalDiceBox = async (rollPanel: Locator) => {
  const diceGroup = rollPanel.getByTestId("betrayal-house-dice-3d-group");
  await expect(diceGroup).toBeVisible();
  await expect(diceGroup).toHaveAttribute(
    "data-render-mode",
    "betrayal-house-dice-box-visible",
  );
  await expect(diceGroup).toHaveAttribute(
    "data-dice-tray-style",
    "transparent-virtual",
  );
  await expect(diceGroup).toHaveAttribute("data-dice-count", /[1-9]/);
  await expect
    .poll(async () => diceGroup.getAttribute("data-dice-physics-ready"), {
      timeout: 10000,
    })
    .toBe("true");

  const physicsSource = rollPanel.getByTestId(
    "betrayal-house-dice-physics-source",
  );
  await expect(physicsSource).toHaveAttribute(
    "data-dice-physics-source",
    "dice-box-threejs",
  );
  await expect(physicsSource).toHaveAttribute(
    "data-dice-physics-mode",
    "debug-visible",
  );
  await expect(physicsSource).toHaveAttribute(
    "data-dice-face-system",
    "betrayal-house-0-1-2-per-die-skin",
  );
  await expect
    .poll(
      async () =>
        diceGroup.evaluate((node) => {
          const canvases = Array.from(node.querySelectorAll("canvas")).filter(
            (canvas): canvas is HTMLCanvasElement =>
              canvas instanceof HTMLCanvasElement,
          );
          const source = node.querySelector(
            '[data-testid="betrayal-house-dice-physics-source"]',
          ) as HTMLElement | null;
          if (source?.dataset.dicePhysicsSource !== "dice-box-threejs")
            return false;
          if (
            source?.dataset.diceFaceSystem !==
            "betrayal-house-0-1-2-per-die-skin"
          )
            return false;

          return canvases.some((canvas) => {
            const rect = canvas.getBoundingClientRect();
            const style = window.getComputedStyle(canvas);
            return (
              rect.width >= 160 &&
              rect.height >= 120 &&
              canvas.dataset.skinsReady === "true" &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity || "1") > 0.5
            );
          });
        }),
      { timeout: 10000 },
    )
    .toBe(true);
};

const waitForPhysicalDiceSettled = async (rollPanel: Locator) => {
  const physicsSource = rollPanel.getByTestId(
    "betrayal-house-dice-physics-source",
  );
  await expect
    .poll(async () => physicsSource.getAttribute("data-dice-settled"), {
      timeout: 15000,
    })
    .toBe("true");
  await rollPanel.page().waitForTimeout(450);
};

const expectInventoryCardHasSingleSymmetricOutline = async (card: Locator) => {
  const outline = await card.evaluate((node) => {
    const button = node as HTMLElement;
    const shell = button.querySelector(
      '[data-testid$="-shell"]',
    ) as HTMLElement | null;
    const modifier = button.querySelector(
      '[data-testid$="-roll-modifier"]',
    ) as HTMLElement | null;
    const selectedOutline = button.querySelector(
      '[data-testid$="-selected-outline"]',
    ) as HTMLElement | null;
    const buttonStyle = window.getComputedStyle(button);
    const shellStyle = shell ? window.getComputedStyle(shell) : null;
    const modifierStyle = modifier ? window.getComputedStyle(modifier) : null;
    const selectedOutlineStyle = selectedOutline
      ? window.getComputedStyle(selectedOutline)
      : null;
    const modifierRect = modifier?.getBoundingClientRect();
    const selectedOutlineRect = selectedOutline?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    return {
      buttonShadowLayers:
        buttonStyle.boxShadow === "none"
          ? 0
          : buttonStyle.boxShadow.split("),").length,
      buttonOutlineStyle: buttonStyle.outlineStyle,
      buttonOutlineWidth: buttonStyle.outlineWidth,
      buttonRingShadow: buttonStyle.getPropertyValue("--tw-ring-shadow"),
      shellBoxShadow: shellStyle?.boxShadow ?? null,
      modifierExists: Boolean(modifier),
      selectedOutlineExists: Boolean(selectedOutline),
      selectedBorderTop: selectedOutlineStyle?.borderTopWidth ?? null,
      selectedBorderRight: selectedOutlineStyle?.borderRightWidth ?? null,
      selectedBorderBottom: selectedOutlineStyle?.borderBottomWidth ?? null,
      selectedBorderLeft: selectedOutlineStyle?.borderLeftWidth ?? null,
      selectedShape: selectedOutline?.dataset.highlightShape ?? null,
      selectedBorderRadius: selectedOutlineStyle?.borderTopLeftRadius ?? null,
      selectedBorderRadiusNumber: selectedOutlineStyle
        ? Number.parseFloat(selectedOutlineStyle.borderTopLeftRadius)
        : null,
      selectedWidth: selectedOutlineRect
        ? Math.round(selectedOutlineRect.width)
        : null,
      selectedHeight: selectedOutlineRect
        ? Math.round(selectedOutlineRect.height)
        : null,
      modifierBorderTop: modifierStyle?.borderTopWidth ?? null,
      modifierBorderRight: modifierStyle?.borderRightWidth ?? null,
      modifierBorderBottom: modifierStyle?.borderBottomWidth ?? null,
      modifierBorderLeft: modifierStyle?.borderLeftWidth ?? null,
      modifierShape: modifier?.dataset.highlightShape ?? null,
      modifierBorderRadius: modifierStyle?.borderTopLeftRadius ?? null,
      modifierBorderRadiusNumber: modifierStyle
        ? Number.parseFloat(modifierStyle.borderTopLeftRadius)
        : null,
      modifierWidth: modifierRect ? Math.round(modifierRect.width) : null,
      modifierHeight: modifierRect ? Math.round(modifierRect.height) : null,
      selectedInsetLeft:
        selectedOutlineRect && shellRect
          ? Math.round(selectedOutlineRect.left - shellRect.left)
          : null,
      selectedInsetRight:
        selectedOutlineRect && shellRect
          ? Math.round(shellRect.right - selectedOutlineRect.right)
          : null,
      selectedInsetTop:
        selectedOutlineRect && shellRect
          ? Math.round(selectedOutlineRect.top - shellRect.top)
          : null,
      selectedInsetBottom:
        selectedOutlineRect && shellRect
          ? Math.round(shellRect.bottom - selectedOutlineRect.bottom)
          : null,
      modifierInsetLeft:
        modifierRect && shellRect
          ? Math.round(modifierRect.left - shellRect.left)
          : null,
      modifierInsetRight:
        modifierRect && shellRect
          ? Math.round(shellRect.right - modifierRect.right)
          : null,
      modifierInsetTop:
        modifierRect && shellRect
          ? Math.round(modifierRect.top - shellRect.top)
          : null,
      modifierInsetBottom:
        modifierRect && shellRect
          ? Math.round(shellRect.bottom - modifierRect.bottom)
          : null,
    };
  });
  expect(
    outline.buttonShadowLayers,
    "选中/可改骰按钮外发光不能叠成多圈描边",
  ).toBeLessThanOrEqual(2);
  expect(outline.buttonOutlineStyle, "持有物按钮本体不能再出现矩形焦点框").toBe(
    "none",
  );
  expect(outline.buttonOutlineWidth, "持有物按钮本体不能再出现矩形焦点框").toBe(
    "0px",
  );
  expect(
    outline.buttonRingShadow,
    "持有物按钮本体不能再叠 Tailwind 矩形 ring",
  ).toBe("0 0 #0000");
  expect(outline.shellBoxShadow, "卡牌壳层内部不应额外叠阴影").toBe("none");
  expect(
    outline.modifierExists,
    "选中态不能再叠加内部改骰描边，避免左边和下边视觉加粗",
  ).toBe(false);
  expect(outline.selectedOutlineExists, "选中态需要一层独立外描边").toBe(true);
  expect(outline.selectedBorderTop).toBe("2px");
  expect(outline.selectedBorderRight).toBe("2px");
  expect(outline.selectedBorderBottom).toBe("2px");
  expect(outline.selectedBorderLeft).toBe("2px");
  expect(
    outline.selectedShape,
    "持有物卡牌选中态必须使用贴合卡牌本体的卡形外描边",
  ).toBe("card");
  expect(
    outline.selectedWidth ?? 0,
    "卡形外描边必须覆盖完整卡牌宽度",
  ).toBeGreaterThan(24);
  expect(
    outline.selectedHeight ?? 0,
    "卡形外描边必须覆盖完整卡牌高度",
  ).toBeGreaterThan(24);
  expect(
    outline.selectedBorderRadiusNumber ?? 0,
    "卡形外描边必须保留卡牌圆角，而不是骰子圆形圈",
  ).toBeGreaterThan(0);
  expect(outline.selectedInsetLeft, "选中外描边左侧外扩必须和右侧对称").toBe(
    outline.selectedInsetRight,
  );
  expect(outline.selectedInsetTop, "选中外描边上侧外扩必须和下侧对称").toBe(
    outline.selectedInsetBottom,
  );
};

const expectInventoryCandidateCardHasAtlas = async (
  card: Locator,
  testId: string,
) => {
  const metrics = await card.evaluate((node, currentTestId) => {
    const button = node as HTMLElement;
    const rect = button.getBoundingClientRect();
    const shell = button.querySelector(
      `[data-testid="${currentTestId}-shell"]`,
    ) as HTMLElement | null;
    const frontAtlas = button.querySelector(
      `[data-testid="${currentTestId}-front-atlas"]`,
    ) as HTMLImageElement | null;
    return {
      text: button.textContent?.replace(/\s+/g, " ").trim() ?? "",
      width: rect.width,
      height: rect.height,
      hasShell: Boolean(shell),
      frontAsset: frontAtlas?.getAttribute("data-asset-src") ?? "",
      frontLoaded: Boolean(
        frontAtlas?.complete &&
        frontAtlas.naturalWidth > 0 &&
        frontAtlas.naturalHeight > 0,
      ),
    };
  }, testId);

  expect(
    metrics.width,
    `${testId} 必须显示为卡牌本体，不能退成文字按钮`,
  ).toBeGreaterThanOrEqual(58);
  expect(
    metrics.height,
    `${testId} 必须保留卡牌热区高度`,
  ).toBeGreaterThanOrEqual(70);
  expect(metrics.hasShell, `${testId} 必须渲染持有物牌面壳层`).toBe(true);
  expect(metrics.frontAsset, `${testId} 必须挂载正式牌面 atlas`).toMatch(
    /(?:item|omen)-front-atlas/,
  );
  expect(metrics.frontLoaded, `${testId} 正式牌面必须真实加载完成`).toBe(true);
  expect(metrics.text, `${testId} 不应显示正面缺失回退文案`).not.toContain(
    "正面缺失",
  );
};

const expectTutorialNextDoesNotStealRollModifierFocus = async (
  page: Parameters<typeof test>[0]["page"],
) => {
  const geometry = await page.evaluate(() => {
    const button = document.querySelector(
      '[data-testid="tutorial-next-button"]',
    ) as HTMLElement | null;
    const dice = document.querySelector(
      '[data-testid="betrayal-rabbit-foot-dice"]',
    ) as HTMLElement | null;
    if (!button || !dice) {
      return {
        visible: false,
        verticalGap: Number.POSITIVE_INFINITY,
        buttonCenterX: 0,
        diceCenterX: 0,
      };
    }
    const buttonRect = button.getBoundingClientRect();
    const diceRect = dice.getBoundingClientRect();
    return {
      visible:
        buttonRect.width > 0 &&
        buttonRect.height > 0 &&
        window.getComputedStyle(button).visibility !== "hidden",
      verticalGap: buttonRect.top - diceRect.bottom,
      buttonCenterX: buttonRect.left + buttonRect.width / 2,
      diceCenterX: diceRect.left + diceRect.width / 2,
    };
  });
  if (!geometry.visible) return;
  expect(
    geometry.verticalGap,
    "选择重投骰子时，“下一步”不能贴着骰子选择控件抢主焦点",
  ).toBeGreaterThanOrEqual(18);
};

const expectTradeCandidateTrayAnchoredToFlow = async (
  page: Parameters<typeof test>[0]["page"],
  selectorTestId: string,
) => {
  const metrics = await page.evaluate((testId) => {
    const selector = document.querySelector(
      `[data-testid="${testId}"]`,
    ) as HTMLElement | null;
    const banner = document.querySelector(
      '[data-testid="betrayal-trade-flow-banner"]',
    ) as HTMLElement | null;
    if (!selector || !banner) return null;
    const selectorRect = selector.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    return {
      selectorTop: selectorRect.top,
      selectorBottom: selectorRect.bottom,
      selectorCenterX: selectorRect.left + selectorRect.width / 2,
      bannerBottom: bannerRect.bottom,
      bannerCenterX: bannerRect.left + bannerRect.width / 2,
      viewportHeight: window.innerHeight,
    };
  }, selectorTestId);

  expect(metrics, `${selectorTestId} 必须和顶部交易提示同时存在`).not.toBeNull();
  expect(
    metrics!.selectorTop,
    `${selectorTestId} 不能放到顶部角落或牌堆旁`,
  ).toBeGreaterThan(metrics!.viewportHeight * 0.52);
  expect(
    metrics!.selectorTop,
    `${selectorTestId} 必须和顶部交易提示分层，不能混进提示横幅`,
  ).toBeGreaterThan(metrics!.bannerBottom + 260);
  expect(
    Math.abs(metrics!.selectorCenterX - metrics!.bannerCenterX),
    `${selectorTestId} 必须和顶部交易提示保持同一视觉中轴`,
  ).toBeLessThanOrEqual(160);
};

const expectTradeConfirmAnchoredToFlow = async (
  page: Parameters<typeof test>[0]["page"],
) => {
  const metrics = await page.evaluate(() => {
    const confirm = document.querySelector(
      '[data-testid="betrayal-action-trade"]',
    ) as HTMLElement | null;
    const banner = document.querySelector(
      '[data-testid="betrayal-trade-flow-banner"]',
    ) as HTMLElement | null;
    const actionPanel = document.querySelector(
      '[data-testid="betrayal-trade-action-panel"]',
    ) as HTMLElement | null;
    if (!confirm || !banner || !actionPanel) return null;
    const confirmRect = confirm.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const actionPanelRect = actionPanel.getBoundingClientRect();
    return {
      count: document.querySelectorAll('[data-testid="betrayal-action-trade"]')
        .length,
      placement: confirm.getAttribute("data-trade-confirm-placement") ?? "",
      insideBanner: Boolean(
        confirm.closest('[data-testid="betrayal-trade-flow-banner"]'),
      ),
      insideActionPanel: Boolean(
        confirm.closest('[data-testid="betrayal-trade-action-panel"]'),
      ),
      actionPanelFor: actionPanel.getAttribute("data-prompt-actions-for") ?? "",
      confirmCenterY: confirmRect.top + confirmRect.height / 2,
      bannerBottom: bannerRect.bottom,
      actionPanelTop: actionPanelRect.top,
      actionPanelBottom: actionPanelRect.bottom,
    };
  });

  expect(metrics, "交易确认按钮必须存在").not.toBeNull();
  expect(
    metrics!.count,
    "交易确认只能有一个，不能顶部提示和底部动作区各放一个",
  ).toBe(1);
  expect(metrics!.placement, "交易确认必须声明在底部动作面板里").toBe(
    "bottom-action-panel",
  );
  expect(metrics!.insideBanner, "交易确认按钮不能再塞进顶部交易提示横幅").toBe(
    false,
  );
  expect(metrics!.insideActionPanel, "交易确认按钮必须留在底部交易动作面板里").toBe(
    true,
  );
  expect(metrics!.actionPanelFor, "底部交易动作面板必须关联顶部交易提示").toBe(
    "betrayal-trade-flow-banner",
  );
  expect(
    metrics!.confirmCenterY,
    "交易确认按钮必须落在底部动作面板高度范围内",
  ).toBeGreaterThanOrEqual(metrics!.actionPanelTop);
  expect(
    metrics!.confirmCenterY,
    "交易确认按钮必须落在底部动作面板高度范围内",
  ).toBeLessThanOrEqual(metrics!.actionPanelBottom);
  expect(metrics!.actionPanelTop, "底部动作面板必须和顶部提示分层").toBeGreaterThan(
    metrics!.bannerBottom + 260,
  );
};

const expectDiscoveryPanelDoesNotCoverRollModifier = async (
  discoveryReveal: Locator,
  modifierCard: Locator,
) => {
  await expect(modifierCard).toBeVisible();
  await expect(discoveryReveal).toHaveAttribute(
    "data-allows-inventory-roll-modifiers",
    "true",
  );
  const hitTarget = await modifierCard.evaluate((node) => {
    const card = node as HTMLElement;
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtCenter = document.elementFromPoint(
      centerX,
      centerY,
    ) as HTMLElement | null;
    const cardAtCenter = elementAtCenter?.closest(
      '[data-testid="betrayal-inventory-rope"]',
    );
    const discoveryAtCenter = elementAtCenter?.closest(
      '[data-testid="betrayal-discovery-panel"]',
    );
    return {
      cardWidth: rect.width,
      cardHeight: rect.height,
      cardHit: cardAtCenter === card,
      discoveryHit: Boolean(discoveryAtCenter),
      topTestId: elementAtCenter?.dataset.testid ?? null,
    };
  });
  expect(hitTarget.cardWidth).toBeGreaterThan(24);
  expect(hitTarget.cardHeight).toBeGreaterThan(24);
  expect(hitTarget.discoveryHit).toBe(false);
  expect(hitTarget.cardHit).toBe(true);
};

const expectInventoryPreviewCardReadable = async (previewOverlay: Locator) => {
  const readability = await previewOverlay
    .getByTestId("betrayal-inventory-preview-card-shell")
    .evaluate((node) => {
      const shell = node as HTMLElement;
      const shellStyle = window.getComputedStyle(shell);
      const button = shell.closest("button") as HTMLElement | null;
      const buttonStyle = button ? window.getComputedStyle(button) : null;
      const rect = shell.getBoundingClientRect();
      return {
        shellOpacity: Number(shellStyle.opacity),
        buttonOpacity: Number(buttonStyle?.opacity ?? "1"),
        shellFilter: shellStyle.filter,
        buttonFilter: buttonStyle?.filter ?? "none",
        width: rect.width,
        height: rect.height,
      };
    });
  expect(readability.width, "放大预览必须保留可读卡面宽度").toBeGreaterThan(
    220,
  );
  expect(readability.height, "放大预览必须保留可读卡面高度").toBeGreaterThan(
    300,
  );
  expect(
    readability.shellOpacity,
    "已使用卡牌的放大预览不得继承持有区灰化透明度",
  ).toBeGreaterThanOrEqual(0.99);
  expect(
    readability.buttonOpacity,
    "已使用卡牌的放大预览外层不得变灰",
  ).toBeGreaterThanOrEqual(0.99);
  expect(readability.shellFilter, "已使用卡牌的放大预览不得灰阶/模糊").toBe(
    "none",
  );
  expect(
    readability.buttonFilter,
    "已使用卡牌的放大预览外层不得灰阶/模糊",
  ).toBe("none");
};

const clickNext = async (page: Parameters<typeof test>[0]["page"]) => {
  const nextButton = page.getByTestId("tutorial-next-button");
  await expect(nextButton).toBeVisible({ timeout: 2000 });
  await nextButton.click({ timeout: 2000 });
};

const readTutorialRuntimeDiagnostics = async (
  page: Parameters<typeof test>[0]["page"],
) =>
  page.evaluate(() => {
    const harness = (
      window as unknown as {
        __BG_TEST_HARNESS__?: {
          state?: {
            get?: () => {
              sys?: {
                tutorial?: {
                  active?: boolean;
                  manifestId?: string | null;
                  stepIndex?: number;
                  step?: { id?: string; aiActions?: unknown[] };
                  aiActions?: unknown[];
                };
              };
              core?: {
                phase?: string;
                latestFeedback?: string;
                currentExplorer?: { inventory?: Array<{ id?: string; name?: string }> };
              };
            };
          };
        };
      }
    ).__BG_TEST_HARNESS__;
    const snapshot = harness?.state?.get?.();
    const tutorial = snapshot?.sys?.tutorial;
    const activeStep = document.querySelector("[data-tutorial-step]");
    const contextDiagnostics = (
      window as unknown as {
        __BG_TUTORIAL_CONTEXT_DIAGNOSTICS__?: unknown;
      }
    ).__BG_TUTORIAL_CONTEXT_DIAGNOSTICS__ ?? null;
    return {
      href: window.location.href,
      gameMode: (window as unknown as { __BG_GAME_MODE__?: unknown }).__BG_GAME_MODE__ ?? null,
      isSpectator: (window as unknown as { __BG_IS_SPECTATOR__?: unknown }).__BG_IS_SPECTATOR__ ?? null,
      contextDiagnostics,
      tutorialActive: tutorial?.active ?? null,
      manifestId: tutorial?.manifestId ?? null,
      stepIndex: tutorial?.stepIndex ?? null,
      stepId: tutorial?.step?.id ?? null,
      stepAiActionCount: tutorial?.step?.aiActions?.length ?? 0,
      aiActionCount: tutorial?.aiActions?.length ?? 0,
      activeStepDom: activeStep?.getAttribute("data-tutorial-step") ?? null,
      hasTutorialOverlayCard: Boolean(
        document.querySelector('[data-testid="tutorial-overlay-card"]'),
      ),
      hasTutorialNextButton: Boolean(
        document.querySelector('[data-testid="tutorial-next-button"]'),
      ),
      hasBetrayalBoard: Boolean(
        document.querySelector('[data-testid="betrayal-board"]'),
      ),
      phase: snapshot?.core?.phase ?? null,
      latestFeedback: snapshot?.core?.latestFeedback ?? null,
      inventory:
        snapshot?.core?.currentExplorer?.inventory?.map((item) => ({
          id: item.id,
          name: item.name,
        })) ?? null,
      bodyText: document.body.textContent?.replace(/\s+/g, " ").trim().slice(0, 800) ?? "",
    };
  });

const advanceToStep = async (
  page: Parameters<typeof test>[0]["page"],
  targetStepId: string,
  maxClicks = 12,
) => {
  const activeStep = page.locator("[data-tutorial-step]:visible").last();
  for (let index = 0; index < maxClicks; index += 1) {
    const targetStepVisible = await page
      .locator(`[data-tutorial-step="${targetStepId}"]`)
      .isVisible()
      .catch(() => false);
    if (targetStepVisible) {
      await waitForStep(page, targetStepId);
      return;
    }
    const currentStepId = await activeStep
      .getAttribute("data-tutorial-step")
      .catch(() => null);
    if (currentStepId === targetStepId) {
      await waitForStep(page, targetStepId);
      return;
    }
    try {
      await clickNext(page);
    } catch (error) {
      const diagnostics = await readTutorialRuntimeDiagnostics(page);
      throw new Error(
        `教程无法推进到 ${targetStepId}：下一步按钮不可见或不可点。\n诊断：${JSON.stringify(
          diagnostics,
          null,
          2,
        )}\n原始错误：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  try {
    await waitForStep(page, targetStepId);
  } catch (error) {
    const diagnostics = await readTutorialRuntimeDiagnostics(page);
    throw new Error(
      `教程无法推进到 ${targetStepId}：超过最大点击次数。\n诊断：${JSON.stringify(
        diagnostics,
        null,
        2,
      )}\n原始错误：${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

test.describe("山屋惊魂教程最小真实链路", () => {
  test("[mummy-banish] 教程驱逐木乃伊步骤必须点击房间本体进入驱逐结算", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-exorcise-room-direct-target",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial/haunt-actions-and-finish", {
      waitUntil: "domcontentloaded",
    });
    await waitForBetrayalPageReady(page);
    await waitForHauntRuntime(page, 30000);
    await advanceToStep(page, "haunt-actions");
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/驱逐木乃伊|Banish Mummy/i);
    const banishTarget = await resolveMummyBanishRoomTarget(page);
    await expect(
      page.getByTestId("betrayal-room-focus-target"),
    ).toHaveAttribute("data-role", "status");
    await expect(
      page.getByTestId(`betrayal-room-${banishTarget.roomId}`),
    ).toHaveAttribute("data-direct-target", "true");
    await expect(
      page.getByTestId(`betrayal-room-focus-card-highlight-${banishTarget.roomId}`),
    ).toHaveAttribute("data-highlight-shape", "room");
    await saveScreenshot(page, STEP_19);

    await clickNext(page);
    await waitForStep(page, "banish-mummy");
    const readyRollBackdrop = page.getByTestId("betrayal-roll-result-backdrop");
    if (await readyRollBackdrop.isVisible({ timeout: 800 }).catch(() => false)) {
      await expect(readyRollBackdrop).toHaveAttribute(
        "data-backdrop-dismiss",
        "enabled",
      );
      await readyRollBackdrop.click({ position: { x: 16, y: 16 } });
    }
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.2, 0.2, 0.2, 0.2, 0.2]);
    await page.getByTestId(`betrayal-room-${banishTarget.roomId}`).click();

    const exorciseRollReview = page.getByTestId(
      "betrayal-exorcise-roll-review",
    );
    await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
    await expect(
      exorciseRollReview.getByTestId("betrayal-recent-roll-panel"),
    ).toContainText("驱逐木乃伊");
    await expect(
      exorciseRollReview.getByTestId("betrayal-recent-roll-panel"),
    ).toContainText("神志对抗");
    await expect(
      exorciseRollReview.getByTestId("betrayal-recent-roll-total"),
    ).toContainText("总点数");
    await saveScreenshot(page, STEP_20);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-exorcise-room-direct-target", diagnostics },
    ]);
  });

  test("[tutorial-main] 教程路由会从真实运行时主入口开始，并复用真实终局", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(page, "betrayal-tutorial");

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial", {
      waitUntil: "domcontentloaded",
    });

    const basicTutorialEntry = page.getByTestId(
      "tutorial-catalog-entry-basic-setup-and-turn",
    );
    const omenConfirmationTutorialEntry = page.getByTestId(
      "tutorial-catalog-entry-omen-confirmation-and-haunt-risk",
    );
    const tradeTutorialEntry = page.getByTestId(
      "tutorial-catalog-entry-trade-and-agreement",
    );
    const hauntTutorialEntry = page.getByTestId(
      "tutorial-catalog-entry-haunt-actions-and-finish",
    );
    const traitorTutorialEntry = page.getByTestId(
      "tutorial-catalog-entry-traitor-path",
    );
    const mummyMonsterTutorialEntry = page.getByTestId(
      "tutorial-catalog-entry-mummy-monster-actions",
    );
    await expect(basicTutorialEntry).toBeVisible({ timeout: 30000 });
    await expect(omenConfirmationTutorialEntry).toBeVisible();
    await expect(tradeTutorialEntry).toBeVisible();
    await expect(hauntTutorialEntry).toBeVisible();
    await expect(traitorTutorialEntry).toBeVisible();
    await expect(mummyMonsterTutorialEntry).toBeVisible();
    for (const hiddenTutorialId of [
      "move-explore-use",
      "crimson-jack-objective",
      "hero-attack-path",
      "jack-spirit-path",
    ]) {
      await expect(
        page.getByTestId(`tutorial-catalog-entry-${hiddenTutorialId}`),
      ).toHaveCount(0);
    }
    await expect(page.getByText("教程目录")).toBeVisible();
    await saveScreenshot(page, STEP_00);
    await basicTutorialEntry.click();
    await waitForBetrayalPageReady(page);

    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await waitForStep(page, "objective-and-turn");
    await expect(
      page.locator('[data-tutorial-id="betrayal-actions-zone"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-action-move")).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "在你的回合中",
    );
    await saveScreenshot(page, STEP_01);

    await clickNext(page);
    await waitForStep(page, "traits-and-speed");
    await expect(
      page.locator('[data-testid="betrayal-current-traits"]'),
    ).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "速度",
    );

    await clickNext(page);
    await waitForStep(page, "trait-track-reading");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "绿色数字",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "骷髅",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "重复的数字仍分别占格",
    );
    await saveScreenshot(page, STEP_36);

    await clickNext(page);
    await waitForStep(page, "moves-remaining");
    await expect(
      page.locator('[data-tutorial-id="betrayal-moves-remaining"]'),
    ).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "本回合还剩的移动力",
    );
    await saveScreenshot(page, STEP_02);

    await clickNext(page);
    await waitForStep(page, "room-board");
    await expect(
      page.locator('[data-tutorial-id="betrayal-room-board"]'),
    ).toBeVisible();
    await saveScreenshot(page, STEP_03);

    await clickNext(page);
    await waitForStep(page, "observe-teammate");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "可观察该探险者",
    );
    await expect(
      page.locator('[data-tutorial-id="betrayal-bottom-teammate-1"]'),
    ).toBeVisible();
    await page.getByTestId("betrayal-bottom-teammate-1").click();
    await expect(page.getByTestId("betrayal-current-traits")).toHaveAttribute(
      "data-observed-player",
      "true",
    );
    await expect(page.getByTestId("betrayal-current-traits")).toHaveAttribute(
      "data-player-id",
      "1",
    );
    await saveScreenshot(page, STEP_37);

    await page.getByTestId("betrayal-bottom-teammate-2").click();
    await expect(page.getByTestId("betrayal-current-traits")).toHaveAttribute(
      "data-player-id",
      "2",
    );
    await saveScreenshot(page, STEP_37A);
    await page.getByTestId("betrayal-bottom-teammate-2").click();
    await expect(page.getByTestId("betrayal-current-traits")).toHaveAttribute(
      "data-observed-player",
      "true",
    );
    await expect(page.getByTestId("betrayal-current-traits")).toHaveAttribute(
      "data-player-id",
      "1",
    );
    await saveScreenshot(page, STEP_37B);

    await clickNext(page);
    await waitForStep(page, "focus-self-room");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "聚焦到我的房间",
    );
    await expect(
      page.locator('[data-tutorial-id="betrayal-focus-self-room"]'),
    ).toBeVisible();
    await page.getByTestId("betrayal-focus-self-room").click();
    await expect(page.getByTestId("betrayal-current-traits")).toHaveAttribute(
      "data-observed-player",
      "false",
    );
    await expect(page.getByTestId("betrayal-current-traits")).toHaveAttribute(
      "data-player-id",
      "0",
    );
    await saveScreenshot(page, STEP_38);

    await clickNext(page);
    await waitForStep(page, "haunt-risk-track");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "预兆进度条",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "抽到预兆",
    );
    await expect(
      page.locator('[data-tutorial-id="betrayal-haunt-risk-status"]'),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-haunt-risk-progress")).toHaveAttribute(
      "data-haunt-risk-style",
      "official-asset-track",
    );
    await expect(page.getByTestId("betrayal-haunt-risk-slot")).toHaveCount(10);
    await expect(
      page.locator('[data-haunt-risk-current-cell="true"]'),
    ).toHaveCount(1);
    await saveScreenshot(page, STEP_39);

    await clickNext(page);
    await waitForStep(page, "inventory-and-help");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "物品和预兆放在你面前",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "帮助入口",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "主界面",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "替代",
    );
    await expect(
      page.locator('[data-tutorial-id="betrayal-inventory-zone"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-tutorial-id="betrayal-reference-entry"]'),
    ).toBeVisible();
    await page.getByTestId("betrayal-open-reference").click();
    const preHauntReferenceImage = page.getByTestId(
      "betrayal-reference-card-image",
    );
    await expect(preHauntReferenceImage).toBeVisible();
    await expect(preHauntReferenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/player-reference-zh-front",
    );
    await expectImageLoaded(preHauntReferenceImage);
    await page.getByTestId("betrayal-reference-toggle").click();
    await expect(preHauntReferenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/player-reference-zh-back",
    );
    await expectImageLoaded(preHauntReferenceImage);
    await page.getByTestId("betrayal-reference-close").click();
    await expect(page.getByTestId("betrayal-reference-overlay")).toBeHidden();
    await saveScreenshot(page, STEP_04);

    await page.goto("/play/betrayal/tutorial/haunt-actions-and-finish", {
      waitUntil: "domcontentloaded",
    });
    await waitForBetrayalPageReady(page);
    await waitForHauntRuntime(page, 30000);
    await waitForStep(page, "help-entry");
    const autoScenarioReaderDialog = page.getByTestId(
      "betrayal-scenario-reader-dialog",
    );
    if (
      await autoScenarioReaderDialog
        .isVisible({ timeout: 800 })
        .catch(() => false)
    ) {
      await expect(autoScenarioReaderDialog).toContainText("木乃伊横行");
      await expect(autoScenarioReaderDialog).toContainText("英雄开场");
      await expect(autoScenarioReaderDialog).toContainText("英雄剧本书");
      await page.getByTestId("betrayal-scenario-reader-close").click();
      await expect(autoScenarioReaderDialog).toBeHidden();
    }
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "打开剧本书",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "目标与胜利条件",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "帮助入口",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "底部动作按钮",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "替代",
    );
    await expect(
      page.locator('[data-tutorial-id="betrayal-open-scenario"]'),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-monster-board-token-mummy"),
    ).toBeVisible();
    await saveScreenshot(page, STEP_17);
    await page.getByTestId("betrayal-open-scenario").click();
    const scenarioObjectivePage = page.getByTestId(
      "betrayal-scenario-objective-page",
    );
    await expect(scenarioObjectivePage).toBeVisible();
    await expect(scenarioObjectivePage).toContainText("木乃伊横行");
    await expect(scenarioObjectivePage).toContainText("英雄开场");
    await page.getByTestId("betrayal-scenario-reader-next-zone").click();
    await expect(
      page.getByTestId("betrayal-scenario-reader-header-progress"),
    ).toContainText("2/3");
    await expect(scenarioObjectivePage).toContainText("敌方情报 / 胜利条件");
    await expect(scenarioObjectivePage).toContainText("真名");
    await expect(scenarioObjectivePage).toContainText("驱逐法术");
    await expect(scenarioObjectivePage).toContainText("驱逐木乃伊");
    await expect(
      page.getByTestId("betrayal-scenario-book-turning-sheet"),
    ).toHaveCount(0);
    await saveScreenshot(page, STEP_18);
    await page.getByTestId("betrayal-scenario-reader-close").click();
    await expect(
      page.getByTestId("betrayal-scenario-reader-dialog"),
    ).toBeHidden();
    await page.getByTestId("betrayal-open-reference").click();
    const hauntReferenceImage = page.getByTestId(
      "betrayal-reference-card-image",
    );
    await expect(hauntReferenceImage).toBeVisible();
    await expect(hauntReferenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/player-reference-zh-front",
    );
    await expectImageLoaded(hauntReferenceImage);
    await page.getByTestId("betrayal-reference-toggle").click();
    await expect(hauntReferenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/player-reference-zh-back",
    );
    await expectImageLoaded(hauntReferenceImage);
    await page.getByTestId("betrayal-reference-toggle").click();
    await expect(hauntReferenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/traitor-reference-zh",
    );
    await expectImageLoaded(hauntReferenceImage);
    await page.getByTestId("betrayal-reference-toggle").click();
    await expect(hauntReferenceImage).toHaveAttribute(
      "data-asset-src",
      "betrayal/cards/monster-reference-zh",
    );
    await expectImageLoaded(hauntReferenceImage);
    await page.getByTestId("betrayal-reference-close").click();
    await expect(page.getByTestId("betrayal-reference-overlay")).toBeHidden();
    await clickNext(page);

    await waitForStep(page, "haunt-actions");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "6+ 知识考验",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "石棺房、研究室或图书馆",
    );
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/驱逐木乃伊|Banish Mummy/i);
    const banishTarget = await resolveMummyBanishRoomTarget(page);
    await expect(
      page.getByTestId(`betrayal-room-${banishTarget.roomId}`),
    ).toHaveAttribute("data-direct-target", "true");
    await expect(
      page.getByTestId(`betrayal-room-focus-card-highlight-${banishTarget.roomId}`),
    ).toHaveAttribute("data-highlight-shape", "room");
    await saveScreenshot(page, STEP_19);
    await clickNext(page);

    await waitForStep(page, "banish-mummy");
    await page.getByTestId(`betrayal-room-${banishTarget.roomId}`).click();

    const exorciseRollReview = page.getByTestId(
      "betrayal-exorcise-roll-review",
    );
    await expect(exorciseRollReview).toBeVisible({ timeout: 30000 });
    const exorciseRollPanel = exorciseRollReview.getByTestId(
      "betrayal-recent-roll-panel",
    );
    await expect(exorciseRollPanel).toBeVisible();
    await expect(exorciseRollPanel).toContainText("驱逐木乃伊");
    await expect(exorciseRollPanel).toContainText("神志对抗");
    await expect(
      exorciseRollReview.getByTestId("betrayal-recent-roll-total"),
    ).toContainText("总点数");
    await expect(page.getByTestId("betrayal-endgame-screen")).toBeHidden();
    await expectVisiblePhysicalDiceBox(exorciseRollPanel);
    await waitForPhysicalDiceSettled(exorciseRollPanel);
    await saveScreenshot(page, STEP_20);
    const exorciseRollBackdrop = page.getByTestId(
      "betrayal-roll-review-backdrop",
    );
    await expect(exorciseRollBackdrop).toHaveAttribute(
      "data-backdrop-dismiss",
      "enabled",
    );
    await exorciseRollBackdrop.click({ position: { x: 16, y: 16 } });

    await waitForStep(page, "endgame-review", 30000);
    const endgameScreen = page.getByTestId("betrayal-endgame-screen");
    await expect(endgameScreen).toBeVisible({ timeout: 30000 });
    await expect(endgameScreen).toContainText("木乃伊");
    await expect(endgameScreen).toContainText("烟消云散");
    await expect(exorciseRollReview).toBeHidden();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toBeHidden();
    await saveScreenshot(page, STEP_21);

    assertNoFatalFrontendErrors([{ label: "betrayal-tutorial", diagnostics }]);
  });

  test("[omen-confirm] 预兆教程会按规则解释作祟检定并保留一次确认", async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-omen-confirmation",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial/omen-confirmation-and-haunt-risk", {
      waitUntil: "domcontentloaded",
    });
    await waitForBetrayalPageReady(page);

    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await waitForStep(page, "confirm-omen-card");
    const discoveryContinue = page.getByTestId("betrayal-discovery-continue");
    const latestDiscovery = page.locator(
      '[data-tutorial-id="betrayal-latest-discovery"]',
    );
    await expect(latestDiscovery).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel-main")).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "所有玩家持有的预兆总数",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText("5+");
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "同一画面",
    );
    await expect(discoveryContinue).toHaveText(/^确认$/);
    await expect(discoveryContinue).toHaveAttribute(
      "data-pending-card-resolution-step",
      "1/1",
    );
    await saveScreenshot(page, STEP_40);

    await discoveryContinue.click();
    await waitForStep(page, "omen-confirmation-review", 30000);
    await expect(latestDiscovery).toBeHidden({
      timeout: 30000,
    });
    await expect(page.getByTestId("betrayal-inventory-row-omen")).toContainText(
      "狗",
    );
    await expect(page.getByTestId("betrayal-runtime-header-grid")).toContainText(
      /作祟前|Pre-Haunt/i,
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "你获得这张预兆",
    );
    await saveScreenshot(page, STEP_42);

    await clickNext(page);
    await waitForStep(page, "haunt-risk-track");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "高亮格表示已发现的预兆数",
    );
    await expect(
      page.locator('[data-tutorial-id="betrayal-haunt-risk-status"]'),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-haunt-risk-progress")).toHaveAttribute(
      "data-haunt-risk-style",
      "official-asset-track",
    );
    await expect(page.getByTestId("betrayal-haunt-risk-slot")).toHaveCount(10);
    await expect(
      page.locator('[data-haunt-risk-current-cell="true"]'),
    ).toHaveCount(1);
    await saveScreenshot(page, STEP_43);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-omen-confirmation", diagnostics },
    ]);
  });

  test("交易教程会选双方持有物、点同房间队友并等待接收方同意", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-trade-and-agreement",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial/trade-and-agreement", {
      waitUntil: "domcontentloaded",
    });
    await waitForBetrayalPageReady(page);

    await waitForStep(page, "setup-trade");
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "同一房间",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "双方都要同意",
    );
    await expect(page.getByTestId("betrayal-action-trade")).toContainText(
      "交易",
    );
    await expect(page.getByTestId("betrayal-trade-status")).toContainText(
      "同房间可交易对象：1人",
    );
    await saveScreenshot(page, STEP_29);

    await clickNext(page);
    await waitForStep(page, "choose-trade-item");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "兔脚",
    );
    await expect(page.getByTestId("betrayal-inventory-rope")).toBeVisible();
    await page.getByTestId("betrayal-inventory-rope").click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toContainText("兔脚");
    await expect(page.getByTestId("betrayal-inventory-rope")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await saveScreenshot(page, STEP_30);

    await clickNext(page);
    await waitForStep(page, "choose-trade-target");
    const teammateToken = page.getByTestId("betrayal-room-occupant-hallway-1");
    await expect(
      teammateToken,
      "交易教程必须能直接点击地图上的同房间队友 token",
    ).toBeVisible();
    await expect(teammateToken).toHaveAttribute("data-direct-target", "true");
    await page.getByTestId("betrayal-room-occupant-hallway-1").click();
    await expect(page.getByTestId("betrayal-trade-status")).toContainText(
      "可交易给",
    );
    await expect(
      page.getByTestId("betrayal-trade-return-selector"),
    ).toBeVisible();
    await expectTradeCandidateTrayAnchoredToFlow(
      page,
      "betrayal-trade-return-selector",
    );
    await expect(
      page.getByTestId("betrayal-trade-return-skip"),
      "空选择不是候选按钮；没点对方卡时摘要和提出交易按钮承接当前选择",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-trade-return-card-map"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-trade-return-card-skull"),
    ).toBeVisible();
    await expectInventoryCandidateCardHasAtlas(
      page.getByTestId("betrayal-trade-return-card-map"),
      "betrayal-trade-return-card-map",
    );
    await expectInventoryCandidateCardHasAtlas(
      page.getByTestId("betrayal-trade-return-card-skull"),
      "betrayal-trade-return-card-skull",
    );
    await expect(
      page.getByTestId("betrayal-trade-flow-item-step"),
      "未主动选择对方物品时，交易摘要只列己方给出物",
    ).toContainText(/你给出.*兔脚/);
    await expect(
      page.getByTestId("betrayal-trade-flow-target-step"),
    ).toContainText("提出交易");
    await expectTradeConfirmAnchoredToFlow(page);
    await saveScreenshot(page, STEP_31);

    await clickNext(page);
    await waitForStep(page, "choose-trade-return");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "对方持有物",
    );
    await page.getByTestId("betrayal-trade-return-card-map").click();
    await expect(
      page.getByTestId("betrayal-trade-flow-item-step"),
    ).toContainText(/你给出.*兔脚.*对方给出.*地图/);
    await expect(
      page.getByTestId("betrayal-trade-return-card-map-selected-outline"),
    ).toBeVisible();
    await saveScreenshot(page, STEP_32);

    await clickNext(page);
    await waitForStep(page, "send-trade-request");
    const tradeButton = page.getByTestId("betrayal-action-trade");
    await expect(tradeButton).toBeEnabled();
    await expectTradeConfirmAnchoredToFlow(page);
    await tradeButton.click();
    await waitForStep(page, "request-waiting", 30000);
    await waitForTradeAgreementState(page, "waiting");
    await expect(
      page.getByTestId("betrayal-trade-flow-target-step"),
    ).toContainText("等待");
    await expect(
      page.getByTestId("betrayal-trade-flow-item-step"),
    ).toContainText(/你给出.*兔脚.*对方给出.*地图/);
    await expect(
      page.getByTestId("betrayal-trade-agreement-panel"),
    ).toHaveCount(0);
    await saveScreenshot(page, STEP_33);

    await clickNext(page);
    await waitForStableIncomingTradeAgreement(page);
    await expect(
      page.getByTestId("betrayal-trade-flow-item-step"),
    ).toContainText(/给出.*兔脚.*你给出.*地图/);
    await saveScreenshot(page, STEP_34);

    await waitForStableIncomingTradeAgreement(page);
    await page.getByTestId("betrayal-trade-agreement-accept").click();
    await waitForStep(page, "trade-review", 30000);
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText(/同意交易|兔脚|地图/);
    await expect(
      page.getByTestId("betrayal-trade-agreement-panel"),
    ).toHaveCount(0);
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const state = (
              window as unknown as {
                __BG_TEST_HARNESS__?: {
                  state?: {
                    get?: () => {
                      core?: {
                        currentExplorer?: {
                          inventory?: Array<{ name: string }>;
                        };
                        otherExplorers?: Array<{
                          playerId: string;
                          inventory?: Array<{ name: string }>;
                        }>;
                        pendingTradeAgreement?: unknown | null;
                      };
                    };
                  };
                };
              }
            ).__BG_TEST_HARNESS__?.state?.get?.();
            const currentInventory =
              state?.core?.currentExplorer?.inventory?.map(
                (item) => item.name,
              ) ?? [];
            const teammateInventory =
              state?.core?.otherExplorers
                ?.find((explorer) => explorer.playerId === "1")
                ?.inventory?.map((item) => item.name) ?? [];
            return {
              currentHasRabbitFoot: currentInventory.includes("兔脚"),
              currentHasBook: currentInventory.includes("书本"),
              currentHasMap: currentInventory.includes("地图"),
              teammateHasMap: teammateInventory.includes("地图"),
              teammateHasSkull: teammateInventory.includes("头骨"),
              teammateHasRabbitFoot: teammateInventory.includes("兔脚"),
              pendingTradeAgreement: state?.core?.pendingTradeAgreement ?? null,
            };
          }),
        {
          message:
            "交易教程必须在接收方同意后双向转移：发起方得到地图，队友得到兔脚",
          timeout: 10000,
        },
      )
      .toMatchObject({
        currentHasRabbitFoot: false,
        currentHasBook: true,
        currentHasMap: true,
        teammateHasMap: false,
        teammateHasSkull: true,
        teammateHasRabbitFoot: true,
        pendingTradeAgreement: null,
      });
    await saveScreenshot(page, STEP_35);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-trade-and-agreement", diagnostics },
    ]);
  });

  test("移动探索教程会使用持有物、整张房间牌移动并探索出发现牌", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-move-explore-use",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    let releaseCriticalEventAtlas!: () => void;
    let criticalEventAtlasReleased = false;
    const criticalEventAtlasGate = new Promise<void>((resolve) => {
      releaseCriticalEventAtlas = () => {
        criticalEventAtlasReleased = true;
        resolve();
      };
    });
    let markCriticalEventAtlasRequested!: () => void;
    const criticalEventAtlasRequested = new Promise<void>((resolve) => {
      markCriticalEventAtlasRequested = resolve;
    });
    await page.route("**/*event-front-atlas*", async (route) => {
      markCriticalEventAtlasRequested();
      if (!criticalEventAtlasReleased) {
        await criticalEventAtlasGate;
      }
      await route.continue();
    });
    await page.goto("/play/betrayal/tutorial/basic-setup-and-turn", {
      waitUntil: "domcontentloaded",
    });
    await criticalEventAtlasRequested;
    await expect(page.getByTestId("loading-screen")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("betrayal-board")).not.toBeVisible();
    await saveScreenshot(page, TECHNICAL_ASSET_GATE_STEP);
    releaseCriticalEventAtlas();
    await waitForBetrayalPageReady(page);

    await waitForStep(page, "objective-and-turn", 15000);
    await expect(page.getByTestId("tutorial-overlay-card")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("tutorial-next-button")).toBeVisible({
      timeout: 15000,
    });

    await advanceToStep(page, "use-book");
    await waitForStep(page, "use-book");
    await expect(page.getByTestId("betrayal-action-use")).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "先选择持有区里的书本",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "再点“使用”",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "非战斗检定",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).not.toContainText(
      "放大镜",
    );
    await expect(
      page.getByTestId("betrayal-inventory-omen-book"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-inventory-omen-book-shell"),
    ).toHaveAttribute("data-tutorial-target-outline", "true");
    await expect(page.getByTestId("tutorial-highlight-ring")).toHaveAttribute(
      "data-tutorial-highlight-target",
      "betrayal-inventory-omen-book",
    );
    await expect(page.getByTestId("tutorial-highlight-ring")).toHaveAttribute(
      "data-tutorial-highlight-shape",
      "rect",
    );
    await expect(
      page.getByTestId("betrayal-inventory-omen-book-magnify"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-inventory-preview-overlay"),
    ).not.toBeVisible();
    await saveScreenshot(page, STEP_05);

    await page.getByTestId("betrayal-inventory-omen-book").click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toContainText("书本");
    await expect(page.getByTestId("betrayal-action-use")).toBeEnabled();
    await expect(
      page.getByTestId("betrayal-inventory-omen-book"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByTestId("betrayal-inventory-omen-book-selected-outline"),
    ).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "再点“使用”",
    );
    await saveScreenshot(page, STEP_06);
    await page.getByTestId("betrayal-action-use").click();
    await waitForStep(page, "open-move-targets");
    await expect(page.getByTestId("betrayal-action-move")).toBeVisible();
    await page.getByTestId("betrayal-inventory-omen-book-magnify").click();
    const usedBookPreview = page.getByTestId(
      "betrayal-inventory-preview-overlay",
    );
    await expect(usedBookPreview).toBeVisible();
    await expect(
      usedBookPreview.getByTestId("betrayal-inventory-preview-card-shell"),
    ).toBeVisible();
    await expectInventoryPreviewCardReadable(usedBookPreview);
    await saveScreenshot(page, STEP_07);
    await usedBookPreview.click({ position: { x: 8, y: 8 } });
    await expect(
      page.getByTestId("betrayal-inventory-preview-overlay"),
    ).not.toBeVisible();
    await page.getByTestId("betrayal-action-move").click();
    await waitForStep(page, "move-to-hallway");
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await expect(
      page.getByTestId("betrayal-inventory-preview-overlay"),
    ).not.toBeVisible();
    await saveScreenshot(page, STEP_08);
    await saveScreenshot(page, STEP_09);
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-latest-feedback"),
    ).toContainText("移动到门厅");
    await saveScreenshot(page, STEP_10);
    await waitForStep(page, "explore-upper");
    await expect(page.getByTestId("betrayal-action-explore")).toBeVisible();
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "先选出口",
    );
    await page.getByTestId("betrayal-action-explore").click();
    const exploreTargetMarker = page
      .locator('[data-testid^="betrayal-room-explore-target-"]')
      .first();
    await expect(exploreTargetMarker).toBeVisible({ timeout: 10000 });
    const targetRoomTestId = await exploreTargetMarker.evaluate((node) =>
      node
        .getAttribute("data-testid")
        ?.replace("betrayal-room-explore-target-", "betrayal-room-"),
    );
    expect(targetRoomTestId).toBeTruthy();
    const exploreTargetRoom = page.getByTestId(targetRoomTestId!);
    await expect(exploreTargetRoom).toBeVisible();
    await expect(
      page.getByTestId(
        `betrayal-room-explore-card-highlight-${targetRoomTestId!.replace("betrayal-room-", "")}`,
      ),
    ).toBeVisible();
    await saveScreenshot(page, STEP_11);
    await exploreTargetRoom.click();
    const roomPlacementPanel = page.getByTestId("betrayal-room-placement-panel");
    await expect(roomPlacementPanel).toBeVisible({ timeout: 10000 });
    await waitForStep(page, "confirm-room-placement");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "确认放置",
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "抽发现牌",
    );
    const roomPlacementConfirm = page.getByTestId("betrayal-room-placement-confirm");
    await expect(roomPlacementConfirm).toBeVisible();
    const roomTileAdjustmentOption = page
      .getByTestId("betrayal-room-tile-adjustment-option")
      .first();
    if (await roomTileAdjustmentOption.isVisible().catch(() => false)) {
      await roomTileAdjustmentOption.click();
    }
    await expect(roomPlacementConfirm).toBeEnabled();
    await saveScreenshot(page, STEP_11A);
    await roomPlacementConfirm.click();
    await waitForStep(page, "finish", 30000);
    const latestDiscovery = page.locator(
      '[data-tutorial-id="betrayal-latest-discovery"]',
    );
    await expect(latestDiscovery).toBeVisible({ timeout: 30000 });
    const tutorialOverlayCard = page.getByTestId("tutorial-overlay-card");
    await expect(tutorialOverlayCard).toHaveAttribute(
      "data-tutorial-placement",
      "center",
    );
    await expect(tutorialOverlayCard).not.toContainText(
      "使用持有物 -> 移动 -> 探索 -> 抽发现牌",
    );
    await expect(tutorialOverlayCard).toContainText("兔脚");
    await expect(tutorialOverlayCard).toContainText("重投一颗骰子");
    await expect(tutorialOverlayCard).toContainText("不想改时继续结算");
    const discoveryReveal = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryReveal).toBeVisible();
    await expect(discoveryReveal).toHaveAttribute(
      "data-allows-inventory-roll-modifiers",
      "true",
    );
    const rabbitFootCard = page.getByTestId("betrayal-inventory-rope");
    await expect(rabbitFootCard).toBeVisible();
    await expect(rabbitFootCard).toHaveAttribute(
      "data-roll-modifier-available",
      "true",
    );
    const rollModifierHighlight = page.getByTestId(
      "betrayal-inventory-rope-roll-modifier",
    );
    await expect(rollModifierHighlight).toBeVisible();
    await expect(rollModifierHighlight).toBeEmpty();
    await expectDiscoveryPanelDoesNotCoverRollModifier(
      discoveryReveal,
      rabbitFootCard,
    );
    const discoveryRollPanel = discoveryReveal.getByTestId(
      "betrayal-recent-roll-panel",
    );
    await expect(discoveryRollPanel).toBeVisible();
    await expect(discoveryRollPanel).not.toContainText("外星几何");
    await expect(discoveryRollPanel).not.toContainText("知识检定");
    await expect(
      discoveryReveal.getByTestId("betrayal-recent-roll-total"),
    ).toContainText("总点数");
    await expect(
      discoveryRollPanel.getByTestId("betrayal-recent-roll-breakdown"),
    ).toContainText("骰面合计");
    await expect(
      discoveryRollPanel.getByTestId("betrayal-recent-roll-breakdown"),
    ).toContainText("加值");
    await expect(discoveryRollPanel).toHaveAttribute(
      "data-roll-panel-style",
      "open-table-transparent",
    );
    await expectVisiblePhysicalDiceBox(discoveryRollPanel);
    await waitForPhysicalDiceSettled(discoveryRollPanel);
    const rollPanelLayout = await discoveryRollPanel.evaluate((node) => {
      const panel = node as HTMLElement;
      const dice = panel.querySelector(
        '[data-testid="betrayal-house-dice-3d-group"]',
      ) as HTMLElement | null;
      const canvas =
        Array.from(dice?.querySelectorAll("canvas") ?? [])
          .filter(
            (candidate): candidate is HTMLCanvasElement =>
              candidate instanceof HTMLCanvasElement,
          )
          .sort((left, right) => {
            const leftRect = left.getBoundingClientRect();
            const rightRect = right.getBoundingClientRect();
            return (
              rightRect.width * rightRect.height -
              leftRect.width * leftRect.height
            );
          })[0] ?? null;
      const total = panel.querySelector(
        '[data-testid="betrayal-recent-roll-total"]',
      ) as HTMLElement | null;
      const panelRect = panel.getBoundingClientRect();
      const diceRect = dice?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();
      const totalRect = total?.getBoundingClientRect();
      return {
        panelHeight: panelRect.height,
        panelBackground: window.getComputedStyle(panel).backgroundColor,
        diceWidth: diceRect?.width ?? 0,
        diceHeight: diceRect?.height ?? 0,
        canvasWidth: canvasRect?.width ?? 0,
        canvasHeight: canvasRect?.height ?? 0,
        totalTop: totalRect ? totalRect.top - panelRect.top : 0,
        staticDiceImages: panel.querySelectorAll(
          '[data-testid^="betrayal-recent-roll-die-"] img',
        ).length,
      };
    });
    expect(
      rollPanelLayout.diceHeight / rollPanelLayout.panelHeight,
    ).toBeGreaterThan(0.54);
    expect(
      rollPanelLayout.totalTop / rollPanelLayout.panelHeight,
    ).toBeGreaterThan(0.58);
    expect(rollPanelLayout.panelBackground).toBe("rgba(0, 0, 0, 0)");
    expect(rollPanelLayout.diceWidth).toBeGreaterThanOrEqual(600);
    expect(rollPanelLayout.canvasWidth).toBeGreaterThanOrEqual(300);
    expect(rollPanelLayout.canvasHeight).toBeGreaterThanOrEqual(210);
    expect(rollPanelLayout.staticDiceImages).toBe(0);
    const discoveryGeometry = await discoveryReveal.evaluate((node) => {
      const panel = node as HTMLElement;
      const rect = panel.getBoundingClientRect();
      const content = panel.querySelector(
        '[data-testid="betrayal-discovery-panel-content"]',
      ) as HTMLElement | null;
      const contentRect = content?.getBoundingClientRect();
      const rollPanel = panel.querySelector(
        '[data-testid="betrayal-recent-roll-panel"]',
      ) as HTMLElement | null;
      const rollPanelRect = rollPanel?.getBoundingClientRect();
      const rightPanelRects = Array.from(
        document.querySelectorAll(
          '[data-testid="betrayal-status-rail"], [data-testid="betrayal-player-panel"], [data-testid="betrayal-deck-status"]',
        ),
      )
        .map((candidate) => (candidate as HTMLElement).getBoundingClientRect())
        .filter((candidate) => candidate.width > 0 && candidate.height > 0);
      const leftPanelRects = Array.from(
        document.querySelectorAll(
          '[data-testid="betrayal-left-status-rail"], [data-testid="betrayal-inventory-section"]',
        ),
      )
        .map((candidate) => (candidate as HTMLElement).getBoundingClientRect())
        .filter((candidate) => candidate.width > 0 && candidate.height > 0);
      return {
        panelCenterX: rect.left + rect.width / 2,
        panelCenterY: rect.top + rect.height / 2,
        contentCenterX: contentRect
          ? contentRect.left + contentRect.width / 2
          : 0,
        contentCenterY: contentRect
          ? contentRect.top + contentRect.height / 2
          : 0,
        contentLeft: contentRect?.left ?? 0,
        contentRight: contentRect?.right ?? 0,
        rollPanelRight: rollPanelRect?.right ?? 0,
        rightPanelLeft: rightPanelRects.reduce(
          (minLeft, candidate) => Math.min(minLeft, candidate.left),
          rect.right,
        ),
        leftPanelRight: leftPanelRects.reduce(
          (maxRight, candidate) => Math.max(maxRight, candidate.right),
          0,
        ),
        viewportCenterX: window.innerWidth / 2,
        viewportCenterY: window.innerHeight / 2,
        width: rect.width,
        height: rect.height,
        contentWidth: contentRect?.width ?? 0,
        contentHeight: contentRect?.height ?? 0,
      };
    });
    const tableAreaCenterX =
      (discoveryGeometry.leftPanelRight + discoveryGeometry.rightPanelLeft) / 2;
    expect(
      Math.abs(discoveryGeometry.contentCenterX - tableAreaCenterX),
      `发现牌结果组必须居中在主牌桌可用区域内：${JSON.stringify(discoveryGeometry)}`,
    ).toBeLessThanOrEqual(24);
    expect(discoveryGeometry.contentLeft).toBeGreaterThanOrEqual(
      discoveryGeometry.leftPanelRight + 12,
    );
    expect(discoveryGeometry.rollPanelRight).toBeLessThanOrEqual(
      discoveryGeometry.rightPanelLeft - 12,
    );
    expect(
      Math.abs(
        discoveryGeometry.panelCenterY - discoveryGeometry.viewportCenterY,
      ),
    ).toBeLessThanOrEqual(48);
    expect(discoveryGeometry.width).toBeGreaterThan(900);
    expect(discoveryGeometry.height).toBeGreaterThan(320);
    expect(discoveryGeometry.contentWidth).toBeGreaterThanOrEqual(900);
    expect(discoveryGeometry.contentHeight).toBeGreaterThan(320);
    const discoveryFrontAtlas = discoveryReveal.getByTestId(
      "betrayal-discovery-card-front-atlas",
    );
    await expect(discoveryFrontAtlas).toBeVisible();
    await expect(discoveryFrontAtlas).toHaveAttribute(
      "data-asset-src",
      /betrayal\/cards\/(event-front-atlas|item-front-atlas|omen-front-atlas)/,
    );
    await expect(discoveryFrontAtlas).toHaveAttribute(
      "data-atlas-frame-index",
      "24",
    );
    await expect(discoveryFrontAtlas).toHaveAttribute(
      "aria-label",
      /外星几何|事件|物品|预兆/,
    );
    await expect
      .poll(async () =>
        discoveryFrontAtlas.evaluate((node) => {
          const image = node.querySelector("img");
          return (
            Boolean(image) &&
            image!.complete &&
            image!.naturalWidth > 0 &&
            image!.naturalHeight > 0
          );
        }),
      )
      .toBe(true);
    await saveScreenshot(page, STEP_12);
    await rabbitFootCard.click();
    const rabbitFootDice = page.getByTestId("betrayal-rabbit-foot-dice");
    await expect(rabbitFootDice).toBeVisible();
    await expect(rabbitFootDice).toHaveAttribute(
      "data-reroll-target-count",
      /^[1-9]\d*$/,
    );
    await expect(page.getByTestId("betrayal-rabbit-foot-die-1")).toHaveCount(0);
    const rerollTargetDie = page.getByTestId(
      "betrayal-house-dice-reroll-target-1",
    );
    await expect(rerollTargetDie).toBeVisible();
    await expect(rerollTargetDie).toHaveAttribute("role", "button");
    await expect(rerollTargetDie).toHaveAttribute(
      "data-reroll-target-shape",
      "circle",
    );
    const rerollTargetBox = await rerollTargetDie.boundingBox();
    expect(
      Math.round(rerollTargetBox?.width ?? 0),
      "选骰命中区必须是正圆，不是横竖不等的矩形",
    ).toBe(Math.round(rerollTargetBox?.height ?? 0));
    const rerollTargetRotateZ = Number(
      await rerollTargetDie.getAttribute("data-reroll-target-rotate-z"),
    );
    expect(
      Number.isFinite(rerollTargetRotateZ),
      "选骰框必须记录物理骰当前旋转角",
    ).toBe(true);
    expect(
      Math.abs(rerollTargetRotateZ),
      "选骰框必须跟随被选骰子的旋转，而不是固定正矩形",
    ).toBeGreaterThan(0.05);
    await expect
      .poll(async () =>
        rerollTargetDie.evaluate(
          (node) => getComputedStyle(node as HTMLElement).transform,
        ),
      )
      .not.toBe("none");
    await expect(rabbitFootCard).toHaveAttribute("aria-pressed", "true");
    await expectInventoryCardHasSingleSymmetricOutline(rabbitFootCard);
    await expect(
      discoveryRollPanel.getByTestId("betrayal-recent-roll-total"),
    ).toContainText("总点数");
    await expect(discoveryRollPanel.getByTestId("betrayal-recent-roll-stage-surface")).toHaveCount(0);
    await expect(discoveryRollPanel.getByTestId("betrayal-recent-roll-breakdown")).toContainText("骰面合计");
    await expect(discoveryRollPanel.getByTestId("betrayal-recent-roll-breakdown")).toContainText("加值");
    await expectTutorialNextDoesNotStealRollModifierFocus(page);
    await saveScreenshot(page, STEP_13);
    await saveScreenshot(page, STEP_14);
    await setHarnessRandomQueue(page, [0.99]);
    await rerollTargetDie.click();
    await expect(rabbitFootDice).toBeHidden();
    const rerolledDicePhysicsSource = discoveryRollPanel.getByTestId(
      "betrayal-house-dice-physics-source",
    );
    await expect(
      rerolledDicePhysicsSource,
    ).toHaveAttribute("data-dice-physics-source", "dice-box-threejs");
    await waitForPhysicalDiceSettled(discoveryRollPanel);
    await expect(
      discoveryRollPanel.getByTestId("betrayal-recent-roll-total"),
    ).toContainText("总点数");
    await expect(
      discoveryRollPanel.getByTestId("betrayal-recent-roll-breakdown"),
    ).toContainText("骰面合计");
    await expect(
      discoveryRollPanel.getByTestId("betrayal-recent-roll-breakdown"),
    ).toContainText("加值");
    await saveScreenshot(page, STEP_15);
    await clickNext(page);
    await expect(page.locator("[data-tutorial-step]")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(exploreTargetRoom).toBeVisible();
    await expect(
      page.locator('[data-testid^="betrayal-room-explore-target-"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-discovery-panel")).toBeVisible();
    await expect(
      page.getByTestId("betrayal-discovery-card-front-atlas"),
    ).toBeVisible();
    await saveScreenshot(page, STEP_16);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-move-explore-use", diagnostics },
    ]);
  });

  test("手机横屏下教程真实入口应使用地图壳原生横屏布局", async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-phone-landscape",
    );

    await page.setViewportSize(MOBILE_LANDSCAPE_REFERENCE_VIEWPORT);
    await page.goto(
      "/play/betrayal/tutorial/basic-setup-and-turn?bgForceCoarsePointer=1",
      { waitUntil: "domcontentloaded" },
    );
    await waitForBetrayalPageReady(page);

    await expect(page.getByTestId("mobile-orientation-game-gate")).toHaveCount(
      0,
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-game-id",
      "betrayal",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-preferred-orientation",
      "landscape",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-mobile-layout-preset",
      "map-shell",
    );
    await expect(
      page.getByTestId("mobile-orientation-game-banner"),
    ).toHaveCount(0);
    await advanceToStep(page, "use-book");
    await waitForStep(page, "use-book");
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(
      page.getByTestId("betrayal-mobile-landscape-layout"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-mobile-landscape-layout"),
    ).toHaveAttribute("data-layout-mode", "phone-landscape-native");
    await expect(page.getByTestId("betrayal-desktop-layout")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-mobile-stage-status")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-mobile-traits-strip")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-mobile-context-strip")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-room-grid")).toBeVisible();
    await expect(page.getByTestId("betrayal-left-status-rail")).toBeHidden();
    await expect(page.getByTestId("betrayal-status-rail")).toBeHidden();
    await expect(page.getByTestId("betrayal-action-rail")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-mobile-action-rail")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-panel")).toHaveAttribute(
      "data-mobile-role",
      "primary-board-stage",
    );
    await expect(
      page.getByTestId("betrayal-inventory-section"),
    ).toHaveAttribute("data-mobile-role", "possession-rail");
    await expect(
      page.getByTestId("betrayal-mobile-action-rail"),
    ).toHaveAttribute("data-mobile-role", "native-action-rail");
    await expect(
      page.getByTestId("betrayal-inventory-omen-book"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-mobile-dock-move")).toBeVisible();

    const mobileLayout = await page.evaluate(() => {
      const pcActionButton = document.querySelector<HTMLElement>(
        'button[data-testid^="betrayal-action-"]',
      );
      const board = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-board"]',
      );
      const layout = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-mobile-landscape-layout"]',
      );
      const shell = document.querySelector<HTMLElement>(".mobile-board-shell");
      const roomGrid = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-grid"]',
      );
      const roomPanel = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-panel"]',
      );
      const inventoryRail = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-inventory-section"]',
      );
      const actionRail = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-mobile-action-rail"]',
      );
      const desktopActionButtons = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button[data-testid^="betrayal-action-"]',
        ),
      );
      const mobileDockButtons = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-testid^="betrayal-mobile-dock-"]',
        ),
      );
      const roomCanvas = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-canvas"]',
      );
      const leftRail = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-left-status-rail"]',
      );
      const statusRail = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-status-rail"]',
      );
      const tutorialCard = document.querySelector<HTMLElement>(
        '[data-testid="tutorial-overlay-card"]',
      );
      const boardRect = board?.getBoundingClientRect();
      const shellRect = shell?.getBoundingClientRect();
      const roomGridRect = roomGrid?.getBoundingClientRect();
      const inventoryRailRect = inventoryRail?.getBoundingClientRect();
      const actionRailRect = actionRail?.getBoundingClientRect();
      const leftRailRect = leftRail?.getBoundingClientRect();
      const statusRailRect = statusRail?.getBoundingClientRect();
      const tutorialRect = tutorialCard?.getBoundingClientRect();
      const visibleElementCount = (elements: HTMLElement[]) =>
        elements.filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || "1") > 0.01
          );
        }).length;
      const isVisible = (element: HTMLElement | null) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0.01
        );
      };

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        layoutMode: layout?.dataset.layoutMode ?? null,
        roomPanelRole: roomPanel?.dataset.mobileRole ?? null,
        inventoryRole: inventoryRail?.dataset.mobileRole ?? null,
        actionRole: actionRail?.dataset.mobileRole ?? null,
        shellTransform: shell ? getComputedStyle(shell).transform : null,
        shellLeft: shellRect?.left ?? null,
        shellRight: shellRect?.right ?? null,
        shellWidth: shellRect?.width ?? 0,
        shellHeight: shellRect?.height ?? 0,
        boardWidth: boardRect?.width ?? 0,
        boardHeight: boardRect?.height ?? 0,
        roomGridWidth: roomGridRect?.width ?? 0,
        roomGridHeight: roomGridRect?.height ?? 0,
        roomCanvasTransform: roomCanvas
          ? getComputedStyle(roomCanvas).transform
          : null,
        inventoryRailBottomGap: inventoryRailRect
          ? window.innerHeight - inventoryRailRect.bottom
          : null,
        inventoryRailLeft: inventoryRailRect?.left ?? null,
        actionRailBottomGap: actionRailRect
          ? window.innerHeight - actionRailRect.bottom
          : null,
        actionRailLeft: actionRailRect?.left ?? null,
        actionRailWidth: actionRailRect?.width ?? 0,
        visibleDesktopActionCount: visibleElementCount(desktopActionButtons),
        visibleMobileDockCount: visibleElementCount(mobileDockButtons),
        firstDesktopActionVisible: isVisible(pcActionButton),
        roomPanelBottomPadding: roomPanel
          ? Number.parseFloat(getComputedStyle(roomPanel).paddingBottom || "0")
          : 0,
        leftRailDisplay: leftRail ? getComputedStyle(leftRail).display : null,
        statusRailDisplay: statusRail
          ? getComputedStyle(statusRail).display
          : null,
        leftRailWidth: leftRailRect?.width ?? 0,
        statusRailWidth: statusRailRect?.width ?? 0,
        tutorialCenterOffset: tutorialRect
          ? Math.abs(
              tutorialRect.left +
                tutorialRect.width / 2 -
                window.innerWidth / 2,
            )
          : null,
      };
    });

    expect(mobileLayout.viewportWidth).toBeGreaterThan(
      mobileLayout.viewportHeight,
    );
    expect(mobileLayout.layoutMode).toBe("phone-landscape-native");
    expect(mobileLayout.roomPanelRole).toBe("primary-board-stage");
    expect(mobileLayout.inventoryRole).toBe("possession-rail");
    expect(mobileLayout.actionRole).toBe("native-action-rail");
    expect(mobileLayout.shellTransform).toBe("none");
    expect(mobileLayout.shellLeft ?? 999).toBeGreaterThanOrEqual(-1);
    expect(mobileLayout.shellRight ?? -999).toBeLessThanOrEqual(
      mobileLayout.viewportWidth + 1,
    );
    expect(mobileLayout.shellWidth).toBeGreaterThanOrEqual(
      mobileLayout.viewportWidth - 2,
    );
    expect(mobileLayout.shellHeight).toBeGreaterThanOrEqual(
      mobileLayout.viewportHeight - 2,
    );
    expect(mobileLayout.boardWidth).toBeGreaterThanOrEqual(
      mobileLayout.viewportWidth - 2,
    );
    expect(mobileLayout.boardHeight).toBeGreaterThanOrEqual(
      mobileLayout.viewportHeight - 2,
    );
    expect(mobileLayout.roomGridWidth).toBeGreaterThan(
      mobileLayout.viewportWidth * 0.75,
    );
    expect(mobileLayout.roomGridHeight).toBeGreaterThan(300);
    expect(mobileLayout.roomPanelBottomPadding).toBe(0);
    expect(mobileLayout.inventoryRailBottomGap).not.toBeNull();
    expect(mobileLayout.inventoryRailBottomGap ?? 999).toBeLessThanOrEqual(64);
    expect(mobileLayout.inventoryRailLeft ?? 999).toBeLessThanOrEqual(12);
    expect(mobileLayout.actionRailBottomGap ?? 999).toBeLessThanOrEqual(4);
    expect(mobileLayout.actionRailLeft ?? 999).toBeGreaterThanOrEqual(-1);
    expect(mobileLayout.actionRailWidth).toBeGreaterThanOrEqual(
      mobileLayout.viewportWidth - 16,
    );
    expect(mobileLayout.visibleDesktopActionCount).toBe(0);
    expect(mobileLayout.visibleMobileDockCount).toBeGreaterThan(0);
    expect(mobileLayout.firstDesktopActionVisible).toBe(false);
    expect(mobileLayout.roomCanvasTransform).not.toBe("none");
    expect(mobileLayout.leftRailDisplay).toBe("none");
    expect(mobileLayout.statusRailDisplay).toBe("none");
    expect(mobileLayout.tutorialCenterOffset).not.toBeNull();
    expect(mobileLayout.tutorialCenterOffset ?? 999).toBeLessThanOrEqual(96);

    await saveScreenshot(page, MOBILE_STEP_01);
    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-phone-landscape", diagnostics },
    ]);
  });

  test("PC 教程布局不应被手机横屏分支改写", async ({ page, context }) => {
    test.setTimeout(90000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-pc-layout-regression",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/play/betrayal/tutorial/basic-setup-and-turn", {
      waitUntil: "domcontentloaded",
    });
    await waitForBetrayalPageReady(page);

    await advanceToStep(page, "use-book");
    await waitForStep(page, "use-book");
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-desktop-layout")).toBeVisible();
    await expect(page.getByTestId("betrayal-desktop-layout")).toHaveAttribute(
      "data-layout-mode",
      "desktop-board",
    );
    await expect(
      page.getByTestId("betrayal-mobile-landscape-layout"),
    ).toHaveCount(0);
    await expect(page.getByTestId("betrayal-mobile-stage-status")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-mobile-context-strip")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-mobile-traits-strip")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-left-status-rail")).toBeVisible();
    await expect(page.getByTestId("betrayal-status-rail")).toBeVisible();
    await expect(page.getByTestId("betrayal-room-panel")).not.toHaveAttribute(
      "data-mobile-role",
      /primary-board-stage/,
    );
    await expect(
      page.getByTestId("betrayal-inventory-section"),
    ).not.toHaveAttribute("data-mobile-role", /possession-rail/);

    const pcLayout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          display: style.display,
          left: Math.round(box.left),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      };

      const roomCanvas = document.querySelector<HTMLElement>(
        '[data-testid="betrayal-room-canvas"]',
      );
      const roomCanvasScale = (() => {
        if (!roomCanvas) return null;
        const transform = window.getComputedStyle(roomCanvas).transform;
        if (!transform || transform === "none") return { scaleX: 1, scaleY: 1 };
        const match = transform.match(/^matrix\(([^)]+)\)$/);
        if (!match) return null;
        const parts = match[1].split(",").map((part) => Number(part.trim()));
        return { scaleX: parts[0], scaleY: parts[3] };
      })();

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        leftRail: rect('[data-testid="betrayal-left-status-rail"]'),
        rightRail: rect('[data-testid="betrayal-status-rail"]'),
        phaseChip: rect('[data-testid="betrayal-phase-chip"]'),
        inventory: rect('[data-testid="betrayal-inventory-section"]'),
        mobileActionRail: rect('[data-testid="betrayal-mobile-action-rail"]'),
        mobileStage: rect('[data-testid="betrayal-mobile-stage-status"]'),
        roomCanvasScale,
      };
    });

    expect(pcLayout.viewport).toEqual({ width: 1600, height: 900 });
    expect(pcLayout.leftRail?.display).toBe("grid");
    expect(pcLayout.rightRail?.display).toBe("flex");
    expect(pcLayout.phaseChip?.display).toBe("flex");
    expect(pcLayout.phaseChip).not.toBeNull();
    if (pcLayout.phaseChip) {
      const phaseChipCenter =
        pcLayout.phaseChip.left + pcLayout.phaseChip.width / 2;
      expect(
        Math.abs(phaseChipCenter - pcLayout.viewport.width / 2),
      ).toBeLessThanOrEqual(2);
    }
    expect(pcLayout.leftRail?.width).toBeGreaterThan(250);
    expect(pcLayout.rightRail?.width).toBeGreaterThan(190);
    expect(pcLayout.inventory?.left).toBeLessThanOrEqual(12);
    expect(pcLayout.inventory?.width).toBeGreaterThan(330);
    expect(pcLayout.roomCanvasScale?.scaleX).toBeCloseTo(1, 3);
    expect(pcLayout.roomCanvasScale?.scaleY).toBeCloseTo(1, 3);
    expect(
      pcLayout.mobileActionRail === null ||
        (pcLayout.mobileActionRail.width === 0 &&
          pcLayout.mobileActionRail.height === 0),
    ).toBe(true);
    expect(pcLayout.mobileStage).toBeNull();

    await saveScreenshot(page, PC_REGRESSION_STEP_USE_BOOK);

    await page.getByTestId("betrayal-inventory-omen-book").click();
    await expect(
      page.getByTestId("betrayal-selected-inventory-card-name"),
    ).toContainText("书本");
    await expect(page.getByTestId("betrayal-action-use")).toBeEnabled();
    await page.getByTestId("betrayal-action-use").click();
    await waitForStep(page, "open-move-targets");
    await expect(page.getByTestId("betrayal-action-move")).toBeVisible();
    await page.getByTestId("betrayal-action-move").click();
    await waitForStep(page, "move-to-hallway");
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await saveScreenshot(page, PC_REGRESSION_STEP_BOARD);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-pc-layout-regression", diagnostics },
    ]);
  });

  test("[mummy-traitor-path] 叛徒教程会打开叛徒剧本并完成女孩与圣符胜利链", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-traitor-path",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial/traitor-path", {
      waitUntil: "domcontentloaded",
    });

    await waitForBetrayalPageReady(page);
    await waitForHauntRuntime(page, 30000);
    await waitForStep(page, "traitor-objective");
    const traitorTarget = await resolveMummyTraitorTutorialTarget(page);
    const girlToken = page.getByTestId(traitorTarget.girlTokenTestId);
    const sarcophagusToken = page.getByTestId(
      traitorTarget.sarcophagusTokenTestId,
    );
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "女孩、圣符或指环、石棺",
    );
    await expect(girlToken).toHaveAttribute("data-token-status", "placed");
    await expect(sarcophagusToken).toContainText("棺");
    await page.getByTestId("betrayal-open-scenario").click();
    const traitorScenarioPage = page.getByTestId(
      "betrayal-scenario-objective-page",
    );
    await expect(traitorScenarioPage).toBeVisible();
    await expect(traitorScenarioPage).toHaveAttribute(
      "data-scenario-reader-scope",
      "traitor",
    );
    await expect(traitorScenarioPage).toContainText("叛徒剧本书");
    await expect(traitorScenarioPage).toContainText("女孩");
    await expect(traitorScenarioPage).toContainText("圣符");
    await expect(traitorScenarioPage).toContainText("指环");
    await expect(traitorScenarioPage).toContainText("石棺");
    await saveScreenshot(page, STEP_44);
    await page.getByTestId("betrayal-scenario-reader-close").click();
    await expect(
      page.getByTestId("betrayal-scenario-reader-dialog"),
    ).toBeHidden();

    await waitForStep(page, "pick-up-girl");
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/拾起女孩|Pick Up Girl/i);
    await expect(
      page.getByTestId(`betrayal-room-${traitorTarget.roomId}`),
    ).toHaveAttribute("data-direct-target", "true");
    await saveScreenshot(page, STEP_45);
    await page.getByTestId("betrayal-action-use").click();

    await waitForStep(page, "give-girl-to-mummy");
    await expect(girlToken).toHaveAttribute("data-token-status", "held-by-player");
    await expect(girlToken).toHaveAttribute(
      "data-token-owner-player-id",
      traitorTarget.traitorId,
    );
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/交出女孩|Give Girl/i);
    await saveScreenshot(page, STEP_46);
    await page.getByTestId("betrayal-action-use").click();

    await waitForStep(page, "give-omen-to-mummy");
    await expect(girlToken).toHaveAttribute("data-token-status", "held-by-mummy");
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/交出圣符|Give Holy Symbol/i);
    await expect(
      page.getByTestId("betrayal-inventory-section"),
    ).toContainText("圣符");
    await saveScreenshot(page, STEP_47);
    await page.getByTestId("betrayal-action-use").click();

    await waitForStep(page, "traitor-finish", 30000);
    const traitorEndgameScreen = page.getByTestId("betrayal-endgame-screen");
    await expect(traitorEndgameScreen).toBeVisible({ timeout: 30000 });
    await expect(traitorEndgameScreen).toContainText("木乃伊");
    await expect(traitorEndgameScreen).toContainText("小女孩");
    await expect(
      traitorEndgameScreen.getByTestId("betrayal-endgame-ending-narration"),
    ).toContainText("木乃伊怀中的小女孩");
    await saveScreenshot(page, STEP_48);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = (
            window as unknown as {
              __BG_TEST_HARNESS__?: {
                state?: {
                  get?: () => {
                    core?: {
                      phase?: string;
                      endgameResult?: { outcome?: string } | null;
                      currentExplorer?: {
                        inventory?: Array<{ id: string }>;
                      };
                      scenarioRuntime?: {
                        mummy?: {
                          girlHeldByMummy?: boolean;
                          mummyCarriedOmenIds?: string[];
                        };
                      };
                    };
                  };
                };
              };
            }
          ).__BG_TEST_HARNESS__?.state?.get?.();
          const core = state?.core;
          return {
            phase: core?.phase,
            outcome: core?.endgameResult?.outcome,
            girlHeldByMummy: core?.scenarioRuntime?.mummy?.girlHeldByMummy,
            mummyCarriedOmenIds:
              core?.scenarioRuntime?.mummy?.mummyCarriedOmenIds ?? [],
            currentInventory:
              core?.currentExplorer?.inventory?.map((card) => card.id) ?? [],
          };
        }),
      )
      .toMatchObject({
        phase: "endgame",
        outcome: "traitor",
        girlHeldByMummy: true,
        mummyCarriedOmenIds: expect.arrayContaining(["holy-symbol"]),
        currentInventory: expect.not.arrayContaining(["holy-symbol"]),
      });

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-traitor-path", diagnostics },
    ]);
  });

  test("[mummy-monster-actions] 教程会完成木乃伊怪物移动、同房攻击和偷取奖励", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-mummy-monster-actions",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial/mummy-monster-actions", {
      waitUntil: "domcontentloaded",
    });

    await waitForBetrayalPageReady(page);
    await waitForHauntRuntime(page, 30000);
    await waitForStep(page, "setup-mummy-monster-move");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "怪物回合",
    );
    await clickNext(page);

    await waitForStep(page, "mummy-monster-turn-start");
    const moveTarget = await resolveMummyMonsterMoveTutorialTarget(page);
    await switchRoomMapToFloor(page, moveTarget.mummyRoomFloor);
    await expect(
      page.getByTestId("betrayal-action-monsterTurnStart"),
    ).toContainText("木乃伊开回合");
    await expect(
      page.getByTestId(`betrayal-room-monster-${moveTarget.mummyRoomId}-mummy`),
    ).toBeVisible();
    await saveScreenshot(page, STEP_49);

    await page.getByTestId("betrayal-action-monsterTurnStart").click();
    await waitForStep(page, "mummy-monster-roll");
    await expect(
      page.getByTestId("betrayal-action-monsterMovementRoll"),
    ).toContainText("木乃伊移动骰");
    await page.getByTestId("betrayal-action-monsterMovementRoll").click();
    const movementRollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(movementRollPanel).toBeVisible();
    await expect(movementRollPanel).toContainText("木乃伊移动");
    await waitForPhysicalDiceSettled(movementRollPanel);
    await expect(movementRollPanel).toContainText("可移动 0 间");
    await saveScreenshot(page, STEP_50);

    await page.getByTestId("betrayal-roll-continue").click();
    await waitForStep(page, "mummy-monster-move-target");
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await page.getByTestId("betrayal-action-monsterMove").click();
    const mummyMoveToken = page.getByTestId(`betrayal-room-monster-${moveTarget.mummyRoomId}-mummy`);
    await expect(mummyMoveToken).toHaveAttribute("data-direct-target", "true");
    await mummyMoveToken.click();
    if (moveTarget.unrevealedRoomId) {
      await expect(
        page.getByTestId(`betrayal-room-monster-move-target-${moveTarget.unrevealedRoomId}`),
      ).toHaveCount(0);
    }
    await switchRoomMapToFloor(page, moveTarget.girlRoomFloor);
    await expect(
      page.getByTestId(`betrayal-room-monster-move-target-${moveTarget.girlRoomId}`),
    ).toBeVisible();
    await saveScreenshot(page, STEP_51);

    await page.getByTestId(`betrayal-room-${moveTarget.girlRoomId}`).click();
    await waitForStep(page, "mummy-monster-move-result");
    await expect(page.getByTestId("betrayal-room-latest-feedback")).toContainText(
      new RegExp(`木乃伊.*${moveTarget.girlRoomName}`),
    );
    await expect(
      page.getByTestId(`betrayal-room-monster-${moveTarget.girlRoomId}-mummy`),
    ).toBeVisible();
    await expect(page.getByTestId(moveTarget.girlTokenTestId)).toHaveAttribute(
      "data-token-status",
      "held-by-mummy",
    );
    await saveScreenshot(page, STEP_52);
    await clickNext(page);

    await waitForStep(page, "setup-mummy-attack");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "同房攻击",
    );
    await clickNext(page);

    await waitForStep(page, "mummy-attack-forced");
    const attackTarget = await resolveMummyMonsterAttackTutorialTarget(page);
    await switchRoomMapToFloor(page, attackTarget.mummyRoomFloor);
    await expect(page.getByTestId("betrayal-action-monsterMove")).toHaveCount(0);
    const monsterAttackAction = page.getByTestId("betrayal-action-monsterAttack");
    await expect(monsterAttackAction).toContainText("木乃伊攻击");
    await expect(
      page.getByTestId(`betrayal-room-monster-${attackTarget.mummyRoomId}-mummy`),
    ).toBeVisible();
    await expect(
      page.getByTestId(`betrayal-room-occupant-${attackTarget.mummyRoomId}-${attackTarget.heroTargetId}`),
    ).toBeVisible();
    await saveScreenshot(page, STEP_53);
    await clickNext(page);

    await waitForStep(page, "mummy-attack-target");
    await monsterAttackAction.click();
    await expect(monsterAttackAction).toContainText("取消攻击");
    const mummyAttackToken = page.getByTestId(`betrayal-room-monster-${attackTarget.mummyRoomId}-mummy`);
    const heroToken = page.getByTestId(
      `betrayal-room-occupant-${attackTarget.mummyRoomId}-${attackTarget.heroTargetId}`,
    );
    await expect(mummyAttackToken).toHaveAttribute("data-direct-target", "true");
    await mummyAttackToken.click();
    await expect(heroToken).toHaveAttribute("data-direct-target", "true");
    await expect(
      page.getByTestId(`betrayal-room-occupant-${attackTarget.mummyRoomId}-${attackTarget.traitorId}`),
    ).not.toHaveAttribute("data-direct-target", "true");
    if (attackTarget.deadHeroId) {
      await expect(
        page.getByTestId(`betrayal-room-occupant-${attackTarget.mummyRoomId}-${attackTarget.deadHeroId}`),
      ).not.toHaveAttribute("data-direct-target", "true");
    }
    await saveScreenshot(page, STEP_54);

    await heroToken.click();
    const attackRollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(attackRollPanel).toBeVisible();
    await expect(attackRollPanel).toContainText("木乃伊攻击");
    await expect(attackRollPanel).toContainText("攻击投骰");
    await waitForPhysicalDiceSettled(attackRollPanel);
    await expect(attackRollPanel).toContainText("伤害或偷取");
    await saveScreenshot(page, STEP_55);

    await page.getByTestId("betrayal-roll-continue").click();
    await waitForStep(page, "mummy-attack-reward");
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-mummy-reward-banner")).toContainText(
      "木乃伊：伤害或偷取",
    );
    await expect(page.getByTestId("betrayal-mummy-reward-steal-map")).toContainText(
      "偷走地图",
    );
    await saveScreenshot(page, STEP_56);

    await page.getByTestId("betrayal-mummy-reward-steal-map").click();
    await waitForStep(page, "mummy-steal-result");
    await expect(page.getByTestId("betrayal-mummy-reward-banner")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-room-latest-feedback")).toContainText("夺走地图");
    await expect.poll(() =>
      page.evaluate((heroTargetId) => {
        const state = (
          window as unknown as {
            __BG_TEST_HARNESS__?: {
              state?: {
                get?: () => {
                  core?: {
                    currentExplorer?: { playerId: string; inventory?: Array<{ id: string }> };
                    otherExplorers?: Array<{ playerId: string; inventory?: Array<{ id: string }> }>;
                    scenarioRuntime?: {
                      mummy?: {
                        pendingAttackReward?: unknown;
                        mummyCarriedCards?: Array<{ id: string }>;
                      };
                    };
                  };
                };
              };
            };
          }
        ).__BG_TEST_HARNESS__?.state?.get?.();
        const core = state?.core;
        const hero = [core?.currentExplorer, ...(core?.otherExplorers ?? [])]
          .find((explorer) => explorer?.playerId === heroTargetId);
        return {
          heroHasMap: hero?.inventory?.some((card) => card.id === "map") ?? true,
          rewardPending: Boolean(core?.scenarioRuntime?.mummy?.pendingAttackReward),
          mummyCarriedCardIds: core?.scenarioRuntime?.mummy?.mummyCarriedCards?.map((card) => card.id) ?? [],
        };
      }, attackTarget.heroTargetId)
    ).toMatchObject({
      heroHasMap: false,
      rewardPending: false,
      mummyCarriedCardIds: expect.arrayContaining(["map"]),
    });
    await saveScreenshot(page, STEP_57);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-mummy-monster-actions", diagnostics },
    ]);
  });

  test.skip("英雄攻击教程会打开剧本并进入真实攻击骰盘", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-hero-attack-path",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial/hero-attack-path", {
      waitUntil: "domcontentloaded",
    });

    await waitForBetrayalPageReady(page);
    await waitForHauntRuntime(page, 30000);

    await waitForStep(page, "hero-attack-objective");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "打开剧本",
    );
    await page.getByTestId("betrayal-open-scenario").click();
    const heroAttackScenarioPage = page.getByTestId(
      "betrayal-scenario-objective-page",
    );
    await expect(heroAttackScenarioPage).toBeVisible();
    await expect(heroAttackScenarioPage).toContainText("英雄手册");
    await expect(heroAttackScenarioPage).toContainText("攻击叛徒");
    await page.getByTestId("betrayal-scenario-reader-close").click();
    await expect(
      page.getByTestId("betrayal-scenario-reader-dialog"),
    ).toBeHidden();

    await waitForStep(page, "attack-traitor");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "攻击叛徒",
    );
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/攻击|Attack/i);
    const attackTraitorTargetInfo = await resolveCurrentRoomExplorerTarget(
      page,
      "attack-traitor",
    );
    await page.getByTestId("betrayal-action-use").click();
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toHaveAttribute("data-haunt-targeting-status", "true");
    const attackTraitorTarget = page.getByTestId(
      `betrayal-room-occupant-${attackTraitorTargetInfo.roomId}-${attackTraitorTargetInfo.playerId}`,
    );
    const attackTraitorTargetOutline = page.getByTestId(
      `betrayal-room-occupant-target-outline-${attackTraitorTargetInfo.roomId}-${attackTraitorTargetInfo.playerId}`,
    );
    await expect(
      attackTraitorTarget,
      "英雄攻击教程主路径必须点击地图上的叛徒 token 本体",
    ).toBeVisible();
    await expect(
      attackTraitorTarget,
      "教程叛徒 token 必须标记为直选目标",
    ).toHaveAttribute("data-direct-target", "true");
    await expect(
      attackTraitorTargetOutline,
      "教程叛徒 token 必须有贴合本体的五边形高亮",
    ).toHaveAttribute("data-highlight-shape", "pentagon");
    await saveScreenshot(page, STEP_22);
    await setHarnessRandomQueue(
      page,
      [0.99, 0.99, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
    );
    await attackTraitorTarget.click();

    await waitForStep(page, "hero-attack-review", 30000);
    const heroAttackReview = page.getByTestId("betrayal-attack-roll-review");
    await expect(heroAttackReview).toBeVisible({ timeout: 30000 });
    const heroAttackRollPanel = heroAttackReview.getByTestId(
      "betrayal-recent-roll-panel",
    );
    await expect(heroAttackRollPanel).toBeVisible({ timeout: 30000 });
    await expect(heroAttackRollPanel).toContainText(/攻击|叛徒|杰克之灵/);
    await expect(heroAttackRollPanel).toContainText(/总点数|Total/i);
    await expect(heroAttackRollPanel).toHaveAttribute(
      "data-roll-panel-style",
      "open-table-transparent",
    );
    await expectVisiblePhysicalDiceBox(heroAttackRollPanel);
    await waitForPhysicalDiceSettled(heroAttackRollPanel);
    await saveScreenshot(page, STEP_23);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-hero-attack-path", diagnostics },
    ]);
  });

  test.skip("杰克之灵教程会打开剧本并用同一攻击骰盘结算怪物攻击", async ({
    page,
    context,
  }) => {
    test.setTimeout(120000);
    await initBetrayalContext(context, { skipTutorial: false });
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-tutorial-jack-spirit-path",
    );

    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal/tutorial/jack-spirit-path", {
      waitUntil: "domcontentloaded",
    });

    await waitForBetrayalPageReady(page);
    await waitForHauntRuntime(page, 30000);

    await waitForStep(page, "jack-spirit-objective");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "杰克之灵的目标",
    );
    await page.getByTestId("betrayal-open-scenario").click();
    const jackSpiritScenarioPage = page.getByTestId(
      "betrayal-scenario-objective-page",
    );
    await expect(jackSpiritScenarioPage).toBeVisible();
    await expect(jackSpiritScenarioPage).toContainText("杰克之灵");
    await expect(jackSpiritScenarioPage).toContainText(/尸体.*房间/);
    await saveScreenshot(page, STEP_26);
    await page.getByTestId("betrayal-scenario-reader-close").click();
    await expect(
      page.getByTestId("betrayal-scenario-reader-dialog"),
    ).toBeHidden();

    await waitForStep(page, "jack-spirit-attack");
    await expect(page.getByTestId("tutorial-overlay-card")).toContainText(
      "怪物攻击",
    );
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toContainText(/攻击英雄|Attack hero/i);
    const jackSpiritAttackTargetInfo = await resolveCurrentRoomExplorerTarget(
      page,
      "attack-hero",
    );
    const jackSpiritAttackTarget = page.getByTestId(
      `betrayal-room-occupant-${jackSpiritAttackTargetInfo.roomId}-${jackSpiritAttackTargetInfo.playerId}`,
    );
    const jackSpiritAttackTargetOutline = page.getByTestId(
      `betrayal-room-occupant-target-outline-${jackSpiritAttackTargetInfo.roomId}-${jackSpiritAttackTargetInfo.playerId}`,
    );
    await expect(
      page.locator('[data-haunt-target-hitbox="true"]'),
      "点怪物攻击入口前，教程不得把唯一英雄目标自动变成攻击热区",
    ).toHaveCount(0);
    await page.getByTestId("betrayal-action-use").click();
    await expect(
      page.getByTestId("betrayal-action-use"),
    ).toHaveAttribute("data-haunt-targeting-status", "true");
    await expect(
      jackSpiritAttackTarget,
      "杰克之灵教程攻击主路径必须点击地图上的英雄 token 本体",
    ).toBeVisible();
    await expect(
      jackSpiritAttackTarget,
      "教程英雄 token 必须标记为直选目标",
    ).toHaveAttribute("data-direct-target", "true");
    await expect(
      jackSpiritAttackTargetOutline,
      "教程英雄 token 必须有贴合本体的五边形高亮",
    ).toHaveAttribute("data-highlight-shape", "pentagon");
    await saveScreenshot(page, STEP_27);
    await setHarnessRandomQueue(
      page,
      [0.99, 0.99, 0.99, 0.99, 0.01, 0.01, 0.01, 0.01],
    );
    await jackSpiritAttackTarget.click();

    await waitForStep(page, "jack-spirit-review", 30000);
    const jackSpiritAttackReview = page.getByTestId(
      "betrayal-attack-roll-review",
    );
    await expect(jackSpiritAttackReview).toBeVisible({ timeout: 30000 });
    const jackSpiritRollPanel = jackSpiritAttackReview.getByTestId(
      "betrayal-recent-roll-panel",
    );
    await expect(jackSpiritRollPanel).toBeVisible();
    await expect(jackSpiritRollPanel).toContainText(/攻击|杰克之灵|英雄/);
    await expect(jackSpiritRollPanel).toHaveAttribute(
      "data-roll-panel-style",
      "open-table-transparent",
    );
    const jackSpiritDiceGroup = jackSpiritRollPanel.getByTestId(
      "betrayal-house-dice-3d-group",
    );
    await expect(jackSpiritDiceGroup).toBeVisible();
    await expect(jackSpiritDiceGroup).toHaveAttribute(
      "data-render-mode",
      "betrayal-house-dice-box-visible",
    );
    await expect(jackSpiritDiceGroup).toHaveAttribute(
      "data-dice-tray-style",
      "transparent-virtual",
    );
    await expect(jackSpiritDiceGroup).toHaveAttribute(
      "data-dice-count",
      /[1-9]/,
    );
    await expect(
      jackSpiritRollPanel.getByTestId("betrayal-recent-roll-total"),
    ).toContainText(/总点数|Total/i);
    await saveScreenshot(page, STEP_28);

    assertNoFatalFrontendErrors([
      { label: "betrayal-tutorial-jack-spirit-path", diagnostics },
    ]);
  });
});
