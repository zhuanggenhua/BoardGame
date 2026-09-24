import { describe, expect, it } from "vitest";

import { resolveDisplayedDiscoveryDetail } from "../latestDiscoverySurface";
import type {
  BetrayalDiscoveryResolutionStep,
  BetrayalDiscoverySummary,
} from "../game";

const discovery = (detail: string): BetrayalDiscoverySummary => ({
  kind: "omen",
  title: "书本",
  summary: "预兆牌",
  detail,
});

describe("latest discovery visible detail", () => {
  it("保留作祟检定和投骰数量，但不重复展示具体掷骰结果", () => {
    const visibleDetail = resolveDisplayedDiscoveryDetail(
      discovery(
        "抽到预兆后进行作祟检定：总点数 4（3 颗骰子，未触发）；判定要求（总点数）：达到 5 点：作祟开始 · 达到 0 点：未触发作祟",
      ),
      [] as readonly BetrayalDiscoveryResolutionStep[],
    );

    expect(visibleDetail).toContain("作祟检定");
    expect(visibleDetail).toContain("投 3 颗骰子");
    expect(visibleDetail).toContain("判定要求");
    expect(visibleDetail).toContain("达到 5 点");
    expect(visibleDetail).not.toContain("总点数 4");
    expect(visibleDetail).not.toContain("未触发）");
  });

  it("保留投骰流程名称，不重复展示事件卡里的具体骰面结果", () => {
    const visibleDetail = resolveDisplayedDiscoveryDetail(
      discovery("知识检定；投 2 颗骰子 6：获得 1 点知识"),
      [] as readonly BetrayalDiscoveryResolutionStep[],
    );

    expect(visibleDetail).toContain("知识检定");
    expect(visibleDetail).toContain("投 2 颗骰子");
    expect(visibleDetail).toContain("获得 1 点知识");
    expect(visibleDetail).not.toContain("投 2 颗骰子 6");
  });
});
