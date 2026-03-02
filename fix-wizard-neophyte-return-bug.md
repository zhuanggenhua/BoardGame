# 修复：法师学徒返回手牌后第二次打出不触发效果

## 问题描述

法师学徒（wizard_neophyte）被外星人光束（alien_beam_up）等卡牌返回手牌后，第二次打出时不触发 `onPlay` 能力（不弹出"选择放入手牌或作为额外行动打出"的交互）。

## 游戏规则说明

根据大杀四方官方规则，当随从返回手牌时：
1. 随从本身返回所有者手牌
2. 附着在该随从上的行动卡回到各自所有者的弃牌堆（与随从被摧毁时的处理一致）

这是因为行动卡附着在"场上的随从"上，随从返回手牌后不再是"场上的随从"，行动卡失去附着目标，必须进入弃牌堆。

详见 `src/games/smashup/rule/大杀四方规则.md` 中"附着行动卡离场规则"一节。

## 根本原因

`postProcessSystemEvents` 函数使用 `matchState.sys._processedPlayedEvents` 集合记录已处理的 `MINION_PLAYED` 事件，防止重复触发 `onPlay` 能力。

去重标记的格式是 `MINION:${cardUid}@${baseIndex}`，基于卡牌的 `uid` 和基地索引。

**问题**：当卡牌返回手牌后再次打出时，`cardUid` 不变，所以被判定为"已处理过"，直接跳过了 `onPlay` 触发。

## 修复方案

### 方案选择：清理去重标记 vs 重新生成 uid

**方案 1：清理去重标记（✅ 采用）**
- 在 `postProcessSystemEvents` 中检测 `MINION_RETURNED` 事件，删除对应的去重标记
- 优点：保持 `uid` 稳定，便于追踪卡牌生命周期和调试
- 缺点：需要在所有"卡牌离开场上"的场景清理标记

**方案 2：返回手牌时重新生成 uid（❌ 不采用）**
- 在 `MINION_RETURNED` reducer 中生成新的 `uid`
- 优点：自动解决所有去重问题
- 缺点：
  - 破坏 `uid` 的追踪能力（无法识别"这是之前那张牌"）
  - 可能破坏依赖 `uid` 的机制（如历史记录、某些能力的目标记录）
  - 大量测试会失败（测试用固定 `uid` 断言）

**结论**：`uid` 在项目中是卡牌实例的唯一标识符，类似"身份证号"。改变 `uid` 会破坏追踪能力和现有机制，因此选择方案 1。

### 修改文件

1. `src/games/smashup/domain/index.ts` — 清理去重标记
2. `src/games/smashup/domain/reduce.ts` — 修复附着行动卡处理（额外发现的 bug）

### 修改内容

#### 1. 清理去重标记（`index.ts`）

在处理事件循环之前，添加清理逻辑：

```typescript
// 【修复】清理返回手牌的随从的去重标记
// 当随从返回手牌后再次打出时，应该重新触发 onPlay 能力
for (const event of afterAffect.events) {
    if (event.type === SU_EVENTS.MINION_RETURNED) {
        const returnedEvt = event as { type: string; payload: { minionUid: string; fromBaseIndex: number } };
        const eventKey = `MINION:${returnedEvt.payload.minionUid}@${returnedEvt.payload.fromBaseIndex}`;
        processedSet.delete(eventKey);
    }
}
```

#### 2. 修复附着行动卡处理（`reduce.ts`）

**说明**：`MINION_RETURNED` reducer 原本没有处理附着的行动卡。根据游戏规则，随从返回手牌时，附着的行动卡应该进入各自所有者的弃牌堆（与 `MINION_DESTROYED` 逻辑一致）。这不是 bug，而是规则的正确实现。

```typescript
// 附着的行动卡回各自所有者弃牌堆（与 MINION_DESTROYED 逻辑一致）
if (minion) {
    for (const attached of minion.attachedActions) {
        const attachedOwner = newPlayers[attached.ownerId];
        if (attachedOwner) {
            const attachedCard: CardInstance = {
                uid: attached.uid,
                defId: attached.defId,
                type: 'action',
                owner: attached.ownerId,
            };
            newPlayers = {
                ...newPlayers,
                [attached.ownerId]: { ...newPlayers[attached.ownerId], discard: [...newPlayers[attached.ownerId].discard, attachedCard] },
            };
        }
    }
}
```

## 影响范围

- 所有被返回手牌的随从（不限于法师学徒）
- 包括：外星人光束、至高霸主、收集者、麦田怪圈、忍者伪装等返回随从的卡牌
- 附着行动卡的处理修复影响所有有附着行动卡的随从被返回手牌的场景

## 测试建议

1. **基础场景**：
   - 打出法师学徒（牌库顶是行动卡）→ 触发交互
   - 用外星人光束返回法师学徒到手牌
   - 再次打出法师学徒（牌库顶是行动卡）→ 应该再次触发交互

2. **附着行动卡场景**：
   - 打出随从，附着一张行动卡（如 dino_tooth_and_claw）
   - 用外星人光束返回该随从到手牌
   - 验证：附着的行动卡进入拥有者弃牌堆，随从返回手牌时不带附着卡

## 相关代码位置

- 去重逻辑：`src/games/smashup/domain/index.ts` 第 1045-1053 行
- 法师学徒能力：`src/games/smashup/abilities/wizards.ts` 第 76-107 行
- MINION_RETURNED reducer：`src/games/smashup/domain/reduce.ts` 第 571-620 行
- MINION_DESTROYED reducer（参考）：`src/games/smashup/domain/reduce.ts` 第 660-710 行
