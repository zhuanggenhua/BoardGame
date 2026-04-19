# Summoner Wars 事件卡：除灭多目标选择 E2E 证据（2026-04-12）

## 运行命令
- `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars.e2e.ts "事件卡：除灭多目标选择流程"`

## 关键截图与观察
1. D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：除灭多目标选择流程\event-annihilate-damage-step.png
   - 画面顶部出现紫色横幅提示“除灭：为第 1 个目标选择相邻单位造成 2 点伤害”，且同时显示“跳过 / 取消”按钮。
   - 棋盘上已有多个单位，交互提示与阶段按钮共存，没有被遮挡或错位。
   - 该截图证明已从“选择牺牲单位”进入“选择伤害目标”步骤，事件卡多步交互链路可继续推进。
2. D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\事件卡：除灭多目标选择流程\event-annihilate-structure-target.png
   - 选中“伤害目标选择”阶段的相邻结构作为目标后仍能正常响应，结构格可被点击并触发交互推进。
   - 该截图证明 UI 已对齐系统合同：除灭伤害目标不仅限于单位，结构也可被选中。

## 结论
- 除灭事件卡在 InteractionSystem 下可进入伤害目标选择步骤，且 UI 已支持相邻结构作为伤害目标，满足本轮交互链路与合同一致性验证要求。
