# 大杀四方基地计分时 AI 熔断

- 反馈原文：`[system][online-ai-watchdog] circuit-breaker-tripped diagnostic_available`；线上 ID `6af1fb5855e295b6642fb2e1`。
- 私密回放：`scoreBases`，玩家 0 正在为大副选择基地，玩家 1 的响应窗口也存在。触发记录为玩家 1 的 `su:reaction_pass` 被“请先完成当前选择”拒绝。
- 修复前，在该权威状态上重算玩家 1 的合法动作得到 `response-pass`，送入领域管线被同样拒绝；玩家 0 的三个选择均可执行。原因是 AI 交互候选为空时继续生成响应窗口候选，没有区分“没有交互”和“有其他玩家的阻塞交互”。
- 本地修正为只在不存在交互时继续枚举响应窗口。修复后原局重放中玩家 1 无该候选；玩家 0 三个选择均通过，每个选择后的玩家 1 下一条候选也通过管线。测试 `ai-interaction-choice-enumeration.test.ts` 与 `afterscoring-interaction-lock.test.ts` 共 18 项通过。
- 这是状态与命令层回放，未还原完整历史随机流、未跑在线浏览器、未部署。旧测试只覆盖单层交互，未覆盖其他玩家交互与 AI 响应窗口并存；新增测试补该交叉状态。
