import { expect, test, type Page } from "@playwright/test";
import {
  assertNoFatalFrontendErrors,
  attachPageDiagnostics,
} from "../helpers/common";
import {
  BETRAYAL_COMMANDS,
  type BetrayalCore,
  type BetrayalTraitKey,
  type BetrayalUseEffectSeed,
} from "../../src/games/betrayal/game";
import { BETRAYAL_DISCOVERY_POOLS } from "../../src/games/betrayal/scenarioConfig";
import {
  applyBetrayalCommand,
  createBetrayalScriptedRandom,
} from "../../src/games/betrayal/testing/firstScenarioTestUtils";
import {
  createRuntimeCore,
  initBetrayalContext,
  injectCore,
  saveScreenshot,
  setHarnessRandomQueue,
  expectVisiblePhysicalDiceBox,
  expectPhysicalDiceSeparated,
  waitForPhysicalDiceSettled,
  waitForBetrayalPageReady,
  warmBetrayalFrontend,
} from "./betrayalTestHelpers";

const EVIDENCE_DIR = "evidence/山屋惊魂-事件牌页面承接E2E";
const ARMOR_EVIDENCE_DIR = "evidence/山屋惊魂-盔甲物理减伤完整链路";
const RADIO_EVIDENCE_DIR = "evidence/山屋惊魂-头戴耳机精神减伤完整链路";
const FLASHLIGHT_EVIDENCE_DIR =
  "evidence/山屋惊魂-手电筒事件检定加骰完整链路";
const LANTERN_EVIDENCE_DIR =
  "evidence/山屋惊魂-灯笼事件检定加骰完整链路";

type EventChoiceCase = {
  title: string;
  screenshotSlug: string;
  buildCore: () => BetrayalCore;
  actions: string[];
  expectedTexts: string[];
  expectedVisibleTestIds?: string[];
  expectedRecentRollBeforeChoice?: string[];
  expectNoRecentRollBeforeChoice?: boolean;
  expectedRecentRollAfterChoice?: string[];
  actionRandomQueue?: number[];
};

type BetrayalStateReaderWindow = Window & {
  __BG_TEST_HARNESS__?: {
    state?: {
      get?: () => { core: BetrayalCore };
    };
  };
};

function eventByName(name: string) {
  const event = BETRAYAL_DISCOVERY_POOLS.events.find(
    (candidate) => candidate.name === name,
  );
  if (!event) {
    throw new Error(`未找到山屋事件：${name}`);
  }
  return event;
}

function branchEffect(eventName: string, min: number): BetrayalUseEffectSeed {
  const event = eventByName(eventName);
  const branch = event.roll?.branches.find(
    (candidate) => candidate.min === min,
  );
  if (!branch) {
    throw new Error(`未找到山屋事件分支：${eventName} min=${min}`);
  }
  return branch.effect;
}

function allPassEffect(eventName: string): BetrayalUseEffectSeed {
  const event = eventByName(eventName);
  if (event.effect?.mode !== "allTraitChecks") {
    throw new Error(`山屋事件不是四属性检定：${eventName}`);
  }
  return event.effect.allPassEffect;
}

function createPendingChoiceCore(
  sourceTitle: string,
  effect: BetrayalUseEffectSeed,
  options: {
    id: string;
    acceptLabel?: string;
    declineLabel?: string;
    roomId?: string;
    traits?: Partial<Record<BetrayalTraitKey, number>>;
    possessionItems?: { id: string; name: string; kind: "item" }[];
  },
) {
  const core = createRuntimeCore();
  core.currentExplorer = {
    ...core.currentExplorer,
    roomId: options.roomId ?? core.currentExplorer.roomId,
    traits: {
      ...core.currentExplorer.traits,
      ...options.traits,
    },
    inventory: [],
  };
  core.activeRoomId = core.currentExplorer.roomId;
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [];
  if (options.possessionItems) {
    core.possessionOrderByKind.item = [...options.possessionItems];
  }
  core.pendingEventChoice = {
    id: options.id,
    playerId: "0",
    sourceTitle,
    acceptLabel: options.acceptLabel,
    declineLabel: options.declineLabel,
    effect,
  };
  return core;
}

function createExploredEventChoiceCore(
  eventName: string,
  options?: {
    traits?: Partial<Record<BetrayalTraitKey, number>>;
    rollDice?: number[];
  },
) {
  const event = eventByName(eventName);
  let core = createRuntimeCore();
  core.drawOrder = ["event"];
  core.eventOrder = [event];
  core.currentExplorer = {
    ...core.currentExplorer,
    traits: {
      ...core.currentExplorer.traits,
      ...options?.traits,
    },
    inventory: [],
  };
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [];
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, "0", {
    roomId: "hallway",
  });
  core = options?.rollDice
    ? applyBetrayalCommand(
        core,
        BETRAYAL_COMMANDS.EXPLORE_ROOM,
        "0",
        { roomId: "ground-north" },
        100,
        createBetrayalScriptedRandom(...options.rollDice),
      )
    : applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, "0", {
        roomId: "ground-north",
      });
  if (core.pendingEventChoice?.sourceTitle !== eventName) {
    throw new Error(`未能生成事件待选态：${eventName}`);
  }
  return core;
}

function eventEffect(eventName: string): BetrayalUseEffectSeed {
  const effect = eventByName(eventName).effect;
  if (!effect) {
    throw new Error(`山屋事件没有直接效果：${eventName}`);
  }
  return effect;
}

async function readCurrentCore(page: Page): Promise<BetrayalCore> {
  return page.evaluate(() => {
    const snapshot = (
      window as BetrayalStateReaderWindow
    ).__BG_TEST_HARNESS__?.state?.get?.();
    if (!snapshot) {
      throw new Error("山屋 E2E 无法读取当前核心状态");
    }
    return snapshot.core;
  });
}

function physicalTraitTotal(core: BetrayalCore, playerId: string): number {
  const explorer = [core.currentExplorer, ...core.otherExplorers].find(
    (candidate) => candidate.playerId === playerId,
  );
  if (!explorer) {
    throw new Error(`山屋 E2E 无法找到玩家 ${playerId} 的探险者`);
  }
  return explorer.traits.might + explorer.traits.speed;
}

function mentalTraitTotal(core: BetrayalCore, playerId: string): number {
  const explorer = [core.currentExplorer, ...core.otherExplorers].find(
    (candidate) => candidate.playerId === playerId,
  );
  if (!explorer) {
    throw new Error(`山屋 E2E 无法找到玩家 ${playerId} 的探险者`);
  }
  return explorer.traits.knowledge + explorer.traits.sanity;
}

async function dismissDiscoveryPanel(page: Page) {
  const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
  const blankPoint = await discoveryPanel.evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const content = panel.querySelector(
      '[data-testid="betrayal-discovery-panel-content"]',
    );
    const contentRect = content?.getBoundingClientRect();
    const candidates = [
      { x: panelRect.left + 16, y: panelRect.top + 16 },
      { x: panelRect.right - 16, y: panelRect.top + 16 },
      { x: panelRect.left + 16, y: panelRect.bottom - 16 },
      { x: panelRect.right - 16, y: panelRect.bottom - 16 },
    ];
    const outsideContent = candidates.find(
      (point) =>
        !contentRect ||
        point.x < contentRect.left ||
        point.x > contentRect.right ||
        point.y < contentRect.top ||
        point.y > contentRect.bottom,
    );
    return outsideContent ?? { x: panelRect.left + 8, y: panelRect.top + 8 };
  });
  await page.mouse.click(blankPoint.x, blankPoint.y);
  await expect(discoveryPanel).toBeHidden();
}

type DirectRollEventFullChainCase = {
  title: string;
  eventName: string;
  screenshotSlug: string;
  traits?: Partial<Record<BetrayalTraitKey, number>>;
  randomQueue: number[];
  expectedRollTexts: string[];
  expectedDiscoveryRollTexts?: string[];
  expectedDetailTexts: string[];
  expectedDiceCount: string;
  expectedSubtotal: string;
  setupCore?: (core: BetrayalCore) => void;
  assertClosed?: (page: Page) => Promise<void>;
};

async function runDirectRollEventFullChain(
  page: Page,
  eventCase: DirectRollEventFullChainCase,
) {
  test.setTimeout(120000);
  const diagnostics = attachPageDiagnostics(
    page,
    `betrayal-event-choice-${eventCase.screenshotSlug}`,
  );
  const screenshotBase = `${EVIDENCE_DIR}/${eventCase.screenshotSlug}`;
  const eventCard = eventByName(eventCase.eventName);
  const core = createRuntimeCore();
  core.drawOrder = ["event"];
  core.eventOrder = [eventCard];
  core.currentExplorer = {
    ...core.currentExplorer,
    traits: {
      ...core.currentExplorer.traits,
      ...eventCase.traits,
    },
    inventory: [],
  };
  core.currentExplorerTraits = { ...core.currentExplorer.traits };
  core.currentExplorerInventory = [];
  eventCase.setupCore?.(core);

  await injectCore(page, core);
  await expect(page.getByTestId("betrayal-board")).toBeVisible({
    timeout: 30000,
  });

  await page.getByTestId("betrayal-action-move").click();
  await page.getByTestId("betrayal-room-hallway").click();
  await expect(
    page.getByTestId("betrayal-room-ground-north"),
  ).toHaveAccessibleName(/未探索.*一层.*可探索/);
  await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
  await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

  await page.getByTestId("betrayal-action-explore").click();
  await expect(
    page.getByTestId("betrayal-room-explore-target-ground-north"),
  ).toBeVisible();
  await expect(
    page.getByTestId("betrayal-room-explore-target-ground-south"),
  ).toBeVisible();
  await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

  await setHarnessRandomQueue(page, eventCase.randomQueue);
  await page.getByTestId("betrayal-room-ground-north").click();
  await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(0);
  const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
  await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
  await expect(discoveryPanel).toHaveAttribute(
    "aria-label",
    new RegExp(`事件牌 ${eventCase.eventName}`),
  );
  await expect(
    page.getByTestId("betrayal-discovery-card-front-atlas"),
  ).toBeVisible();
  const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
  const discoveryRollTexts =
    eventCase.expectedDiscoveryRollTexts ??
    eventCase.expectedRollTexts.filter(
      (expectedText) => !expectedText.startsWith("总点数 "),
    );
  for (const expectedText of discoveryRollTexts) {
    await expect(discoveryDetail).toContainText(expectedText);
  }
  await saveScreenshot(page, `${screenshotBase}-03-事件牌翻出已有检定.jpg`);

  const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
  await expect(rollPanel).toBeVisible();
  for (const expectedText of eventCase.expectedRollTexts) {
    await expect(rollPanel).toContainText(expectedText);
  }
  await expect(
    page.getByTestId("betrayal-house-dice-3d-group"),
  ).toHaveAttribute("data-dice-count", eventCase.expectedDiceCount);
  await expect(
    page.getByTestId("betrayal-house-dice-3d-group"),
  ).toHaveAttribute("data-dice-rule-subtotal", eventCase.expectedSubtotal);
  await expectVisiblePhysicalDiceBox(rollPanel);
  await waitForPhysicalDiceSettled(rollPanel);
  await expectPhysicalDiceSeparated(rollPanel, {
    minDiceCount: Number(eventCase.expectedDiceCount),
  });
  await saveScreenshot(page, `${screenshotBase}-04-骰盘停稳直接结算.jpg`);

  for (const expectedText of eventCase.expectedDetailTexts) {
    await expect(discoveryDetail).toContainText(expectedText);
  }
  await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(0);
  await saveScreenshot(page, `${screenshotBase}-05-结算结果可见.jpg`);

  await dismissDiscoveryPanel(page);
  await expect(page.getByTestId("betrayal-board")).toBeVisible();
  await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
  await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(0);
  await eventCase.assertClosed?.(page);
  await saveScreenshot(page, `${screenshotBase}-06-关闭后.jpg`);

  assertNoFatalFrontendErrors([
    { label: `betrayal-event-choice-${eventCase.screenshotSlug}`, diagnostics },
  ]);
}

const directRollFullChainCases: DirectRollEventFullChainCase[] = [
  {
    title: "标本剥制伤害和障碍物直接结算",
    eventName: "标本剥制",
    screenshotSlug: "标本剥制-完整链路",
    traits: { might: 2 },
    randomQueue: [0, 0],
    expectedRollTexts: ["力量检定", "总点数 0"],
    expectedDetailTexts: ["受到 1 点物理伤害", "通用伤害 1", "放置障碍物"],
    expectedDiceCount: "2",
    expectedSubtotal: "0",
    assertClosed: async (page) => {
      await expect(
        page.getByTestId("betrayal-room-marker-ground-north-obstacle"),
      ).toBeVisible();
    },
  },
  {
    title: "小丑房间精神伤害直接结算",
    eventName: "小丑房间",
    screenshotSlug: "小丑房间-完整链路",
    traits: { sanity: 4 },
    randomQueue: [0, 0, 0, 0],
    expectedRollTexts: ["神志检定", "总点数 0"],
    expectedDetailTexts: ["受到 2 点精神伤害", "通用伤害 2"],
    expectedDiceCount: "4",
    expectedSubtotal: "0",
  },
  {
    title: "咬一口物理伤害直接结算",
    eventName: "咬一口！",
    screenshotSlug: "咬一口-完整链路",
    traits: { might: 2 },
    randomQueue: [0.5, 0.5],
    expectedRollTexts: ["力量检定", "总点数 2"],
    expectedDetailTexts: ["受到 1 点物理伤害", "通用伤害 1"],
    expectedDiceCount: "2",
    expectedSubtotal: "2",
  },
  {
    title: "电话铃声伤害直接结算",
    eventName: "电话铃声",
    screenshotSlug: "电话铃声-完整链路",
    randomQueue: [0, 0, 0.99, 0.99],
    expectedRollTexts: ["投 2 颗骰子", "总点数 0"],
    expectedDetailTexts: ["受到两颗骰子的物理伤害", "受到 2 颗骰子的物理伤害"],
    expectedDiceCount: "2",
    expectedSubtotal: "0",
    assertClosed: async (page) => {
      await expect(
        page.getByTestId("betrayal-room-occupant-ground-north-0"),
      ).toBeVisible();
    },
  },
  {
    title: "嘎吱的木门移动直接结算",
    eventName: "嘎吱的木门",
    screenshotSlug: "嘎吱的木门-完整链路",
    traits: { knowledge: 4 },
    randomQueue: [0.99, 0.99, 0.99, 0.99],
    expectedRollTexts: ["知识检定", "总点数 8"],
    expectedDetailTexts: ["放置到上层起始板块", "放置到上层起始点"],
    expectedDiceCount: "4",
    expectedSubtotal: "8",
    assertClosed: async (page) => {
      await expect(
        page.getByTestId("betrayal-room-occupant-upper-landing-0"),
      ).toBeVisible();
    },
  },
  {
    title: "小机器人抽物品直接结算",
    eventName: "小机器人",
    screenshotSlug: "小机器人-完整链路",
    traits: { knowledge: 4 },
    randomQueue: [0.99, 0.99, 0.99, 0.99],
    expectedRollTexts: ["知识检定", "总点数 8"],
    expectedDetailTexts: ["抽取一张物品卡"],
    expectedDiceCount: "4",
    expectedSubtotal: "8",
    setupCore: (core) => {
      const huntingKnife = BETRAYAL_DISCOVERY_POOLS.possessions.item.find(
        (card) => card.id === "hunting-knife",
      );
      if (!huntingKnife) {
        throw new Error("山屋物品池缺少砍刀");
      }
      core.possessionOrderByKind.item = [huntingKnife];
    },
    assertClosed: async (page) => {
      await expect(
        page.getByTestId("betrayal-inventory-row-item"),
      ).toContainText("砍刀");
      await expect(
        page
          .locator('button[data-testid^="betrayal-inventory-hunting-knife-"]')
          .first(),
      ).toBeVisible();
    },
  },
  {
    title: "最深的壁橱抽物品直接结算",
    eventName: "最深的壁橱",
    screenshotSlug: "最深的壁橱-完整链路",
    traits: { speed: 4 },
    randomQueue: [0.99, 0.99, 0.99, 0.99],
    expectedRollTexts: ["速度检定", "总点数 8"],
    expectedDetailTexts: ["抽取一张物品卡"],
    expectedDiceCount: "4",
    expectedSubtotal: "8",
    setupCore: (core) => {
      const camera = BETRAYAL_DISCOVERY_POOLS.possessions.item.find(
        (card) => card.id === "camera",
      );
      if (!camera) {
        throw new Error("山屋物品池缺少魔法相机");
      }
      core.possessionOrderByKind.item = [camera];
    },
    assertClosed: async (page) => {
      await expect(
        page.getByTestId("betrayal-inventory-row-item"),
      ).toContainText("魔法相机");
    },
  },
  {
    title: "磁带播放器知识奖励直接结算",
    eventName: "磁带播放器",
    screenshotSlug: "磁带播放器-完整链路",
    traits: { sanity: 4 },
    randomQueue: [0.99, 0.99, 0.99, 0.99],
    expectedRollTexts: ["神志检定", "总点数 8"],
    expectedDetailTexts: ["获得 1 点知识", "知识 +1"],
    expectedDiceCount: "4",
    expectedSubtotal: "8",
  },
  {
    title: "在你背后神志奖励直接结算",
    eventName: "在你背后！",
    screenshotSlug: "在你背后-完整链路",
    traits: { speed: 4 },
    randomQueue: [0.99, 0.99, 0.99, 0.99],
    expectedRollTexts: ["速度检定", "总点数 8"],
    expectedDetailTexts: ["获得 1 点神志", "神志 +1"],
    expectedDiceCount: "4",
    expectedSubtotal: "8",
  },
  {
    title: "一种怪异的感觉力量损失直接结算",
    eventName: "一种怪异的感觉",
    screenshotSlug: "一种怪异的感觉-完整链路",
    randomQueue: [0, 0],
    expectedRollTexts: ["投 2 颗骰子", "总点数 0"],
    expectedDetailTexts: ["失去 1 点力量", "力量 -1"],
    expectedDiceCount: "2",
    expectedSubtotal: "0",
  },
  {
    title: "葬礼神志奖励直接结算",
    eventName: "葬礼",
    screenshotSlug: "葬礼-完整链路",
    traits: { sanity: 4 },
    randomQueue: [0.99, 0.99, 0.99, 0.99],
    expectedRollTexts: ["神志检定", "总点数 8"],
    expectedDetailTexts: ["获得 1 点神志", "神志 +1"],
    expectedDiceCount: "4",
    expectedSubtotal: "8",
  },
];

const cases: EventChoiceCase[] = [
  {
    title: "上古旧宅",
    screenshotSlug: "上古旧宅-属性目标通用伤害",
    buildCore: () =>
      createExploredEventChoiceCore("上古旧宅", {
        traits: { speed: 4, might: 4, knowledge: 4, sanity: 4 },
      }),
    actions: [
      "betrayal-event-choice-trait-might",
      "betrayal-room-hallway",
      "betrayal-event-choice-damage-might",
      "betrayal-event-choice-confirm",
    ],
    expectedTexts: ["力量检定", "放置到门厅", "通用伤害 1（力量）"],
    expectNoRecentRollBeforeChoice: true,
    expectedRecentRollAfterChoice: ["力量检定"],
    actionRandomQueue: [0.6, 0.6, 0.6, 0.6],
  },
  {
    title: "肉质苔癣",
    screenshotSlug: "肉质苔癣-跳过可选效果",
    buildCore: () =>
      createPendingChoiceCore("肉质苔癣", eventEffect("肉质苔癣"), {
        id: "e2e-flesh-moss-choice",
        acceptLabel: "大口吸入芳香",
        declineLabel: "不吸入芳香",
      }),
    actions: ["betrayal-event-choice-decline"],
    expectedTexts: ["无事发生"],
  },
  {
    title: "大宅饿了",
    screenshotSlug: "大宅饿了-选择属性跳过作祟",
    buildCore: () =>
      createPendingChoiceCore("大宅饿了", eventEffect("大宅饿了"), {
        id: "e2e-hungry-house-choice",
        acceptLabel: "进行作祟检定",
        declineLabel: "跳过作祟检定",
      }),
    actions: [
      "betrayal-event-choice-trait-knowledge",
      "betrayal-event-choice-decline",
    ],
    expectedTexts: ["知识 +1"],
  },
  {
    title: "蜘蛛！",
    screenshotSlug: "蜘蛛-属性相邻房间",
    buildCore: () =>
      createExploredEventChoiceCore("蜘蛛！", {
        traits: { sanity: 4, speed: 4 },
        rollDice: [2, 2, 2, 2],
      }),
    actions: [
      "betrayal-event-choice-trait-speed",
      "betrayal-room-hallway",
      "betrayal-event-choice-confirm",
    ],
    expectedTexts: ["速度 +1", "放置到门厅"],
    expectedRecentRollBeforeChoice: [
      "神志检定",
      "总点数 4",
      "获得 1 点神志或速度",
    ],
  },
  {
    title: "吊死鬼",
    screenshotSlug: "吊死鬼-奖励属性",
    buildCore: () =>
      createPendingChoiceCore("吊死鬼", allPassEffect("吊死鬼"), {
        id: "e2e-hanging-tree-trait-choice",
      }),
    actions: [
      "betrayal-event-choice-trait-knowledge",
      "betrayal-event-choice-confirm",
    ],
    expectedTexts: ["知识 +1"],
  },
  {
    title: "一条秘密通道",
    screenshotSlug: "一条秘密通道-第二目标板块",
    buildCore: () =>
      createPendingChoiceCore("一条秘密通道", branchEffect("一条秘密通道", 5), {
        id: "e2e-secret-passage-room-choice",
        roomId: "ground-north",
        traits: { knowledge: 4 },
      }),
    actions: ["betrayal-room-hallway", "betrayal-event-choice-confirm"],
    expectedTexts: [
      "在当前板块放置秘密通道标志物",
      "在门厅放置秘密通道标志物",
      "知识 +1",
    ],
  },
  {
    title: "脑状食品",
    screenshotSlug: "脑状食品-奖励属性",
    buildCore: () =>
      createPendingChoiceCore("脑状食品", branchEffect("脑状食品", 5), {
        id: "e2e-brain-food-reward-choice",
      }),
    actions: [
      "betrayal-event-choice-trait-speed",
      "betrayal-event-choice-confirm",
    ],
    expectedTexts: ["速度 +1"],
  },
  {
    title: "脑状食品",
    screenshotSlug: "脑状食品-通用伤害属性",
    buildCore: () =>
      createPendingChoiceCore("脑状食品", branchEffect("脑状食品", 0), {
        id: "e2e-brain-food-damage-choice",
      }),
    actions: [
      "betrayal-event-choice-damage-might",
      "betrayal-event-choice-damage-knowledge",
      "betrayal-event-choice-confirm",
    ],
    expectedTexts: ["通用伤害 2（力量、知识）"],
  },
  {
    title: "夜幕众星",
    screenshotSlug: "夜幕众星-选择检定属性",
    buildCore: () =>
      createExploredEventChoiceCore("夜幕众星", {
        traits: { knowledge: 4 },
      }),
    actions: [
      "betrayal-event-choice-trait-knowledge",
      "betrayal-event-choice-confirm",
    ],
    expectedTexts: ["知识检定", "治疗知识"],
    expectNoRecentRollBeforeChoice: true,
    expectedRecentRollAfterChoice: ["知识检定"],
    actionRandomQueue: [0.1, 0.1, 0.1, 0.1],
  },
  {
    title: "一抹鲜红",
    screenshotSlug: "一抹鲜红-跳过作祟伤害",
    buildCore: () =>
      createPendingChoiceCore("一抹鲜红", eventEffect("一抹鲜红"), {
        id: "e2e-crimson-splash-choice",
        acceptLabel: "进行作祟检定",
        declineLabel: "跳过作祟检定",
      }),
    actions: ["betrayal-event-choice-decline"],
    expectedTexts: ["物理伤害"],
  },
  {
    title: "一瓶微尘",
    screenshotSlug: "一瓶微尘-跳过作祟双属性",
    buildCore: () =>
      createPendingChoiceCore("一瓶微尘", eventEffect("一瓶微尘"), {
        id: "e2e-dusty-vial-choice",
        acceptLabel: "进行作祟检定",
        declineLabel: "跳过作祟检定",
      }),
    actions: ["betrayal-event-choice-decline"],
    expectedTexts: ["力量 -1", "神志 +1"],
  },
  {
    title: "说“茄子”！",
    screenshotSlug: "说茄子-跳过作祟抽物品",
    buildCore: () =>
      createPendingChoiceCore("说“茄子”！", eventEffect("说“茄子”！"), {
        id: "e2e-say-cheese-choice",
        acceptLabel: "进行作祟检定",
        declineLabel: "跳过作祟检定",
        possessionItems: [{ id: "camera", name: "魔法相机", kind: "item" }],
      }),
    actions: ["betrayal-event-choice-decline"],
    expectedTexts: ["抽取一张物品卡"],
    expectedVisibleTestIds: ["betrayal-inventory-row-item"],
  },
];

test.describe("山屋惊魂事件牌真实页面选择承接", () => {
  test.beforeEach(async ({ page, context }) => {
    await initBetrayalContext(context);
    await page.setViewportSize({ width: 1600, height: 900 });
    await warmBetrayalFrontend(context);
    await page.goto("/play/betrayal", { waitUntil: "domcontentloaded" });
    await waitForBetrayalPageReady(page);
  });

  for (const eventCase of cases) {
    test(`${eventCase.title} 能在真实浏览器页面完成事件选择：${eventCase.screenshotSlug}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      const diagnostics = attachPageDiagnostics(
        page,
        `betrayal-event-choice-${eventCase.screenshotSlug}`,
      );
      const screenshotBase = `${EVIDENCE_DIR}/${eventCase.screenshotSlug}`;

      await injectCore(page, eventCase.buildCore());
      await expect(page.getByTestId("betrayal-board")).toBeVisible({
        timeout: 30000,
      });
      const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
      await expect(eventChoicePanel).toHaveAttribute(
        "aria-label",
        eventCase.title,
      );
      await expect(eventChoicePanel).toHaveAttribute(
        "data-layout",
        "main-stage",
      );
      await expect(eventChoicePanel).toHaveAttribute(
        "data-surface",
        "open-table",
      );
      await expect(
        page
          .getByTestId("betrayal-event-choice-card-front-atlas")
          .or(page.getByTestId("betrayal-event-choice-card-front-missing")),
      ).toBeVisible();
      if (eventCase.expectedRecentRollBeforeChoice) {
        const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
        await expect(rollPanel).toBeVisible();
        for (const expectedRollText of eventCase.expectedRecentRollBeforeChoice) {
          await expect(rollPanel).toContainText(expectedRollText);
        }
      }
      if (eventCase.expectNoRecentRollBeforeChoice) {
        await expect(
          page.getByTestId("betrayal-recent-roll-panel"),
        ).toHaveCount(0);
      }
      const panelSurface = await eventChoicePanel.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderTopWidth: style.borderTopWidth,
        };
      });
      expect(panelSurface.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(panelSurface.backgroundImage).toBe("none");
      expect(panelSurface.borderTopWidth).toBe("0px");

      const optionMetrics = await page.evaluate(() => {
        const selectors = [
          'button[data-testid^="betrayal-event-choice-trait-"]',
          'button[data-testid^="betrayal-event-choice-damage-"]',
          'button[data-testid="betrayal-event-choice-confirm"]',
          'button[data-testid="betrayal-event-choice-decline"]',
        ];
        return selectors.flatMap((selector) =>
          Array.from(document.querySelectorAll<HTMLElement>(selector))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.display !== "none" &&
                style.visibility !== "hidden"
              );
            })
            .map((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return {
                testId: element.dataset.testid ?? "",
                width: rect.width,
                height: rect.height,
                fontSize: Number.parseFloat(style.fontSize),
              };
            }),
        );
      });
      expect(optionMetrics.length).toBeGreaterThan(0);
      for (const metric of optionMetrics) {
        const isTraitButton =
          metric.testId.startsWith("betrayal-event-choice-trait-") ||
          metric.testId.startsWith("betrayal-event-choice-damage-");
        expect(
          metric.height,
          `${metric.testId} 高度不足，不是可读可点的大选项`,
        ).toBeGreaterThanOrEqual(isTraitButton ? 76 : 72);
        expect(
          metric.width,
          `${metric.testId} 宽度不足，不是可读可点的大选项`,
        ).toBeGreaterThanOrEqual(isTraitButton ? 168 : 160);
        expect(
          metric.fontSize,
          `${metric.testId} 字号不足，不是可读可点的大选项`,
        ).toBeGreaterThanOrEqual(isTraitButton ? 24 : 18);
      }
      await saveScreenshot(page, `${screenshotBase}-选择前.jpg`);

      if (eventCase.actionRandomQueue) {
        await setHarnessRandomQueue(page, eventCase.actionRandomQueue);
      }
      for (const testId of eventCase.actions) {
        await page.getByTestId(testId).click();
      }

      await expect(page.getByTestId("betrayal-event-choice-panel")).toBeHidden({
        timeout: 30000,
      });
      const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
      for (const expectedText of eventCase.expectedTexts) {
        await expect(discoveryDetail).toContainText(expectedText);
      }
      if (eventCase.expectedRecentRollAfterChoice) {
        const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
        await expect(rollPanel).toBeVisible();
        for (const expectedRollText of eventCase.expectedRecentRollAfterChoice) {
          await expect(rollPanel).toContainText(expectedRollText);
        }
      }
      for (const testId of eventCase.expectedVisibleTestIds ?? []) {
        await expect(page.getByTestId(testId)).toBeVisible();
      }
      if (eventCase.title === "说“茄子”！") {
        await expect(
          page.getByTestId("betrayal-inventory-row-item"),
        ).toContainText("魔法相机");
      }
      await saveScreenshot(page, `${screenshotBase}-结算后.jpg`);
      assertNoFatalFrontendErrors([
        {
          label: `betrayal-event-choice-${eventCase.screenshotSlug}`,
          diagnostics,
        },
      ]);
    });
  }

  test("上古旧宅真实链路从探索翻牌到选择结算关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-上古旧宅-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/上古旧宅-完整链路`;
    const oldMansion = eventByName("上古旧宅");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [oldMansion];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        speed: 4,
        might: 4,
        knowledge: 4,
        sanity: 4,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "上古旧宅");
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-trait-speed"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-trait-might"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-03-事件牌翻出选择前.jpg`);

    await page.getByTestId("betrayal-event-choice-trait-might").click();
    await expect(
      page.getByTestId("betrayal-room-event-choice-target-hallway"),
    ).toBeVisible();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-event-choice-damage-might"),
    ).toBeVisible();
    await page.getByTestId("betrayal-event-choice-damage-might").click();
    await saveScreenshot(page, `${screenshotBase}-04-选择目标和伤害.jpg`);

    await setHarnessRandomQueue(page, [0.6, 0.6, 0.6, 0.6]);
    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(
      discoveryPanel.getByTestId("betrayal-recent-roll-panel"),
    ).toContainText("力量检定");
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("力量检定");
    await expect(discoveryDetail).toContainText("放置到门厅");
    await expect(discoveryDetail).toContainText("通用伤害 1（力量）");
    await saveScreenshot(page, `${screenshotBase}-05-结算后.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-上古旧宅-完整链路", diagnostics },
    ]);
  });

  test("夜幕众星真实链路从探索翻牌到选择结算关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-夜幕众星-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/夜幕众星-完整链路`;
    const nightStars = eventByName("夜幕众星");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [nightStars];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        knowledge: 4,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "夜幕众星");
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-trait-might"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-trait-speed"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-trait-knowledge"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-trait-sanity"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-03-事件牌翻出选择前.jpg`);

    await page.getByTestId("betrayal-event-choice-trait-knowledge").click();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).not.toBeDisabled();
    await saveScreenshot(page, `${screenshotBase}-04-选择属性后.jpg`);

    await setHarnessRandomQueue(page, [0.1, 0.1, 0.1, 0.1]);
    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(
      discoveryPanel.getByTestId("betrayal-recent-roll-panel"),
    ).toContainText("知识检定");
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("知识检定");
    await expect(discoveryDetail).toContainText("治疗知识");
    await saveScreenshot(page, `${screenshotBase}-05-结算后.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-夜幕众星-完整链路", diagnostics },
    ]);
  });

  test("肉质苔癣真实链路从探索翻牌到选择吸入投骰再选属性结算关闭", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-肉质苔癣-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/肉质苔癣-完整链路`;
    const fleshMoss = eventByName("肉质苔癣");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [fleshMoss];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        might: 4,
        speed: 4,
        knowledge: 4,
        sanity: 4,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "肉质苔癣");
    await expect(eventChoicePanel).toHaveAttribute(
      "data-surface",
      "open-table",
    );
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-trait-knowledge"),
    ).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-decline"),
    ).toContainText("不吸入芳香");
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toContainText("大口吸入芳香");
    const initialSurface = await eventChoicePanel.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        borderTopWidth: style.borderTopWidth,
      };
    });
    expect(initialSurface.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(initialSurface.backgroundImage).toBe("none");
    expect(initialSurface.borderTopWidth).toBe("0px");
    const initialOptionMetrics = await page.evaluate(() =>
      ["betrayal-event-choice-decline", "betrayal-event-choice-confirm"].map(
        (testId) => {
          const element = document.querySelector<HTMLElement>(
            `[data-testid="${testId}"]`,
          );
          if (!element) {
            throw new Error(`缺少事件选项按钮：${testId}`);
          }
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            testId,
            width: rect.width,
            height: rect.height,
            fontSize: Number.parseFloat(style.fontSize),
          };
        },
      ),
    );
    for (const metric of initialOptionMetrics) {
      expect(metric.width, `${metric.testId} 宽度不足`).toBeGreaterThanOrEqual(
        160,
      );
      expect(metric.height, `${metric.testId} 高度不足`).toBeGreaterThanOrEqual(
        72,
      );
      expect(
        metric.fontSize,
        `${metric.testId} 字号不足`,
      ).toBeGreaterThanOrEqual(18);
    }
    await saveScreenshot(page, `${screenshotBase}-03-事件牌翻出可选择吸入.jpg`);

    await setHarnessRandomQueue(page, [3, 3]);
    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeVisible();
    await expect(page.getByTestId("betrayal-event-choice-decline")).toHaveCount(
      0,
    );
    const rollPanel = eventChoicePanel.getByTestId(
      "betrayal-recent-roll-panel",
    );
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("投 2 颗骰子");
    await expect(rollPanel).toContainText("总点数 4");
    await expect(rollPanel).toContainText("获得 1 点任意属性");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-count", "2");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-subtotal", "4");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 2 });
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toBeEnabled();
    for (const trait of ["might", "speed", "knowledge", "sanity"]) {
      await expect(
        page.getByTestId(`betrayal-event-choice-trait-${trait}`),
      ).toBeVisible();
    }
    const traitColors = await page.evaluate(() =>
      ["might", "speed", "knowledge", "sanity"].map((trait) => {
        const element = document.querySelector<HTMLElement>(
          `[data-testid="betrayal-event-choice-trait-${trait}"]`,
        );
        if (!element) {
          throw new Error(`缺少属性选项：${trait}`);
        }
        const style = getComputedStyle(element);
        return {
          trait,
          borderColor: style.borderColor,
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      }),
    );
    expect(
      new Set(traitColors.map((metric) => metric.borderColor)).size,
    ).toBeGreaterThan(1);
    expect(
      new Set(traitColors.map((metric) => metric.backgroundColor)).size,
    ).toBeGreaterThan(1);
    const scrollCheck = await eventChoicePanel
      .locator(".custom-scrollbar")
      .evaluate((node) => {
        const element = node as HTMLElement;
        element.scrollTop = element.scrollHeight;
        return {
          scrollTop: element.scrollTop,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      });
    expect(scrollCheck.scrollHeight).toBeGreaterThanOrEqual(
      scrollCheck.clientHeight,
    );
    await expect(
      page.getByTestId("betrayal-event-choice-trait-knowledge"),
    ).toBeVisible();
    const afterRollCore = await readCurrentCore(page);
    expect(afterRollCore.pendingEventChoice?.sourceTitle).toBe("肉质苔癣");
    expect(afterRollCore.pendingEventChoice?.effect.mode).toBe("chosenTrait");
    expect(afterRollCore.currentExplorer.traits.knowledge).toBe(4);
    expect(afterRollCore.recentRoll?.kind).toBe("eventDiceRoll");
    expect(afterRollCore.recentRoll?.dice).toEqual([2, 2]);
    await saveScreenshot(
      page,
      `${screenshotBase}-04-选择吸入后骰盘停稳并出现属性选项.jpg`,
    );

    await page.getByTestId("betrayal-event-choice-trait-knowledge").click();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).not.toBeDisabled();
    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("知识 +1");
    await expect(
      discoveryPanel.getByTestId("betrayal-recent-roll-panel"),
    ).toContainText("投 2 颗骰子");
    await expect(
      discoveryPanel.getByTestId("betrayal-recent-roll-panel"),
    ).toContainText("总点数 4");
    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.pendingEventChoice).toBeNull();
    expect(afterSettleCore.currentExplorer.traits.knowledge).toBe(5);
    expect(afterSettleCore.recentRoll?.sourceTitle).toBe("肉质苔癣");
    await saveScreenshot(
      page,
      `${screenshotBase}-05-选择知识奖励后结算结果可见.jpg`,
    );

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后回牌桌.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-肉质苔癣-完整链路", diagnostics },
    ]);
  });

  test("一瓶微尘真实链路从探索翻牌到选择作祟检定投骰结算关闭", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-一瓶微尘-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/一瓶微尘-完整链路`;
    const dustyVial = eventByName("一瓶微尘");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [dustyVial];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        might: 4,
        sanity: 4,
      },
      inventory: [
        { id: "omen-book", name: "书本", kind: "omen" },
        { id: "dog", name: "狗", kind: "omen" },
      ],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "一瓶微尘");
    await expect(eventChoicePanel).toHaveAttribute(
      "data-surface",
      "open-table",
    );
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toContainText("进行作祟检定");
    await expect(
      page.getByTestId("betrayal-event-choice-decline"),
    ).toContainText("跳过作祟检定");
    const initialSurface = await eventChoicePanel.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        borderTopWidth: style.borderTopWidth,
      };
    });
    expect(initialSurface.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(initialSurface.backgroundImage).toBe("none");
    expect(initialSurface.borderTopWidth).toBe("0px");
    const optionMetrics = await page.evaluate(() =>
      ["betrayal-event-choice-decline", "betrayal-event-choice-confirm"].map(
        (testId) => {
          const element = document.querySelector<HTMLElement>(
            `[data-testid="${testId}"]`,
          );
          if (!element) {
            throw new Error(`缺少事件选项按钮：${testId}`);
          }
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            testId,
            width: rect.width,
            height: rect.height,
            fontSize: Number.parseFloat(style.fontSize),
          };
        },
      ),
    );
    for (const metric of optionMetrics) {
      expect(metric.width, `${metric.testId} 宽度不足`).toBeGreaterThanOrEqual(
        160,
      );
      expect(metric.height, `${metric.testId} 高度不足`).toBeGreaterThanOrEqual(
        72,
      );
      expect(
        metric.fontSize,
        `${metric.testId} 字号不足`,
      ).toBeGreaterThanOrEqual(18);
    }
    const beforeChoiceCore = await readCurrentCore(page);
    expect(beforeChoiceCore.pendingEventChoice?.sourceTitle).toBe("一瓶微尘");
    expect(beforeChoiceCore.currentExplorer.traits.might).toBe(4);
    expect(beforeChoiceCore.currentExplorer.traits.sanity).toBe(4);
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出可选择作祟检定.jpg`,
    );

    await setHarnessRandomQueue(page, [0.1, 0.1, 0.1, 0.1, 0.1, 0.1]);
    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 一瓶微尘/,
    );
    const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("作祟检定");
    const afterRollCore = await readCurrentCore(page);
    const rolledDice = afterRollCore.recentRoll?.dice ?? [];
    const rolledSubtotal = rolledDice.reduce((sum, pip) => sum + pip, 0);
    expect(rolledDice.length).toBeGreaterThan(0);
    expect(rolledDice.every((pip) => pip === 0)).toBe(true);
    await expect(rollPanel).toContainText(`总点数 ${rolledSubtotal}`);
    const diceGroup = discoveryPanel.getByTestId(
      "betrayal-house-dice-3d-group",
    );
    await expect(diceGroup).toHaveAttribute(
      "data-dice-count",
      String(rolledDice.length),
    );
    await expect(diceGroup).toHaveAttribute(
      "data-dice-rule-subtotal",
      String(rolledSubtotal),
    );
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, {
      minDiceCount: rolledDice.length,
    });
    expect(afterRollCore.pendingEventChoice).toBeNull();
    expect(afterRollCore.phase).toBe("preHaunt");
    expect(afterRollCore.scenarioRuntime.hauntTriggered).toBe(false);
    expect(afterRollCore.currentExplorer.traits.might).toBe(4);
    expect(afterRollCore.currentExplorer.traits.sanity).toBe(5);
    expect(afterRollCore.recentRoll?.sourceTitle).toBe("一瓶微尘");
    expect(afterRollCore.recentRoll?.rollLabel).toBe("作祟检定");
    await saveScreenshot(
      page,
      `${screenshotBase}-04-选择作祟检定后骰盘停稳.jpg`,
    );

    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("作祟检定 0");
    await expect(discoveryDetail).toContainText("神志 +1");
    await expect(discoveryDetail).not.toContainText("力量 -1");
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await saveScreenshot(page, `${screenshotBase}-05-神志奖励结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后回牌桌.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-一瓶微尘-完整链路", diagnostics },
    ]);
  });

  test("大宅饿了真实链路从探索翻牌到跳过作祟选择属性结算关闭", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-大宅饿了-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/大宅饿了-完整链路`;
    const hungryHouse = eventByName("大宅饿了");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [hungryHouse];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        might: 4,
        speed: 4,
        knowledge: 4,
        sanity: 4,
      },
      inventory: [
        { id: "omen-book", name: "书本", kind: "omen" },
        { id: "dog", name: "狗", kind: "omen" },
      ],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "大宅饿了");
    await expect(eventChoicePanel).toHaveAttribute(
      "data-surface",
      "open-table",
    );
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toContainText("进行作祟检定");
    await expect(
      page.getByTestId("betrayal-event-choice-decline"),
    ).toContainText("跳过作祟检定");
    await expect(
      page.getByTestId("betrayal-event-choice-decline"),
    ).toBeDisabled();
    for (const trait of ["might", "speed", "knowledge", "sanity"]) {
      await expect(
        page.getByTestId(`betrayal-event-choice-trait-${trait}`),
      ).toBeVisible();
    }
    const initialSurface = await eventChoicePanel.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        borderTopWidth: style.borderTopWidth,
      };
    });
    expect(initialSurface.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(initialSurface.backgroundImage).toBe("none");
    expect(initialSurface.borderTopWidth).toBe("0px");
    const optionMetrics = await page.evaluate(() =>
      [
        "betrayal-event-choice-trait-might",
        "betrayal-event-choice-trait-speed",
        "betrayal-event-choice-trait-knowledge",
        "betrayal-event-choice-trait-sanity",
        "betrayal-event-choice-decline",
        "betrayal-event-choice-confirm",
      ].map((testId) => {
        const element = document.querySelector<HTMLElement>(
          `[data-testid="${testId}"]`,
        );
        if (!element) {
          throw new Error(`缺少事件选项控件：${testId}`);
        }
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          testId,
          width: rect.width,
          height: rect.height,
          fontSize: Number.parseFloat(style.fontSize),
        };
      }),
    );
    for (const metric of optionMetrics) {
      expect(metric.width, `${metric.testId} 宽度不足`).toBeGreaterThanOrEqual(
        120,
      );
      expect(metric.height, `${metric.testId} 高度不足`).toBeGreaterThanOrEqual(
        72,
      );
      expect(
        metric.fontSize,
        `${metric.testId} 字号不足`,
      ).toBeGreaterThanOrEqual(18);
    }
    const traitColors = await page.evaluate(() =>
      ["might", "speed", "knowledge", "sanity"].map((trait) => {
        const element = document.querySelector<HTMLElement>(
          `[data-testid="betrayal-event-choice-trait-${trait}"]`,
        );
        if (!element) {
          throw new Error(`缺少属性选项：${trait}`);
        }
        const style = getComputedStyle(element);
        return {
          trait,
          borderColor: style.borderColor,
          backgroundColor: style.backgroundColor,
        };
      }),
    );
    expect(
      new Set(traitColors.map((metric) => metric.borderColor)).size,
    ).toBeGreaterThan(1);
    expect(
      new Set(traitColors.map((metric) => metric.backgroundColor)).size,
    ).toBeGreaterThan(1);
    const beforeChoiceCore = await readCurrentCore(page);
    expect(beforeChoiceCore.pendingEventChoice?.sourceTitle).toBe("大宅饿了");
    expect(beforeChoiceCore.pendingEventChoice?.effect.mode).toBe(
      "optionalHauntRoll",
    );
    expect(beforeChoiceCore.currentExplorer.traits.knowledge).toBe(4);
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出可选择作祟检定.jpg`,
    );

    await page.getByTestId("betrayal-event-choice-trait-knowledge").click();
    await expect(
      page.getByTestId("betrayal-event-choice-decline"),
    ).not.toBeDisabled();
    const scrollCheck = await eventChoicePanel
      .locator(".custom-scrollbar")
      .evaluate((node) => {
        const element = node as HTMLElement;
        element.scrollTop = element.scrollHeight;
        return {
          scrollTop: element.scrollTop,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        };
      });
    expect(scrollCheck.scrollHeight).toBeGreaterThanOrEqual(
      scrollCheck.clientHeight,
    );
    await expect(
      page.getByTestId("betrayal-event-choice-trait-knowledge"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await saveScreenshot(
      page,
      `${screenshotBase}-04-选择知识奖励后准备跳过作祟.jpg`,
    );

    await page.getByTestId("betrayal-event-choice-decline").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 大宅饿了/,
    );
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("跳过作祟检定");
    await expect(discoveryDetail).toContainText("知识 +1");
    await expect(discoveryDetail).not.toContainText("力量 +1");
    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.pendingEventChoice).toBeNull();
    expect(afterSettleCore.phase).toBe("preHaunt");
    expect(afterSettleCore.scenarioRuntime.hauntTriggered).toBe(false);
    expect(afterSettleCore.currentExplorer.traits.might).toBe(4);
    expect(afterSettleCore.currentExplorer.traits.knowledge).toBe(5);
    expect(afterSettleCore.recentRoll).toBeNull();
    await saveScreenshot(page, `${screenshotBase}-05-知识奖励结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后回牌桌.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-大宅饿了-完整链路", diagnostics },
    ]);
  });

  test("说茄子真实链路从探索翻牌到作祟失败抽物品关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-说茄子-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/说茄子-完整链路`;
    const sayCheese = eventByName("说“茄子”！");
    const camera = BETRAYAL_DISCOVERY_POOLS.possessions.item.find(
      (card) => card.id === "camera",
    );
    if (!camera) {
      throw new Error("山屋物品池缺少魔法相机");
    }
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [sayCheese];
    core.possessionOrderByKind.item = [camera];
    core.currentExplorer = {
      ...core.currentExplorer,
      inventory: [
        { id: "omen-book", name: "书本", kind: "omen" },
        { id: "dog", name: "狗", kind: "omen" },
      ],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "说“茄子”！");
    await expect(eventChoicePanel).toHaveAttribute(
      "data-surface",
      "open-table",
    );
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toContainText("进行作祟检定");
    await expect(
      page.getByTestId("betrayal-event-choice-decline"),
    ).toContainText("跳过作祟检定");
    const beforeChoiceCore = await readCurrentCore(page);
    expect(beforeChoiceCore.pendingEventChoice?.sourceTitle).toBe("说“茄子”！");
    expect(
      beforeChoiceCore.currentExplorer.inventory.some(
        (card) => card.name === "魔法相机",
      ),
    ).toBe(false);
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出可选择作祟检定.jpg`,
    );

    await setHarnessRandomQueue(page, [0.1, 0.1]);
    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 说“茄子”！/,
    );
    const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("作祟检定");
    const afterRollCore = await readCurrentCore(page);
    const rollDice = afterRollCore.recentRoll?.dice ?? [];
    const rollTotal =
      rollDice.reduce((sum, pip) => sum + pip, 0) +
      (afterRollCore.recentRoll?.passiveBonus ?? 0);
    const rollDiceCount = rollDice.length;
    expect(rollDiceCount).toBeGreaterThan(0);
    expect(rollTotal).toBeGreaterThanOrEqual(0);
    expect(rollTotal).toBeLessThan(
      afterRollCore.scenarioRuntime.hauntRollThreshold,
    );
    await expect(rollPanel).toContainText(`总点数 ${rollTotal}`);
    const diceGroup = discoveryPanel.getByTestId(
      "betrayal-house-dice-3d-group",
    );
    await expect(diceGroup).toHaveAttribute(
      "data-dice-count",
      String(rollDiceCount),
    );
    await expect(diceGroup).toHaveAttribute(
      "data-dice-rule-subtotal",
      String(rollTotal),
    );
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, {
      minDiceCount: rollDiceCount,
    });
    await saveScreenshot(
      page,
      `${screenshotBase}-04-选择作祟检定后骰盘停稳.jpg`,
    );

    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText(`作祟检定 ${rollTotal}`);
    await expect(discoveryDetail).toContainText("抽取一张物品卡");
    await expect(page.getByTestId("betrayal-inventory-row-item")).toContainText(
      "魔法相机",
    );
    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.pendingEventChoice).toBeNull();
    expect(afterSettleCore.phase).toBe("preHaunt");
    expect(afterSettleCore.scenarioRuntime.hauntTriggered).toBe(false);
    const settledRollTotal =
      (afterSettleCore.recentRoll?.dice ?? []).reduce(
        (sum, pip) => sum + pip,
        0,
      ) + (afterSettleCore.recentRoll?.passiveBonus ?? 0);
    expect(settledRollTotal).toBeLessThan(
      afterSettleCore.scenarioRuntime.hauntRollThreshold,
    );
    expect(afterSettleCore.currentExplorer.inventory.at(-1)?.name).toBe(
      "魔法相机",
    );
    expect(afterSettleCore.recentRoll?.sourceTitle).toBe("说“茄子”！");
    await saveScreenshot(page, `${screenshotBase}-05-抽物品结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-inventory-row-item")).toContainText(
      "魔法相机",
    );
    await saveScreenshot(page, `${screenshotBase}-06-关闭后回牌桌.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-说茄子-完整链路", diagnostics },
    ]);
  });

  test("一抹鲜红真实链路从探索翻牌到作祟失败速度奖励关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-一抹鲜红-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/一抹鲜红-完整链路`;
    const crimsonSplash = eventByName("一抹鲜红");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [crimsonSplash];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        speed: 4,
      },
      inventory: [
        { id: "omen-book", name: "书本", kind: "omen" },
        { id: "dog", name: "狗", kind: "omen" },
      ],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "一抹鲜红");
    await expect(eventChoicePanel).toHaveAttribute(
      "data-surface",
      "open-table",
    );
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toContainText("进行作祟检定");
    await expect(
      page.getByTestId("betrayal-event-choice-decline"),
    ).toContainText("跳过作祟检定");
    const beforeChoiceCore = await readCurrentCore(page);
    expect(beforeChoiceCore.pendingEventChoice?.sourceTitle).toBe("一抹鲜红");
    expect(beforeChoiceCore.currentExplorer.traits.speed).toBe(4);
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出可选择作祟检定.jpg`,
    );

    await setHarnessRandomQueue(page, [0.1, 0.1]);
    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 一抹鲜红/,
    );
    const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("作祟检定");
    const afterRollCore = await readCurrentCore(page);
    const rollDice = afterRollCore.recentRoll?.dice ?? [];
    const rollTotal =
      rollDice.reduce((sum, pip) => sum + pip, 0) +
      (afterRollCore.recentRoll?.passiveBonus ?? 0);
    const rollDiceCount = rollDice.length;
    expect(rollDiceCount).toBeGreaterThan(0);
    expect(rollTotal).toBeGreaterThanOrEqual(0);
    expect(rollTotal).toBeLessThan(
      afterRollCore.scenarioRuntime.hauntRollThreshold,
    );
    await expect(rollPanel).toContainText(`总点数 ${rollTotal}`);
    const diceGroup = discoveryPanel.getByTestId(
      "betrayal-house-dice-3d-group",
    );
    await expect(diceGroup).toHaveAttribute(
      "data-dice-count",
      String(rollDiceCount),
    );
    await expect(diceGroup).toHaveAttribute(
      "data-dice-rule-subtotal",
      String(rollTotal),
    );
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, {
      minDiceCount: rollDiceCount,
    });
    await saveScreenshot(
      page,
      `${screenshotBase}-04-选择作祟检定后骰盘停稳.jpg`,
    );

    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText(`作祟检定 ${rollTotal}`);
    await expect(discoveryDetail).toContainText("速度 +1");
    await expect(discoveryDetail).not.toContainText("物理伤害");
    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.pendingEventChoice).toBeNull();
    expect(afterSettleCore.phase).toBe("preHaunt");
    expect(afterSettleCore.scenarioRuntime.hauntTriggered).toBe(false);
    const settledRollTotal =
      (afterSettleCore.recentRoll?.dice ?? []).reduce(
        (sum, pip) => sum + pip,
        0,
      ) + (afterSettleCore.recentRoll?.passiveBonus ?? 0);
    expect(settledRollTotal).toBeLessThan(
      afterSettleCore.scenarioRuntime.hauntRollThreshold,
    );
    expect(afterSettleCore.currentExplorer.traits.speed).toBe(5);
    expect(afterSettleCore.recentRoll?.sourceTitle).toBe("一抹鲜红");
    await saveScreenshot(page, `${screenshotBase}-05-速度奖励结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后回牌桌.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-一抹鲜红-完整链路", diagnostics },
    ]);
  });

  test("吊死鬼真实链路从探索翻牌到四项检定后选奖励关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-吊死鬼-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/吊死鬼-完整链路`;
    const hangingTree = eventByName("吊死鬼");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [hangingTree];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        might: 3,
        speed: 3,
        knowledge: 3,
        sanity: 3,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await setHarnessRandomQueue(page, Array(12).fill(0.99));
    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "吊死鬼");
    await expect(eventChoicePanel).toHaveAttribute(
      "data-surface",
      "open-table",
    );
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-recent-roll-panel")).toHaveCount(0);
    const allTraitPanel = page.getByTestId(
      "betrayal-event-choice-all-trait-check",
    );
    await expect(allTraitPanel).toBeVisible();
    for (const [trait, label] of [
      ["might", "力量"],
      ["speed", "速度"],
      ["knowledge", "知识"],
      ["sanity", "神志"],
    ] as const) {
      const row = page.getByTestId(
        `betrayal-event-choice-all-trait-check-${trait}`,
      );
      await expect(row).toContainText(label);
      await expect(row).toContainText("6 / 通过");
    }
    for (const trait of ["might", "speed", "knowledge", "sanity"]) {
      await expect(
        page.getByTestId(`betrayal-event-choice-trait-${trait}`),
      ).toBeVisible();
    }
    const beforeRewardCore = await readCurrentCore(page);
    expect(beforeRewardCore.pendingEventChoice?.sourceTitle).toBe("吊死鬼");
    expect(
      beforeRewardCore.recentAllTraitCheck?.results.every(
        (result) => result.passed,
      ),
    ).toBe(true);
    expect(beforeRewardCore.currentExplorer.traits.knowledge).toBe(3);
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toBeDisabled();
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出四项检定全过.jpg`,
    );

    await page.getByTestId("betrayal-event-choice-trait-knowledge").click();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).not.toBeDisabled();
    await saveScreenshot(page, `${screenshotBase}-04-选择知识奖励.jpg`);

    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    await expect(discoveryPanel).toHaveAttribute("aria-label", /事件牌 吊死鬼/);
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("每项属性均通过");
    await expect(discoveryDetail).toContainText("知识 +1");
    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.pendingEventChoice).toBeNull();
    expect(afterSettleCore.currentExplorer.traits.knowledge).toBe(4);
    await saveScreenshot(page, `${screenshotBase}-05-知识奖励结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后回牌桌.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-吊死鬼-完整链路", diagnostics },
    ]);
  });

  test("外星几何真实链路从探索翻牌到自动投骰结算关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-外星几何-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/外星几何-完整链路`;
    const alienGeometry = eventByName("外星几何");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [alienGeometry];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        knowledge: 3,
        speed: 4,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await setHarnessRandomQueue(page, [0.99, 0.99, 0.99]);
    await page.getByTestId("betrayal-room-ground-north").click();
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 外星几何/,
    );
    await expect(
      page.getByTestId("betrayal-discovery-card-front-atlas"),
    ).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("知识检定");
    await expect(discoveryDetail).toContainText("获得 1 点知识");
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出已有知识检定.jpg`,
    );

    const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("知识检定");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-count", "3");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-subtotal", "6");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await saveScreenshot(page, `${screenshotBase}-04-骰盘停稳直接结算.jpg`);

    await expect(discoveryDetail).toContainText("获得 1 点知识");
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await saveScreenshot(page, `${screenshotBase}-05-结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-action-explore")).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-外星几何-完整链路", diagnostics },
    ]);
  });

  for (const directRollCase of directRollFullChainCases) {
    test(`${directRollCase.title}真实链路从探索翻牌到投骰结算关闭`, async ({
      page,
    }) => {
      await runDirectRollEventFullChain(page, directRollCase);
    });
  }

  test("盔甲真实链路从电话铃声翻牌到物理伤害减伤结算关闭", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-盔甲物理减伤完整链路",
    );
    const screenshotBase = ARMOR_EVIDENCE_DIR;
    const phoneCall = eventByName("电话铃声");
    const armorCard = BETRAYAL_DISCOVERY_POOLS.possessions.omen.find(
      (card) => card.id === "armor",
    );
    if (!armorCard) {
      throw new Error("山屋预兆池缺少盔甲");
    }
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [phoneCall];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        might: 4,
        speed: 4,
        knowledge: 4,
        sanity: 4,
      },
      inventory: [{ ...armorCard }],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.turnStartInventoryCardIds = ["armor"];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    const armorShell = page.getByTestId("betrayal-inventory-armor-shell");
    await expect(armorShell).toBeVisible();
    await expect(armorShell).toHaveAttribute(
      "data-rules-summary",
      /受到物理伤害 -1/,
    );
    const beforeCore = await readCurrentCore(page);
    const physicalBefore = physicalTraitTotal(beforeCore, "0");
    expect(physicalBefore).toBe(8);
    await saveScreenshot(
      page,
      `${screenshotBase}/01-盔甲减伤前牌桌可操作.jpg`,
    );

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}/02-选择未知房间前.jpg`);

    await setHarnessRandomQueue(page, [0, 0, 0.99, 0.99]);
    await page.getByTestId("betrayal-room-ground-north").click();
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 电话铃声/,
    );
    await expect(
      page.getByTestId("betrayal-discovery-card-front-atlas"),
    ).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("投 2 颗骰子 0");
    await expect(discoveryDetail).toContainText("受到两颗骰子的物理伤害");
    await saveScreenshot(
      page,
      `${screenshotBase}/03-电话铃声翻出并显示物理伤害分支.jpg`,
    );

    const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("投 2 颗骰子");
    await expect(rollPanel).toContainText("总点数 0");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-count", "2");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-subtotal", "0");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 2 });
    await saveScreenshot(
      page,
      `${screenshotBase}/04-物理伤害骰盘停稳.jpg`,
    );

    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.recentRoll?.eventEffectSnapshot?.damageRolls).toEqual(
      [2, 2],
    );
    expect(physicalTraitTotal(afterSettleCore, "0")).toBe(
      physicalBefore - 3,
    );
    const armoredExplorer = [
      afterSettleCore.currentExplorer,
      ...afterSettleCore.otherExplorers,
    ].find((explorer) => explorer.playerId === "0");
    expect(armoredExplorer?.traits.might).toBe(1);
    expect(armoredExplorer?.traits.speed).toBe(4);
    await expect(discoveryDetail).toContainText("受到 2 颗骰子的物理伤害");
    await expect(armorShell).toHaveAttribute(
      "data-rules-summary",
      /受到物理伤害 -1/,
    );
    await saveScreenshot(
      page,
      `${screenshotBase}/05-盔甲减伤结算结果可见.jpg`,
    );

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    const closedCore = await readCurrentCore(page);
    expect(physicalTraitTotal(closedCore, "0")).toBe(physicalBefore - 3);
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-action-rail")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-endTurn")).toBeVisible();
    await saveScreenshot(
      page,
      `${screenshotBase}/06-关闭后回牌桌状态清空.jpg`,
    );

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-盔甲物理减伤完整链路", diagnostics },
    ]);
  });

  test("头戴耳机真实链路从电话铃声翻牌到精神伤害减伤结算关闭", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-头戴耳机精神减伤完整链路",
    );
    const screenshotBase = RADIO_EVIDENCE_DIR;
    const phoneCall = eventByName("电话铃声");
    const radioCard = BETRAYAL_DISCOVERY_POOLS.possessions.item.find(
      (card) => card.id === "radio",
    );
    if (!radioCard) {
      throw new Error("山屋物品池缺少头戴耳机");
    }
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [phoneCall];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        might: 4,
        speed: 4,
        knowledge: 4,
        sanity: 4,
      },
      inventory: [{ ...radioCard }],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.turnStartInventoryCardIds = ["radio"];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    const radioShell = page.getByTestId("betrayal-inventory-radio-shell");
    await expect(radioShell).toBeVisible();
    await expect(radioShell).toHaveAttribute(
      "data-rules-summary",
      /受到精神伤害 -1/,
    );
    const beforeCore = await readCurrentCore(page);
    const mentalBefore = mentalTraitTotal(beforeCore, "0");
    expect(mentalBefore).toBe(8);
    await saveScreenshot(
      page,
      `${screenshotBase}/01-头戴耳机减伤前牌桌可操作.jpg`,
    );

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}/02-选择未知房间前.jpg`);

    await setHarnessRandomQueue(page, [0.5, 0.5, 0.99]);
    await page.getByTestId("betrayal-room-ground-north").click();
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 电话铃声/,
    );
    await expect(
      page.getByTestId("betrayal-discovery-card-front-atlas"),
    ).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("投 2 颗骰子 2");
    await expect(discoveryDetail).toContainText("受到一颗骰子的精神伤害");
    await saveScreenshot(
      page,
      `${screenshotBase}/03-电话铃声翻出并显示精神伤害分支.jpg`,
    );

    const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("投 2 颗骰子");
    await expect(rollPanel).toContainText("总点数 2");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-count", "2");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-subtotal", "2");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 2 });
    await saveScreenshot(
      page,
      `${screenshotBase}/04-精神伤害骰盘停稳.jpg`,
    );

    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.recentRoll?.eventEffectSnapshot?.damageRolls).toEqual(
      [2],
    );
    expect(mentalTraitTotal(afterSettleCore, "0")).toBe(mentalBefore - 1);
    const protectedExplorer = [
      afterSettleCore.currentExplorer,
      ...afterSettleCore.otherExplorers,
    ].find((explorer) => explorer.playerId === "0");
    expect(protectedExplorer?.traits.knowledge).toBe(3);
    expect(protectedExplorer?.traits.sanity).toBe(4);
    await expect(discoveryDetail).toContainText("受到 1 颗骰子的精神伤害");
    await expect(radioShell).toHaveAttribute(
      "data-rules-summary",
      /受到精神伤害 -1/,
    );
    await saveScreenshot(
      page,
      `${screenshotBase}/05-头戴耳机减伤结算结果可见.jpg`,
    );

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    const closedCore = await readCurrentCore(page);
    expect(mentalTraitTotal(closedCore, "0")).toBe(mentalBefore - 1);
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-action-rail")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-endTurn")).toBeVisible();
    await saveScreenshot(
      page,
      `${screenshotBase}/06-关闭后回牌桌状态清空.jpg`,
    );

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-头戴耳机精神减伤完整链路", diagnostics },
    ]);
  });

  async function runEventTraitCheckExtraDiceFullChain(
    page: Page,
    options: {
      itemId: "flashlight" | "lantern";
      itemName: "手电筒" | "灯笼";
      evidenceDir: string;
    },
  ) {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      `betrayal-event-choice-${options.itemName}事件检定加骰完整链路`,
    );
    const alienGeometry = eventByName("外星几何");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [alienGeometry];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        knowledge: 3,
      },
      inventory: [
        { id: options.itemId, name: options.itemName, kind: "item" },
      ],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [...core.currentExplorer.inventory];
    core.turnStartInventoryCardIds = [options.itemId];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });
    const itemShell = page.getByTestId(
      `betrayal-inventory-${options.itemId}-shell`,
    );
    await expect(itemShell).toBeVisible();
    await expect(itemShell).toHaveAttribute(
      "data-rules-summary",
      /事件属性检定额外投 2 骰/,
    );
    await saveScreenshot(
      page,
      `${options.evidenceDir}/01-${options.itemName}加骰前牌桌可操作.jpg`,
    );

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(
      page,
      `${options.evidenceDir}/02-选择未知房间前.jpg`,
    );

    await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99, 0.99]);
    await page.getByTestId("betrayal-room-ground-north").click();
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible({ timeout: 30000 });
    await expect(discoveryPanel).toHaveAttribute(
      "aria-label",
      /事件牌 外星几何/,
    );
    await expect(
      page.getByTestId("betrayal-discovery-card-front-atlas"),
    ).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("知识检定 10");
    await expect(discoveryDetail).toContainText("获得 1 点知识");
    await saveScreenshot(
      page,
      `${options.evidenceDir}/03-外星几何翻出并显示5骰知识检定.jpg`,
    );

    const rollPanel = discoveryPanel.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("知识检定");
    await expect(rollPanel).toContainText("总点数 10");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-count", "5");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-subtotal", "10");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expectPhysicalDiceSeparated(rollPanel, { minDiceCount: 5 });
    await saveScreenshot(
      page,
      `${options.evidenceDir}/04-5骰事件检定骰盘停稳.jpg`,
    );

    const afterSettleCore = await readCurrentCore(page);
    expect(afterSettleCore.recentRoll?.dice).toHaveLength(5);
    expect(afterSettleCore.currentExplorer.traits.knowledge).toBe(4);
    await expect(itemShell).toHaveAttribute(
      "data-rules-summary",
      /事件属性检定额外投 2 骰/,
    );
    await saveScreenshot(
      page,
      `${options.evidenceDir}/05-加骰结算结果可见.jpg`,
    );

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    const closedCore = await readCurrentCore(page);
    expect(closedCore.currentExplorer.traits.knowledge).toBe(4);
    await expect(
      page.getByTestId("betrayal-room-occupant-ground-north-0"),
    ).toBeVisible();
    await expect(page.getByTestId("betrayal-action-rail")).toBeVisible();
    await expect(page.getByTestId("betrayal-action-endTurn")).toBeVisible();
    await saveScreenshot(
      page,
      `${options.evidenceDir}/06-关闭后回牌桌状态清空.jpg`,
    );

    assertNoFatalFrontendErrors([
      {
        label: `betrayal-event-choice-${options.itemName}事件检定加骰完整链路`,
        diagnostics,
      },
    ]);
  }

  test("手电筒真实链路从外星几何翻牌到事件检定额外加骰结算关闭", async ({
    page,
  }) => {
    await runEventTraitCheckExtraDiceFullChain(page, {
      itemId: "flashlight",
      itemName: "手电筒",
      evidenceDir: FLASHLIGHT_EVIDENCE_DIR,
    });
  });

  test("灯笼真实链路从外星几何翻牌到事件检定额外加骰结算关闭", async ({
    page,
  }) => {
    await runEventTraitCheckExtraDiceFullChain(page, {
      itemId: "lantern",
      itemName: "灯笼",
      evidenceDir: LANTERN_EVIDENCE_DIR,
    });
  });

  test("一条秘密通道真实链路从探索翻牌到检定后选房间结算关闭", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-一条秘密通道-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/一条秘密通道-完整链路`;
    const secretPassage = eventByName("一条秘密通道");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [secretPassage];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        knowledge: 4,
        sanity: 4,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute(
      "aria-label",
      "一条秘密通道",
    );
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("知识检定");
    await expect(rollPanel).toContainText(
      "在任意另一板块放置另一个秘密通道标志物",
    );
    await expect(
      page.getByTestId("betrayal-room-event-choice-target-hallway"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toBeDisabled();
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出已有知识检定.jpg`,
    );

    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).not.toBeDisabled();
    await expect(
      page.getByTestId("betrayal-room-event-choice-target-hallway"),
    ).toBeVisible();
    await saveScreenshot(
      page,
      `${screenshotBase}-04-选择门厅作为第二秘密通道.jpg`,
    );

    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("在当前板块放置秘密通道标志物");
    await expect(discoveryDetail).toContainText("在门厅放置秘密通道标志物");
    await expect(discoveryDetail).toContainText("知识 +1");
    await expect(
      page.getByTestId("betrayal-room-marker-ground-north-secret-passage"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-marker-hallway-secret-passage"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-05-结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("betrayal-room-marker-ground-north-secret-passage"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-marker-hallway-secret-passage"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-一条秘密通道-完整链路", diagnostics },
    ]);
  });

  test("脑状食品真实链路从探索翻牌到检定后选属性结算关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-脑状食品-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/脑状食品-完整链路`;
    const brainFood = eventByName("脑状食品");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [brainFood];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        might: 4,
        speed: 4,
        sanity: 4,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await setHarnessRandomQueue(page, [0.99, 0.99, 0.99, 0.99]);
    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "脑状食品");
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("力量检定");
    await expect(rollPanel).toContainText("总点数 8");
    await expect(rollPanel).toContainText("获得 1 点力量或速度");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-count", "4");
    await expect(
      page.getByTestId("betrayal-house-dice-3d-group"),
    ).toHaveAttribute("data-dice-rule-subtotal", "8");
    await expectVisiblePhysicalDiceBox(rollPanel);
    await waitForPhysicalDiceSettled(rollPanel);
    await expect(
      page.getByTestId("betrayal-event-choice-trait-might"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-trait-speed"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).toBeDisabled();
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出已有力量检定.jpg`,
    );

    await page.getByTestId("betrayal-event-choice-trait-speed").click();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).not.toBeDisabled();
    await saveScreenshot(page, `${screenshotBase}-04-选择速度奖励.jpg`);

    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("速度 +1");
    await saveScreenshot(page, `${screenshotBase}-05-结算结果可见.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-discovery-panel")).toHaveCount(0);
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-action-explore")).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-脑状食品-完整链路", diagnostics },
    ]);
  });

  test("蜘蛛真实链路从探索翻牌到已有检定再选择结算关闭", async ({ page }) => {
    test.setTimeout(120000);
    const diagnostics = attachPageDiagnostics(
      page,
      "betrayal-event-choice-蜘蛛-完整链路",
    );
    const screenshotBase = `${EVIDENCE_DIR}/蜘蛛-完整链路`;
    const spider = eventByName("蜘蛛！");
    const core = createRuntimeCore();
    core.drawOrder = ["event"];
    core.eventOrder = [spider];
    core.currentExplorer = {
      ...core.currentExplorer,
      traits: {
        ...core.currentExplorer.traits,
        sanity: 4,
        speed: 4,
      },
      inventory: [],
    };
    core.currentExplorerTraits = { ...core.currentExplorer.traits };
    core.currentExplorerInventory = [];

    await injectCore(page, core);
    await expect(page.getByTestId("betrayal-board")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("betrayal-action-move").click();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-room-ground-north"),
    ).toHaveAccessibleName(/未探索.*一层.*可探索/);
    await expect(page.getByTestId("betrayal-action-explore")).toBeEnabled();
    await saveScreenshot(page, `${screenshotBase}-01-探索前.jpg`);

    await page.getByTestId("betrayal-action-explore").click();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-north"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-room-explore-target-ground-south"),
    ).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-02-选择未知房间.jpg`);

    await setHarnessRandomQueue(page, [0.6, 0.6, 0.6, 0.6]);
    await page.getByTestId("betrayal-room-ground-north").click();
    const eventChoicePanel = page.getByTestId("betrayal-event-choice-panel");
    await expect(eventChoicePanel).toHaveAttribute("aria-label", "蜘蛛！");
    await expect(
      page.getByTestId("betrayal-event-choice-card-front-atlas"),
    ).toBeVisible();
    const rollPanel = page.getByTestId("betrayal-recent-roll-panel");
    await expect(rollPanel).toBeVisible();
    await expect(rollPanel).toContainText("神志检定");
    await expect(rollPanel).toContainText("总点数 4");
    await expect(rollPanel).toContainText("获得 1 点神志或速度");
    await expect(
      page.getByTestId("betrayal-event-choice-trait-sanity"),
    ).toBeVisible();
    await expect(
      page.getByTestId("betrayal-event-choice-trait-speed"),
    ).toBeVisible();
    await saveScreenshot(
      page,
      `${screenshotBase}-03-事件牌翻出已有神志检定.jpg`,
    );

    await page.getByTestId("betrayal-event-choice-trait-speed").click();
    await expect(
      page.getByTestId("betrayal-room-event-choice-target-hallway"),
    ).toBeVisible();
    await page.getByTestId("betrayal-room-hallway").click();
    await expect(
      page.getByTestId("betrayal-event-choice-confirm"),
    ).not.toBeDisabled();
    await saveScreenshot(page, `${screenshotBase}-04-选择速度和相邻房间.jpg`);

    await page.getByTestId("betrayal-event-choice-confirm").click();
    await expect(eventChoicePanel).toBeHidden({ timeout: 30000 });
    const discoveryPanel = page.getByTestId("betrayal-discovery-panel");
    await expect(discoveryPanel).toBeVisible();
    const discoveryDetail = page.getByTestId("betrayal-discovery-detail");
    await expect(discoveryDetail).toContainText("速度 +1");
    await expect(discoveryDetail).toContainText("放置到门厅");
    await saveScreenshot(page, `${screenshotBase}-05-结算后.jpg`);

    await dismissDiscoveryPanel(page);
    await expect(page.getByTestId("betrayal-board")).toBeVisible();
    await expect(page.getByTestId("betrayal-event-choice-panel")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("betrayal-room-hallway")).toBeVisible();
    await saveScreenshot(page, `${screenshotBase}-06-关闭后.jpg`);

    assertNoFatalFrontendErrors([
      { label: "betrayal-event-choice-蜘蛛-完整链路", diagnostics },
    ]);
  });
});
