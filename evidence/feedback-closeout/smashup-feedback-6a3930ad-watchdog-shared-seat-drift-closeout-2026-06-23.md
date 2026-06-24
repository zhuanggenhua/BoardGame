# SmashUp 线上反馈 6a3930aded8f4043405dbf42 修复记录

- 时间：2026-06-23
- 来源口径：线上真实反馈诊断包 `temp/feedback-closeout/2026-06-23T12-07-33-970Z/6a3930aded8f4043405dbf42.md`
- 反馈含义：SmashUp 计分后的响应窗口里，watchdog 自动代 AI 响应时点到了当前已经无效的选择，最终被服务端拒成“无效的选择”。

## 命中症状

- 真实反馈报错：`force-end-turn-failed ... SYS_INTERACTION_RESPOND:无效的选择`
- 真实现场里，同一个《统一反应选择》窗口出现了明显漂移：
  - 共享给所有人的当前真实选项只有 2 个：`time_travelers_jumper` 和 `pass`
  - AI 自己 seat 快照里却还有 4 个旧选项，额外混入了 `shapeshifters_doppelganger` 和另一条旧 trigger
  - AI 决策预览最终挑中的也是 seat 里的旧候选，不是当前共享交互里的真实可选项

## 根因

- 文件：`src/engine/ai/onlineDecisionView.ts`
- 现实含义：这条链路已经被 SmashUp runtime 判定为“共享可见交互”，但引擎在挑 AI 可见状态时，只校验了 interaction id 和事件流新鲜度，没有再核对“当前交互选项集是否还是同一份”。结果 seat 快照虽然不算过期，却把旧选项带进了 AI 决策，watchdog 才会替它点到无效选择。

## 修复

- 在 shared 可见交互复用 seat snapshot 前，新增“当前交互选项签名必须一致”的门槛。
- 只要 shared 与 seat 的当前选项 id / disabled 集合不一致，就退回 authoritative sharedState，不再让 AI 用 seat 旧选项做决策。
- 新增定向回归，强制覆盖 `smashup_reaction_choose` 在 shared 可见时 seat 选项漂移的场景。

## 验证

- 命令：
  - `npx vitest run src/games/smashup/__tests__/abilities/ancient-egyptians.test.ts src/engine/ai/__tests__/onlineDecisionView.test.ts`
- 结果：
  - 通过
  - `smashup_reaction_choose 在 shared 可见时，若 seat 选项集漂移，不应继续复用 seat snapshot` 已通过
  - 共享视图下会回退到当前真实的 shared 选项集，不再保留 seat 旧候选

## 对应回归

- `src/engine/ai/__tests__/onlineDecisionView.test.ts`
- 用例名：`smashup_reaction_choose 在 shared 可见时，若 seat 选项集漂移，不应继续复用 seat snapshot`
