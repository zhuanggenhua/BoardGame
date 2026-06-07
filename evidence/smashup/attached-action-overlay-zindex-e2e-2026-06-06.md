# 大杀四方附加行动卡层级 E2E 证据

## 运行方式

- 命令：`npm run test:e2e:ci:file -- e2e/smashup/smashup-attached-action-overlay-zindex.e2e.ts`
- 说明：使用真实页面链路打开 SmashUp 测试页，再通过 `setupScene + ongoing 选择 prompt 注入` 让目标附加行动卡进入真实可见态。

## 关键截图

- 全页截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-attached-action-overlay-zindex.e2e\附加行动卡-hover-后应压在相邻其他玩家随从上层\attached-action-overlay-zindex-full-page.png`
- 基地特写：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-attached-action-overlay-zindex.e2e\附加行动卡-hover-后应压在相邻其他玩家随从上层\attached-action-overlay-zindex-base.png`

## 我实际看到什么

- 全页截图左侧第一个基地里，`异形入侵者` 的附加行动卡 `藏身处` 已经展开，并覆盖到右侧相邻的其他玩家随从区域。
- 基地特写里能直接看到 `藏身处` 卡面压在 `海盗大副` 卡面上方，`海盗大副` 的数字和卡图被盖住一部分。
- 这不是单纯“卡存在于 DOM”；截图肉眼可见的是同一基地内的真实遮挡关系，附加行动卡位于更上层。

## 自动采样证据

- E2E 输出的重叠采样结果：
  - `overlap.width = 80`
  - `overlap.height = 108.37744140625`
  - `sampleX = 200`
  - `sampleY = 515.313720703125`
  - `topAttachedUid = host-attached-action`
- 结论：附加行动卡与相邻其他玩家随从存在真实重叠，且重叠采样点最上层元素属于附加行动卡，不是被盖住的随从。

## 验收结论

- 已达到本轮验收标准：真实页面截图里可以看到附加行动卡显示在其他玩家随从上面。
- 相关代码修正位于：
  - `src/games/smashup/ui/BaseZone.tsx`
  - `e2e/smashup/smashup-attached-action-overlay-zindex.e2e.ts`
