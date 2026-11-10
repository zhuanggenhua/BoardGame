# 线上反馈收口：波利尼西亚航海者基地中文显示

## 反馈内容 / 现实症状

> 波利尼西亚航海者的基地牌没有中文

- 线上反馈 ID：`6ab676b653f9291a46439ca2`
- 线上来源：`https://api.easyboardgame.top/admin-api/feedback`
- 反馈路由：`/play/smashup/match/n5N7h9j9xcg?playerID=0`
- 本轮处理时间：2026-09-25（线上摘要生成于 2026-09-25T17:26:06.125Z）

## 真相源与效果描述原文

- 正式数据录入已登记 `base_island_chain`、`base_island_peak`、`base_tropical_paradise`，中文名称在 `src/games/smashup/data/factions/polynesian_voyagers.ts`。
- 中文运行文案来自 `public/locales/zh-CN/game-smashup.json`：
  - 岛链：`此基地计分后，打出基地牌库顶牌作为一个额外基地。`
  - 岛峰：`你的回合开始时，若你在这里正好有一个随从，在其上放置一个 +1 力量指示物。`
  - 热带天堂：`若每位玩家在这里都有一个或更多随从，此基地的起始断点为 0。`
- 正式波利尼西亚基地压缩图集本体仍是英文，因此中文桌需要由同一张基地卡的覆盖层承载中文名称与效果。

## 根因与处理方式

- 根因类型：单点 UI 消费缺陷。
- `SmashUpCardRenderer` 原先没有把 `SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES` 视为英文文字图集，导致中文牌桌只展示英文图集本体，中文覆盖层没有常显。
- 修复：将该图集加入英文文字图集集合；中文牌桌对波利尼西亚基地强制常显 `resolveCardName` / `resolveCardText` 生成的中文覆盖层，英文桌与其它英文图集保持原有 hover 行为。
- 回归保护：补充组件回归，断言 `base_island_chain` 使用正式图集索引 8、中文 locale、覆盖层 `data-overlay-visibility="always"` 和“岛链”文案。

## 真实入口验证

- 入口：`e2e/smashup/smashup-state-injection-test.e2e.ts`，真实牌桌页面，不是静态组件预览。
- 代表态：中文牌桌，牌桌放入 `base_island_chain / base_island_peak / base_tropical_paradise`；该夹具只验证正式图集到中文覆盖层的消费链。
- 断言：基地覆盖层可见、`data-overlay-visibility="always"`、包含“岛链”和“基地牌库顶牌”。
- 命令：
  `node scripts/infra/run-e2e-single.mjs default e2e/smashup/smashup-state-injection-test.e2e.ts --case "波利尼西亚航海者英文基地图集在中文牌桌上常显中文名称与效果"`
- 结果：`1 passed (13.1s)`。
- 截图：`test-results/evidence-screenshots/smashup/smashup-state-injection-test.e2e/波利尼西亚航海者英文基地图集在中文牌桌上常显中文名称与效果/波利尼西亚航海者基地中文覆盖层.png`。
- PNG 文件签名已核对为 `89 50 4E 47 0D 0A 1A 0A`。

## 本地测试

- `npx vitest run src/games/smashup/__tests__/ui-interaction-manual.test.ts`
- 结果：`27 passed`。
- `git diff --check`：通过。

## 漏审复盘 / 规范回代

- 旧测试覆盖了中文 locale 与通用覆盖层行为，但没有把波利尼西亚基地正式英文图集纳入“英文文字图集”集合，也没有走真实牌桌入口验证该具体图集。
- 现有 `feedback-closeout` 与 `e2e-verification` 已覆盖“反馈原文 + 真相源 + 真实入口 + 截图编码”要求，本轮补的是单游戏图集消费回归，不新增项目级规范。

## 状态边界

- 本地代码修复、组件回归和真实入口已完成。
- 生产版本尚未发布；因此本记录只支持“本地已修复，生产待发布”，不能声称线上当前版本已经生效。
