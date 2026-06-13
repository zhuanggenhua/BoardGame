# SmashUp 3 条人类 open 反馈当前树归档关闭（2026-06-07）

## 范围

- 目标反馈：
  - `6a23c5483f06ad518a7dec15`：`结界有bug吧，或者怎么变成我-1它+1`
  - `6a2399988bfd75951e98409b`：`弃牌堆bug`
  - `6a2399038bfd75951e984093`：`test`
- 游戏：`smashup`
- 目标环境：生产 `boardgame.feedbacks`

## 结论口径

- 这 3 条本轮都不按 `resolved` 收口。
- 更准确的口径都是：`当前树已恢复 / 不是现存代码 bug`，因此按 `closed` 归档关闭。
- 关闭理由统一使用：
  - `当前树已恢复：按反馈链路复核，当前版本未复现同症状，归档关闭。`

## 分条结论

### 1. 结界反馈

- 反馈：`6a23c5483f06ad518a7dec15`
- 真相源：
  - `temp/feedback-6a23c5483f06ad518a7dec15.raw.json`
  - `public/locales/zh-CN/game-smashup.json`
  - `src/games/smashup/__tests__/abilities/fairies.test.ts`
- 结论：
  - 《结界》在该局面里是统一给基地内所有随从 `-1`，不是“我方 -1、敌方 +1”。
  - 对方 `Puck` 同时还叠了《雏菊花环》，所以视觉上会呈现“结界 -1 之后又额外 +2，最终像 +1”。
  - 这更像规则叠加理解差异，不是当前实现 bug。

### 2. 弃牌堆反馈

- 反馈：`6a2399988bfd75951e98409b`
- 真相源：
  - `temp/feedback-6a2399988bfd75951e98409b.raw.json`
  - `src/games/smashup/abilities/yuanhou.ts`
  - `src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`
- 结论：
  - 触发的是《时间掠夺者》，它只看**触发者自己的弃牌堆**。
  - 原始反馈包里，触发者 `AI 2 号位` 当时自己的弃牌堆只有 1 张《静滞立场》；更早两次触发时给出“弃牌堆中没有符合条件的卡牌”，与实现一致。
  - 同一原始包里稍后又有一次成功把牌放到牌库底，说明这条能力链本身是通的，不是全局判空错乱。
  - 当前实现与现有单测一致，不支持“弃牌堆判错对象”这一说法。

### 3. test 反馈

- 反馈：`6a2399038bfd75951e984093`
- 真相源：
  - `temp/feedback-6a2399038bfd75951e984093.raw.json`
- 结论：
  - 内容仅为 `test`，没有可指向现存业务 bug 的症状。
  - 按测试单 / 无效反馈归档关闭。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native -t "时间旅行者：时间掠夺者"`
  - 结果：`4 passed`

## 收口说明

- 这 3 条反馈本轮都不是“定位到新领域 bug 并新增修复提交后回写 resolved”。
- 更准确的说法是：
  - `6a23c548...`：规则理解差异
  - `6a239998...`：提示符合当前规则与实现
  - `6a239903...`：测试单 / 无效反馈
- 因此统一按 `closed` 归档，而不是 `resolved`。
