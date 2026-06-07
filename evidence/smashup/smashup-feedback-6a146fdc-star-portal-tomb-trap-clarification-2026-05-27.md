# SmashUp 反馈 6a146fdc 复核结论（2026-05-27）

- 反馈 ID：`6a146fdc94b5e7f2607c25aa`
- 游戏：`smashup`
- 来源：`feedback-modal`
- 反馈原文：`这个基地描述不是抽1张吗？埋一张下去好像抽了2张`

## 生产现场

- 生产反馈快照显示当时场上基地包含：
  - `base_boneyard`
  - `base_antarctic_base`
  - `base_star_portal_pod`
- `base_star_portal_pod` 上已有埋葬牌：
  - `ancient_egyptians_tomb_trap_pod`
- 反馈对应 `actionLog` 尾段为：
  - `游客1673: 战术卡施放： 墓穴陷阱`
  - `游客1673: 游客1673 抽1张牌`
  - `游客1673: 游客1673 抽1张牌`

## 复核结论

- 这条不是新的规则 bug。
- `Tomb Trap` 是“打到基地并把自己埋到该基地”的行动牌。
- `Star Portal` 的基地文本同时监听两件事：
  - 有牌被埋到这里
  - 有行动牌打到这个基地
- 所以当 `Tomb Trap` 打在 `base_star_portal_pod` 上时，会先因为“行动牌打到此基地”抓 `1`，再因为“该牌被埋到这里”再抓 `1`，总计抓 `2`。

## 规则依据

- 项目当前基地文案：
  - `public/locales/en/game-smashup.json`
    - `base_star_portal`: `After a card is buried here or an action is played on this base, its controller draws a card.`
  - `public/locales/zh-CN/game-smashup.json`
    - `base_star_portal`: `每当一张牌被埋葬于本基地或对本基地打出一张战术，其控制者抓 1 张牌。`
- 外部规则页：
  - `Burying` 说明 `Tomb Trap` 这类牌在打出并埋葬时，既属于打出行动牌，也会发生埋葬事件。
  - `Bases FAQ / Oops, You Did It Again` 说明 `Star Portal` 的触发点就是“埋葬到这里”或“行动牌打到这里”。

## 代码与测试依据

- 代码实现：
  - `src/games/smashup/abilities/ancient_egyptians.ts`
  - `base_star_portal` / `base_star_portal_pod` 通过 POD alias 同时具备：
    - `onActionPlayed -> draw 1`
    - `onCardBuried -> draw 1`
- 新增定向回归：
  - `src/games/smashup/__tests__/bases/ancient-egyptian-bases.test.ts`
  - 用例：`base_star_portal_pod 上打出并自埋 Tomb Trap 时，应同时触发 onActionPlayed 与 onCardBuried 各抓一张`

## 验证

命令：

```bash
npx vitest run src/games/smashup/__tests__/bases/ancient-egyptian-bases.test.ts --configLoader native --environment node
```

结果：

- `1` 个测试文件通过
- `5` 条测试通过
- 其中新增用例确认 `CARDS_DRAWN` 事件为 `2` 次，且都属于同一名玩家

## 结论

- 该反馈可按“规则正常，用户误判为 bug”收口。
- 不需要修改正式实现；本轮只补了定向回归测试，防止后续把正确的双触发误改成单触发。
