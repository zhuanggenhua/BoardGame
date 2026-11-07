import { describe, expect, it } from "vitest";

import type { BetrayalCore } from "../game";
import { buildScenarioReaderPages, resolveActiveHauntDossier, resolveScenarioReaderOpenPlan, resolveScenarioReaderScope } from "../scenarioReader";
import { SPECTATOR_PLAYER_ID } from "../../../engine/playerView";

const createHauntCore = (
  overrides: Partial<BetrayalCore> = {},
): BetrayalCore =>
  ({
    phase: "haunt",
    latestDiscovery: {
      kind: "omen",
      title: "剧本",
      summary: "作祟开始",
      detail: "最后一张预兆触发作祟，进入英雄阅读流程。",
      tone: "warning",
    },
    scenarioRuntime: {
      hauntTriggered: true,
      traitorPlayerId: "1",
      hauntTraitorResolution: {
        teamModel: "one-traitor",
      },
    },
    ...overrides,
  }) as BetrayalCore;

describe("Betrayal scenario reader open plan", () => {
  it("旁观者只读公开段落，不继承当前玩家的阵营", () => {
    const core = createHauntCore();
    const scope = resolveScenarioReaderScope(core, SPECTATOR_PLAYER_ID);
    expect(scope).toBe("public");
    const pages = buildScenarioReaderPages(resolveActiveHauntDossier(core), scope);
    const sections = pages.flatMap((page) => page.sections ?? []);
    expect(sections.every((section) => section.audiences.includes("all"))).toBe(true);
    expect(sections.some((section) => !section.audiences.includes("all"))).toBe(false);
  });

  it("作祟首次打开私密英雄阅读流程时先停在开场过场", () => {
    const plan = resolveScenarioReaderOpenPlan(createHauntCore(), "0", {
      mode: "hauntReveal",
      hasOpeningSection: true,
      bookSpreadCount: 1,
    });

    expect(plan).toMatchObject({
      scope: "heroes",
      includeOpeningStage: true,
      initialBookSpreadIndex: 0,
      bookSpreadCount: 1,
    });
  });

  it("作祟后从剧本入口回看时只打开目标页，不重新插入开场", () => {
    const plan = resolveScenarioReaderOpenPlan(createHauntCore(), "0", {
      mode: "manualReview",
      hasOpeningSection: true,
      bookSpreadCount: 1,
    });

    expect(plan).toMatchObject({
      scope: "heroes",
      includeOpeningStage: false,
      initialBookSpreadIndex: 0,
      bookSpreadCount: 1,
    });
  });

  it("非作祟读本不强行插入开场页", () => {
    const plan = resolveScenarioReaderOpenPlan(
      createHauntCore({
        phase: "preHaunt",
        scenarioRuntime: {
          hauntTriggered: false,
          traitorPlayerId: null,
        },
      } as Partial<BetrayalCore>),
      "0",
      {
        mode: "manualReview",
        hasOpeningSection: true,
        bookSpreadCount: 1,
      },
    );

    expect(plan).toMatchObject({
      scope: "all",
      includeOpeningStage: false,
      initialBookSpreadIndex: 0,
      bookSpreadCount: 1,
    });
  });
});
