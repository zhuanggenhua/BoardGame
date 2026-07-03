# 召唤师战争 B2 P1 充能准备规则原文锁定（2026-07-02）

## 目的

- 承接 `rule-text-lock-batch-queue-2026-07-02.md` 的 B2 队列：`prepare`、`inspire`。
- 本文件只做规则原文录入合同锁定，不做实现审计、不写规则断言测试、不改机制代码。
- 真相源优先使用官方站点静态包；本地 i18n、AbilityDef、旧测试和 OCR 只作对照线索。

## 权威来源

- 官方站点静态包：`https://summonerwars.plaidhatgames.com/static/js/main.610e76c5.chunk.js`。
- 本地缓存：`temp/summonerwars-audit/official-cache/main.610e76c5.chunk.js`。
- 命中字段：`Prepare|TEXT` / `Prepare|DIGITAL`、`Inspire|TEXT` / `Inspire|DIGITAL`。
- 图源入口仍沿用 `data-entry-crop-manifest-2026-07-02.md` 中的完整单卡裁图和文字区裁图。

## 规则锁定矩阵

| 对象 | 中文承载卡 | 官方能力名 | 官方原文 | 原子子句 | 合同状态 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| `prepare` | 梅肯达·露、边境弓箭手 | Prepare | Instead of moving this unit, you may boost it. | C1 代替本单位移动；C2 可选；C3 给本单位 1 个充能；C4 未写每回合一次，次数限制若存在须来自实现/行动经济而非卡面原文 | `locked-规则原文已锁` | 进入实现对照：确认“代替移动”是否通过移动阶段/未移动门禁和移动动作消耗表达，不能再按旧实现反推规则 |
| `inspire` | 凯鲁尊者 | Inspire | After this unit moves, boost each friendly adjacent unit. | C1 本单位移动后触发；C2 目标为每个相邻友方单位；C3 每个目标获得 1 个充能；C4 卡面未写“may”，按强制触发登记；C5 卡面未写每回合次数 | `locked-规则原文已锁` | 进入实现对照：确认移动后触发、相邻友方单位全集、排除自身、强制/自动结算和重复移动场景 |

## 对照说明

- `prepare` 官方原文没有写 `Once per turn`；当前总矩阵里记录的 `usesPerTurn=1` 只能作为实现事实，不能作为规则原文子句。
- `inspire` 官方原文没有写 `may`，也没有写“士兵/英雄”限制；后续实现对照必须按“每个相邻友方单位”核对目标全集。
- B2 两个对象已从 `blocked-入口已补` 推进为 `locked-规则原文已锁`；后续不回 OCR/裁图重读，除非发现来源冲突或对象归属错误。
