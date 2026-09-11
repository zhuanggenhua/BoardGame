# Mage Wars 教程真实流程证据（2026-09-10）

## 当前结论

当前 revision 3 的 Mage Wars 基础教程已从真实入口 `/play/mage-wars/tutorial` 通过 Chromium 端到端验证。测试不是直接读内部状态替玩家完成流程：主流程真实点击教程按钮、法术书分类、翻页、卡牌本体、场上灰狼、相邻区域、结束行动和让过快速施法。

验证命令：

```powershell
node scripts/infra/run-e2e-command.mjs isolated e2e/mage-wars/mage-wars-tutorial.e2e.ts
```

结果：`5 passed`。

## 本轮修正

| 玩家看到的问题 | 当前处理 |
| --- | --- |
| 自动阶段出现“继续重置”等内部推进语义 | 重置、聚魔、无待处理选择的维持由正式流程自动推进，正式 UI 不再渲染手动主按钮。 |
| 空计划显示“确认不计划” | 改成“跳过准备法术”，教程同时解释这是提交 0 张法术，之后进入部署。 |
| 移动后不知道怎么结束生物行动 | 增加真实“结束行动”教程步骤；正式流程在第一名玩家结束生物行动时发出窗口完成事件，教程再等待对手自动收口。 |
| 最终快速施法后教程卡住 | 按当前正式流程，玩家让过最终快速施法后直接进入下一回合计划；删除不存在的“对手最终快速施法”教程步骤，改用回合推进事件承接。 |

## 阶段覆盖

| 阶段 | 教程承接 | 当前截图 |
| --- | --- | --- |
| 重置 | 阶段总览说明，自动完成 | `03-read-round-stage.png` |
| 聚魔 | 自动结算和法力变化 | `04-channel-result-mana-increased.png` |
| 维持 | 阶段总览说明，无内部按钮 | `03-read-round-stage.png` |
| 计划 | 空计划语义和两张法术的真实选择 | `05A`、`06-13` |
| 部署 | 选择准备牌、选择区域、召唤后未就绪、结束部署 | `15-20` |
| 先手快速施法 | 真实让过窗口 | `24-skip-initiative-quickcast.png` |
| 生物行动 | 选择灰狼、选择相邻区域、结束行动、对手自动收口 | `25-27` |
| 最终快速施法 | 真实让过窗口并进入下一回合 | `28-29` |

## 当前主流程截图

原图目录：

`test-results/evidence-screenshots/mage-wars/tutorial-flow-sync/`

当前清单：

`evidence/mage-wars-tutorial/pass-manifest-20260910-single-natural-flow-00-29.json`

目录内 31 张原图按玩家动作顺序排列，新增阶段截图为：

- `05A-skip-planning-no-spells.png`
- `27-end-creature-action.png`
- `28-skip-final-quickcast.png`
- `29-finish-next-round-started.png`

旧的 `pass-manifest-20260905-single-natural-flow-00-27.json` 和旧 `e2e-test.md` 保留为历史证据，不再证明本轮新增阶段。

## 规范回写

项目级 `.spec/knowledge/standards/tutorial-design.md` 已明确：

- 教程覆盖矩阵必须登记正式流程中的全部一级阶段和窗口。
- 自动阶段不能把内部推进按钮暴露给玩家。
- 允许空选择的阶段必须解释空选择的含义和后果。

## 边界

本证据证明的是 Mage Wars 桌面基础教程这条自然主线和三个桌面响应式压力态。墙体、守卫、治疗、复原术等不在本基础教程主线中的专题机制，仍需用各自正式玩法链或专题证据单独证明。
