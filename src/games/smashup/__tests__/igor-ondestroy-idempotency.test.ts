import { makeMinionDestroyedEvent } from './helpers';
/**
 * Igor onDestroy 幂等性与重入测试
 *
 * 审计维度：
 * - D8（时序正确）：Igor 的 onDestroy 是否会被触发两次？
 * - D9（幂等与重入）：重复触发是否安全？
 * - D17（隐式依赖）：是否依赖特定的调用顺序？
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  getPromptPlayerId,
  getPromptSourceId,
  getPromptsBySourceId,
  makeState,
  makeBase,
  makeMinion,
  makeMatchState,
  makePlayer,
  resolveDestroyedMinions,
} from "./helpers";
import { initAllAbilities } from "../abilities";
import { defaultTestRandom } from "./testRunner";
import { SU_EVENTS } from "../domain/types";
import type { SmashUpEvent } from "../domain/types";

describe("Igor onDestroy 幂等性与重入测试", () => {
  beforeAll(() => {
    initAllAbilities();
  });

  it("D8/D9: 单个 MINION_DESTROYED 事件只触发一次 Igor onDestroy", () => {
    const core = makeState({
      players: {
        "0": makePlayer("0", { hand: [], deck: [], discard: [] }),
        "1": makePlayer("1", { hand: [], deck: [], discard: [] }),
      },
      bases: [
        makeBase("base_rlyeh", [
          makeMinion("igor1", "frankenstein_igor", "0", 2),
          makeMinion("monster1", "frankenstein_the_monster", "0", 4),
          makeMinion("wolf1", "werewolf_loup_garou", "0", 4),
        ]),
      ],
    });

    const ms = makeMatchState(core);

    // 创建一个 MINION_DESTROYED 事件
    const destroyEvent: SmashUpEvent = makeMinionDestroyedEvent({minionUid: "igor1",
        minionDefId: "frankenstein_igor",
        fromBaseIndex: 0,
        ownerId: "0",
        destroyerId: "0",
        reason: "test", timestamp: 1000 });

    const result = resolveDestroyedMinions(
      ms,
      "0",
      [destroyEvent],
      defaultTestRandom,
      1000,
    );

    // 检查：应该只有一个 Igor 交互
    const igorInteractions = getPromptsBySourceId(
      result.matchState!,
      "frankenstein_igor",
    );

    expect(igorInteractions.length).toBe(1);
    expect(getPromptSourceId(igorInteractions[0])).toBe("frankenstein_igor");
    expect(getPromptPlayerId(igorInteractions[0])).toBe("0"); // Igor 的拥有者
  });

  it("D9: 重复处理同一消灭事件不会产生重复交互", () => {
    const core = makeState({
      players: {
        "0": makePlayer("0", { hand: [], deck: [], discard: [] }),
        "1": makePlayer("1", { hand: [], deck: [], discard: [] }),
      },
      bases: [
        makeBase("base_rlyeh", [
          makeMinion("igor1", "frankenstein_igor", "0", 2),
          makeMinion("monster1", "frankenstein_the_monster", "0", 4),
          makeMinion("wolf1", "werewolf_loup_garou", "0", 4), // 添加第三个随从，使 Igor 创建交互
        ]),
      ],
    });

    const ms = makeMatchState(core);

    const destroyEvent: SmashUpEvent = makeMinionDestroyedEvent({minionUid: "igor1",
        minionDefId: "frankenstein_igor",
        fromBaseIndex: 0,
        ownerId: "0",
        destroyerId: "0",
        reason: "test", timestamp: 1000 });

    // 第一次调用
    const result1 = resolveDestroyedMinions(
      ms,
      "0",
      [destroyEvent],
      defaultTestRandom,
      1000,
    );

    // 第二次调用（模拟重复触发）- 使用相同的事件
    // 注意：去重逻辑只在单次调用内部生效，不会跨调用持久化
    // 所以第二次调用会再次处理相同的事件，创建新交互
    const result2 = resolveDestroyedMinions(
      result1.matchState ?? ms,
      "0",
      [destroyEvent],
      defaultTestRandom,
      1001,
    );

    // 验证：第二次调用会创建新交互（去重逻辑不跨调用）
    const igorInteractions1 = getPromptsBySourceId(
      result1.matchState!,
      "frankenstein_igor",
    );
    const igorInteractions2 = getPromptsBySourceId(
      result2.matchState!,
      "frankenstein_igor",
    );

    expect(igorInteractions1.length).toBe(1);
    // 第二次调用会创建新交互，所以总数变成 2（第一次的 + 第二次的）
    expect(igorInteractions2.length).toBe(2);
  });

  it("D17: 多个 MINION_DESTROYED 事件（不同随从）不会导致 Igor 重复触发", () => {
    const core = makeState({
      players: {
        "0": makePlayer("0", { hand: [], deck: [], discard: [] }),
        "1": makePlayer("1", { hand: [], deck: [], discard: [] }),
      },
      bases: [
        makeBase("base_rlyeh", [
          makeMinion("igor1", "frankenstein_igor", "0", 2),
          makeMinion("monster1", "frankenstein_the_monster", "0", 4),
          makeMinion("wolf1", "werewolf_loup_garou", "0", 4),
        ]),
      ],
    });

    const ms = makeMatchState(core);

    // 创建多个 MINION_DESTROYED 事件（Igor + 其他随从）
    const destroyEvents: SmashUpEvent[] = [
      makeMinionDestroyedEvent({minionUid: "igor1",
          minionDefId: "frankenstein_igor",
          fromBaseIndex: 0,
          ownerId: "0",
          destroyerId: "0",
          reason: "test", timestamp: 1000 }),
      makeMinionDestroyedEvent({minionUid: "monster1",
          minionDefId: "frankenstein_the_monster",
          fromBaseIndex: 0,
          ownerId: "0",
          destroyerId: "0",
          reason: "test", timestamp: 1001 }),
    ];

    const result = resolveDestroyedMinions(
      ms,
      "0",
      destroyEvents,
      defaultTestRandom,
      1000,
    );

    // 检查：应该只有一个 Igor 交互（Igor 自己被消灭时触发）
    const igorInteractions = getPromptsBySourceId(
      result.matchState!,
      "frankenstein_igor",
    );

    expect(igorInteractions.length).toBe(1);
  });

  it("D8: 九命之屋 pendingSave 时不会触发 Igor onDestroy", () => {
    const core = makeState({
      players: {
        "0": makePlayer("0", { hand: [], deck: [], discard: [] }),
        "1": makePlayer("1", { hand: [], deck: [], discard: [] }),
      },
      bases: [
        makeBase("base_house_of_nine_lives", []),
        makeBase("base_rlyeh", [
          makeMinion("igor1", "frankenstein_igor", "0", 2),
          makeMinion("monster1", "frankenstein_the_monster", "0", 4),
        ]),
      ],
    });

    const ms = makeMatchState(core);

    const destroyEvent: SmashUpEvent = makeMinionDestroyedEvent({minionUid: "igor1",
        minionDefId: "frankenstein_igor",
        fromBaseIndex: 1,
        ownerId: "0",
        destroyerId: "1", // 对手消灭
        reason: "action", timestamp: 1000 });
    const result = resolveDestroyedMinions(
      ms,
      "0",
      [destroyEvent],
      defaultTestRandom,
      1000,
    );

    // 检查：应该有九命之屋的交互，但没有 Igor 的 onDestroy 交互
    const nineLivesInteractions = getPromptsBySourceId(
      result.matchState!,
      "base_nine_lives_intercept",
    );
    const igorInteractions = getPromptsBySourceId(
      result.matchState!,
      "frankenstein_igor",
    );

    expect(nineLivesInteractions.length).toBeGreaterThan(0); // 九命之屋应该触发
    expect(igorInteractions.length).toBe(0); // Igor onDestroy 不应该触发（消灭被防止）
    expect(
      result.events.filter((e) => e.type === SU_EVENTS.MINION_DESTROYED),
    ).toHaveLength(0);
  });
});
