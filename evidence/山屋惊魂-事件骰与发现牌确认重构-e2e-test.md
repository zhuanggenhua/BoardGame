# 山屋惊魂事件骰与发现牌确认重构 E2E 记录

日期：2026-08-14

## 原始症状

- 用户在事件牌《一瓶微尘》选择跳过作祟检定后，自己页面没有明确确认入口，表现为无法继续点击。
- 用户进一步指出所有黄色事件牌可能有同类问题，要求每一种事件 / 发现牌类型都必须有端到端覆盖。
- 用户复核截图后指出：测试通过不能替代玩家视角验收；UI 重叠、卡图缺失、确认按钮放进正式卡面、改骰提示塞进骰盘方框，都必须判为未通过。

## 本轮锁定的修复范围

- 正式事件 / 发现牌卡面只承载规则正文和正式素材，不再承载运行时确认按钮。
- 无投骰事件牌确认按钮放到卡牌外部动作区；《一瓶微尘》跳过作祟后每名玩家都能在自己的页面确认。
- 事件骰确认链停在“确认最终结果”；确认前允许合法改骰道具介入，确认后才应用最终事件分支。
- 改骰提示“选择要重掷的骰子”放在骰盘外部上方；骰盘本体只承接真实骰子与逐骰命中 / 高亮。
- 物理骰盘保持开放透明：不得再出现整块暗色圆角骰盘背景、整体阴影框或 canvas 滤镜暗框。
- 验收范围按 `.spec/knowledge/standards/e2e-verification.md` 的“本轮改动面”执行：不扩大到全游戏旧债，但本轮改动面内的缺图、重叠、按钮贴错对象、暗色方框一律判 `REVISE`。

## 实现与测试更新

- `src/games/betrayal/Board.tsx`
  - 删除无投骰事件牌的 `card-dock` 路线；确认按钮只允许出现在卡外动作区或投骰结果区。
  - 发现牌 / 事件牌有投骰时，事件卡图在左，骰盘 / 结果 / 确认在右，二者同属一个开放工作台。
  - 改骰提示移到骰盘外部上方；骰盘命中层不再显示提示正文。
  - 透明物理骰盘去掉整体圆角裁切、整体背景光晕和整体阴影，仅保留骰子本体与逐骰选择光环。
  - 物理骰源失败不再伪装成已停稳成功；有骰子时暴露失败信息，避免“页面看似通过但骰子其实没渲染”。
- `src/lib/dice-box-threejs/engine.ts`
  - 透明骰盘模式下隐藏第三方引擎桌面 / 非骰子 mesh，保留真实骰子。
  - debug 快照暴露被隐藏的透明承接面对象，方便 E2E 证明不是靠 CSS 遮盖。
- `e2e/betrayal/betrayalTestHelpers.ts`
  - `expectEventRollWorkbenchReadable` 断言正式事件卡图存在、缺图占位不存在、事件牌和投骰面板不重叠。
  - 新增骰盘开放门禁：骰盘容器、边界层和物理 canvas 不得有整体背景、整体阴影或滤镜暗框。
  - 改骰态必须断言提示在骰盘外上方，且骰盘命中层不含提示正文。
- `e2e/betrayal/event-choice-coverage.e2e.ts`
  - 《一瓶微尘》多人确认链路断言按钮在卡外动作区，不在正式卡面内。
  - 43 张事件牌覆盖同一确认队列，防止只修单卡。
- `e2e/betrayal/lucky-coin-reroll.e2e.ts`
  - 截图名从“开放空白骰”改成“只允许选择空白骰”，避免把规则限制说成 UI 异常。
  - 覆盖幸运硬币：选择道具、只允许空白骰、确认使用、伤害副作用、最终确认。
- `e2e/betrayal/rabbit-foot-reroll.e2e.ts`、`e2e/betrayal/scary-doll-reroll.e2e.ts`
  - 覆盖兔脚和恐怖玩偶的真实道具改骰链路。
- `e2e/betrayal/first-scenario-jack-spirit-movement-roll.e2e.ts`
  - 用非事件骰盘对照验证开放透明骰盘没有被这次改动误伤。

## AI 图面审计

```text
verdict: PASS
score: 93/100
hard_failures: []
negative_impact_checks:
  - 事件牌正式卡图仍可读，未被按钮或骰盘遮挡。
  - 确认按钮离开正式卡面，归属卡外动作区或投骰结果区。
  - 改骰提示位于骰盘外上方，不再在骰盘方框 / 命中层内部。
  - 骰盘区域没有整块暗色圆角背景，玩家第一眼看到的是骰子本体和逐骰选择光环。
  - 左侧探索者、右侧牌堆 / 预兆状态、底部主动作栏仍可辨认；本轮改动未挤掉保护槽位。
issues: []
```

### 一瓶微尘跳过作祟多人确认

1. `evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-跳过作祟-多人确认-01-发起者确认前.jpg`
   - 《一瓶微尘》正式事件牌居中展示，卡面内只有正式规则正文。
   - “确认”按钮位于卡牌外部动作区，未进入正式卡面，也未贴到右侧房间牌。
2. `evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-跳过作祟-多人确认-02-第二位玩家确认前.jpg`
   - 第二位玩家页面仍显示同一事件牌和同一卡外确认入口。
   - 证明确认不是只给翻牌玩家，后续玩家也有明确动作。
3. `evidence/山屋惊魂-事件牌页面承接E2E/一瓶微尘-跳过作祟-多人确认-03-全员确认后回到牌桌.jpg`
   - 事件牌弹层退场，主牌桌恢复。
   - 右侧牌堆 / 预兆状态和底部主动作栏仍可见。

功能链结论：`PASS`。《一瓶微尘》跳过作祟后能由每名玩家确认，并在全员确认后回到牌桌。

### 兔脚、幸运硬币、恐怖玩偶改骰链

- `evidence/山屋惊魂-兔脚重掷完整链路/04-选中骰子等待确认使用.jpg`
  - “选择要重掷的骰子”在骰盘外部上方。
  - “确认使用兔脚”位于投骰结果区；骰盘本体不再是暗色方框。
- `evidence/山屋惊魂-兔脚重掷完整链路/05-重掷后等待确认最终结果.jpg`
  - 兔脚使用后进入“确认最终结果”，按钮仍在投骰结果区。
- `evidence/山屋惊魂-幸运硬币重掷完整链路/02-幸运硬币只允许选择空白骰重掷.jpg`
  - 只允许空白骰成为可选目标；非空白骰未被误开放。
- `evidence/山屋惊魂-幸运硬币重掷完整链路/03-幸运硬币选中空白骰等待确认使用.jpg`
  - “确认使用幸运硬币”位于投骰结果区，提示在骰盘外。
- `evidence/山屋惊魂-幸运硬币重掷完整链路/05-精神伤害收口后仍等待确认最终结果.jpg`
  - 副作用收口后仍停在最终确认，没有绕过事件骰确认。
- `evidence/山屋惊魂-恐怖玩偶重掷完整链路/03-恐怖玩偶选中骰子等待确认使用.jpg`
  - 三颗骰子均作为真实骰子目标承接选择，确认按钮归属投骰结果区。
- `evidence/山屋惊魂-恐怖玩偶重掷完整链路/04-恐怖玩偶重掷后等待确认最终结果.jpg`
  - 重掷完成后进入“确认最终结果”，未残留选择态提示。

功能链结论：`PASS`。三种改骰道具均完成“选择道具 / 选择真实骰子 / 确认使用 / 等待最终结果确认 / 最终结算”。

## 验证命令与结果

- `npx tsc --noEmit --pretty false`：通过。
- `npm run spec:lint`：本轮早前通过；最终复核时被无关 `.spec/decisions/0001-ai-spec-structure-migration.md` 悬空链接阻塞，失败信息为 `悬空链接: 0002-lumioagent-host-structure.md`。该文件不属于本次山屋 UI 修复范围，本轮未擅自修改。
- `PW_SKIP_ASSET_BOOTSTRAP=true npm run test:e2e:file -- e2e/betrayal/rabbit-foot-reroll.e2e.ts`：1 passed。
- `PW_SKIP_ASSET_BOOTSTRAP=true npm run test:e2e:file -- e2e/betrayal/lucky-coin-reroll.e2e.ts`：1 passed。
- `PW_SKIP_ASSET_BOOTSTRAP=true npm run test:e2e:file -- e2e/betrayal/scary-doll-reroll.e2e.ts`：1 passed。
- `PW_SKIP_ASSET_BOOTSTRAP=true npm run test:e2e:file -- e2e/betrayal/event-choice-coverage.e2e.ts "一瓶微尘跳过作祟"`：1 passed。
- `PW_SKIP_ASSET_BOOTSTRAP=true npm run test:e2e:file -- e2e/betrayal/event-choice-coverage.e2e.ts "当前43张事件牌都能进入同一确认队列"`：1 passed。
- `PW_SKIP_ASSET_BOOTSTRAP=true npm run test:e2e:file -- e2e/betrayal/first-scenario-jack-spirit-movement-roll.e2e.ts`：2 passed。

## 环境说明

- 本轮浏览器回归显式设置 `PW_SKIP_ASSET_BOOTSTRAP=true`，使用当前工作区已存在的正式山屋素材。
- 标准素材自动补齐入口此前出现过服务器 `HTTP 502/530`，这属于素材服务器链路问题；本轮功能与 UI 验收没有用缺图占位替代正式素材。
