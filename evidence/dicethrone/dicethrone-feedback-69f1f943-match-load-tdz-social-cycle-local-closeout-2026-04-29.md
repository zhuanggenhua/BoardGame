# Dice Throne 反馈 69f1f943 / 69f1f938 历史本地收口说明（2026-04-29）

> 2026-06-06 当前有效口径：本文只保留 `69f1f943 / 69f1f938` 这两条“游戏加载失败 / Cannot access 'rt' before initialization”反馈的历史本地收口证据，不代表 DiceThrone 领域逻辑、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时全局 HUD 社交模块循环导入链被本地修掉并验证过，不能外推成 DiceThrone 当前总体收口。

## 反馈概况

- 主反馈：`69f1f943ab54eadcc2bb2ab8`
- 近重复：`69f1f938ab54eadcc2bb2ab5`
- 游戏：`dicethrone`
- 对局：`vslx1tT07sj`
- 路由：`/play/dicethrone/match/vslx1tT07sj?playerID=1`
- 线上原文：
  - `游戏加载失败`
  - `游戏加载失败 / Cannot access 'rt' before initialization`

## 结论

本次不是 Dice Throne 领域逻辑或在线传输链卡死，而是前端全局 HUD 懒加载链里的循环导入导致生产 bundle 初始化时触发 TDZ（Temporal Dead Zone）。

具体根因：

- [FriendList.tsx](/D:/gongzuo/webgame/BoardGame/src/components/social/FriendList.tsx) 仅为了读取 `SYSTEM_NOTIFICATION_ID`，直接 import 了 [FriendsChatModal.tsx](/D:/gongzuo/webgame/BoardGame/src/components/social/FriendsChatModal.tsx)。
- [FriendsChatModal.tsx](/D:/gongzuo/webgame/BoardGame/src/components/social/FriendsChatModal.tsx) 又反向 import [FriendList.tsx](/D:/gongzuo/webgame/BoardGame/src/components/social/FriendList.tsx)。
- [GlobalHUD.tsx](/D:/gongzuo/webgame/BoardGame/src/components/system/GlobalHUD.tsx) 被 [App.tsx](/D:/gongzuo/webgame/BoardGame/src/App.tsx) 在所有页面全局懒加载，因此即使用户进入的是 Dice Throne 对局页，也会在加载 HUD 相关 chunk 时命中这条循环导入。
- 生产压缩后该类循环常表现为 `Cannot access '<minified symbol>' before initialization`；本次反馈里的 `rt` 即符合该模式。

## 修复

- 新增独立常量模块 [constants.ts](/D:/gongzuo/webgame/BoardGame/src/components/social/constants.ts)，承载 `SYSTEM_NOTIFICATION_ID`。
- [FriendList.tsx](/D:/gongzuo/webgame/BoardGame/src/components/social/FriendList.tsx) 改为从独立常量模块读取该常量，不再依赖 `FriendsChatModal.tsx`。
- [UserMenu.tsx](/D:/gongzuo/webgame/BoardGame/src/components/social/UserMenu.tsx) 同步改为从独立常量模块读取常量。
- 在现有测试 [chatSelectionLogic.test.ts](/D:/gongzuo/webgame/BoardGame/src/components/social/__tests__/chatSelectionLogic.test.ts) 补回归：`FriendList` 与 `FriendsChatModal` 必须可同时导入。

## 本地验收

由于线上反馈只保留了用户端报错文案，没有完整 JS stack；且该问题发生在生产 bundle 初始化期，无法对原线上页面做等价实时复盘，因此按“线上复核客观不可执行 -> 本地定向复现/替代复现 + 定向回归 + 构建验证”口径收口。

已完成验证：

1. `npx vitest run src/components/social/__tests__/chatSelectionLogic.test.ts`
   - 结果：`14 passed`
   - 其中新增用例 `FriendList 与 FriendsChatModal 可同时导入，不应通过常量互相形成初始化环` 通过。
2. `npm run build`
   - 结果：构建成功。
   - 说明：修复后生产构建可以完整产出 `GlobalHUD` / `MatchRoom` 等相关 chunk，未再出现当前问题对应的初始化失败。
3. 定向导入图复核：
   - `FriendList.tsx -> constants.ts`
   - `FriendsChatModal.tsx -> FriendList.tsx + constants.ts`
   - 已不存在 `FriendList.tsx -> FriendsChatModal.tsx -> FriendList.tsx` 闭环。

## 收口口径

按本地验收转 `resolved`：

- 主反馈 `69f1f943ab54eadcc2bb2ab8`
- 近重复 `69f1f938ab54eadcc2bb2ab5`

## 当前阅读说明

- 本文只覆盖一条全局 HUD / 社交模块循环导入链，不覆盖 DiceThrone 更广范围运行时、对象级 `L3/L4` 或新英雄整批完成态。
- 文中的 `resolved` 只代表当轮本地验收收口，不是当前 DiceThrone 总审计出口。
