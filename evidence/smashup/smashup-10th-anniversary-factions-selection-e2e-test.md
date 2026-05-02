# Smash Up 10 周年三派系选择页 E2E 证据（更新于 2026-05-02）

## 验证范围

- 派系选择页可见 `Mermaids / Skeletons / World Champs` 名称。
- `Mermaids / Skeletons / World Champs` 已完成交付，选择页**不再显示**这三个派系自己的“实施中”横幅。
- 页面不存在旧的长文案（如“分批实施 / 持续完善”）。

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系且不再显示实施中横幅"
```

结果：`1 passed`

## 截图与肉眼结论

1) 总览截图
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
- 观察：三派系卡面在同一页可见，卡面标题区域未再出现斜向“实施中”横幅。

2) Mermaids 名称截图
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-name.png`
- 观察：能直接看到 `Mermaids / 美人鱼` 名称，名称周边未出现“实施中”条带。

3) Skeletons 名称截图
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-name.png`
- 观察：能直接看到 `Skeletons / 骷髅` 名称，名称周边未出现“实施中”条带。

4) World Champs 名称截图
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-name.png`
- 观察：能直接看到 `World Champs / 世界冠军` 名称，名称周边未出现“实施中”条带。

## 结论

三派系已从“实施中”状态毕业；当前选择页保留三派系可见性，但不再展示“实施中”横幅。

## 失效结论回写（2026-05-02）

- 本文档旧版本曾写明“三派系均显示统一斜向实施中横幅”。
- 该结论**自 2026-05-02 起失效**：根据最新产品口径，`Mermaids / Skeletons / World Champs` 已完成交付，选择页应移除实施中横幅。
- 本轮已同步更新：
  - `src/games/smashup/ui/factionMeta.ts`
  - `e2e/smashup/smashup.e2e.ts`
  - 本证据文档

## 复测记录（2026-04-20）

- 触发原因：你反馈“看不到横幅”，我改了 `openSmashUpModal` 的入口打开逻辑后重新跑端到端。
- 复测命令：
  - `node scripts/infra/run-e2e-command.mjs isolated e2e/smashup/smashup.e2e.ts --grep "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"`
- 复测结果：`1 passed`
- 复测截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-22）

- 触发原因：继续收敛“只保留统一实施中样式/文案”。
- 代码收敛：
  - 删除 `public/locales/zh-CN/game-smashup.json` 与 `public/locales/en/game-smashup.json` 中 `faction_implementation_in_progress_hint`。
  - E2E 增加“横幅文案必须仅为 `实施中/Implementation in Progress` 且页面不存在 `分批实施/持续完善` 长文案”的断言。
- 校验命令：
  - `npm run i18n:check`
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "派系选择页应显示 10 周年三派系与统一斜向实施中横幅"`
- 结果：`i18n-check 通过`，E2E `1 passed`。
- 本次复测截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-23）

- 触发原因：同文件里的“3 人房间可加入且大厅会显示座位状态”用例出现断言回归，原断言误写为 `空位/空位/空位`。
- 根因：3 人房创建后房主已占 1 席，大厅真实展示应为“玩家 / 空位 / 空位”。
- 修复：将该断言改为 `toContainText(/空位\\s*\\/\\s*空位/)`，保留“仍有两个空位”的语义验证。
- 校验命令：
  - `npm run test:e2e:ci:file -- e2e/smashup/smashup.e2e.ts "3 人房间可加入且大厅会显示座位状态"`
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 结果：单用例 `1 passed`；整文件 `3 passed`（含三派系统一斜向“实施中”横幅用例）。
- 关键截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-24）

- 触发原因：继续收敛长期任务审计口径，确认最新主线下整文件 E2E 仍稳定通过。
- 复测命令：
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 复测结果：
  - 整文件 `3 passed`（含三派系统一斜向“实施中”横幅用例）。
- 肉眼核图结论：
  - 三派系卡面在同页可见，横幅样式一致且未出现第二套“实施中”样式；
  - 横幅文案仍为单一“实施中 / Implementation in Progress”，无“分批实施/持续完善”长文案回流；
  - 派系页主布局与横幅层级稳定，无新增遮挡或错位。
- 本次复测截图（绝对路径，最新时间 2026-04-24 09:08）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-25）

- 触发原因：`mermaids_toll_bay` 回归修复后，按长期任务口径重新跑整文件 E2E，确认派系页横幅链路未被带坏。
- 复测命令：
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 复测结果：
  - 整文件 `3 passed`（包含“派系选择页应显示 10 周年三派系与统一斜向实施中横幅”）。
- 肉眼核图结论：
  - 三派系仍保持同一套斜向“实施中”横幅样式；
  - 页面未出现“分批实施/持续完善”长文案回流；
  - 选派系总览与三张局部横幅截图可直接复查。
- 本次复测截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-25 09:56）

- 触发原因：继续执行“三派系审计工作”批次，确认统一斜向横幅在最新主线仍稳定可见。
- 复测命令：
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 复测结果：
  - 整文件 `3 passed`（含横幅用例）。
- 肉眼核图结论：
  - 三派系卡面（Mermaids / Skeletons / World Champs）均可见且都有“实施中”斜向横幅；
  - 横幅样式一致（无第二套实施中样式回流）；
  - 未出现“分批实施/持续完善”长文案。
- 本次截图时间（UTC）：`2026-04-25T01:56:04Z` 至 `2026-04-25T01:56:06Z`
- 本次复测截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-25 11:36）

- 触发原因：修复“巨石阵附着天赋二次发动”后，对派系列表页进行同轮回归，确认统一“实施中”横幅未回归。
- 复测命令：
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 结果：
  - 整文件 `3 passed`（横幅用例继续通过）。
- 本次截图时间（UTC）：
  - `2026-04-25T03:36:27Z` ~ `2026-04-25T03:36:28Z`
- 本次复测截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-25 13:28）

- 触发原因：去重 `talentAbilities` 重复 case 后，按长期任务口径再次跑整文件，确认“实施中”横幅样式未被连带影响。
- 复测命令：
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 结果：
  - 整文件 `3 passed`（横幅用例继续通过）。
- 肉眼结论：
  - Mermaids / Skeletons / World Champs 三派系均显示同一套斜向“实施中”横幅；
  - 未出现第二套“实施中”样式；
  - 未出现“分批实施/持续完善”长文案回流。
- 本次复测截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-26 08:06）

- 触发原因：继续“三派系审计工作”，复核统一斜向“实施中”横幅是否仍稳定可见。
- 复测命令：
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 结果：
  - 整文件 `2 passed / 1 failed`；
  - 横幅目标用例 `派系选择页应显示 10 周年三派系与统一斜向实施中横幅` 通过；
  - 失败项为 `3 人房间可加入且大厅会显示座位状态`（第三访客 join `page.goto` 超时）。
- 肉眼核图结论：
  - 三派系（Mermaids / Skeletons / World Champs）仍是同一套斜向“实施中”横幅；
  - 横幅文案仍是单值“实施中/Implementation in Progress”；
  - 未出现“分批实施/持续完善”回流。
- 本次核图截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`

## 复测记录（2026-04-26 08:22）

- 触发原因：上一轮同文件出现 `2 passed / 1 failed`（3 人房用例 30s 超时），需要做稳定性收敛。
- 修复：`e2e/smashup/smashup.e2e.ts` 为“3 人房间可加入且大厅会显示座位状态”增加 `test.setTimeout(120000)`。
- 校验命令：
  - `npx eslint e2e/smashup/smashup.e2e.ts`
  - `npm run test:e2e:ci -- e2e/smashup/smashup.e2e.ts`
- 结果：
  - `eslint` 通过；
  - 整文件 `3 passed`（横幅目标用例继续通过）。
- 肉眼核图结论：
  - Mermaids / Skeletons / World Champs 三派系横幅样式一致且为斜向黑黄样式；
  - 文案仍是单值“实施中 / Implementation in Progress”；
  - 未出现第二套“实施中”样式或长文案回流。
- 本次截图（绝对路径）：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-mermaids-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-skeletons-banner.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-10th-factions-world-champs-banner.png`
