# Smash Up 技术中心回归 E2E 证据

## 范围

- 对象：`robot_tech_center`
- 目标：验证 `prompt -> onResolve -> draw helper` 这条真实 UI 链路已恢复，不再出现 `random is not defined`
- 结论等级：代表性玩法已验证（L3）

## 运行命令

```bash
node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-tech-center.e2e.ts "技术中心应通过真实 prompt resolve 按己方随从数抽牌"
```

## 场景真值

- P0 手牌只有 `robot_tech_center`
- P0 牌库顶依次为：
  - `robot_microbot_alpha`
  - `robot_microbot_guard`
  - `robot_zapbot`
- 基地 0 上已有 3 个 P0 随从
- 当前阶段：`playCards`

## 关键截图与肉眼观察

### 1. Prompt 已真实出现

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-tech-center.e2e\技术中心应通过真实-prompt-resolve-按己方随从数抽牌\01-tech-center-prompt.png`

肉眼观察：

- 画面顶部出现“选择一个基地（按该基地上的随从数抽牌）”，说明真实打牌入口已经进入技术中心 prompt。
- 左侧 `家园` 基地有绿色高亮，基地下方能看到 3 个己方随从，对应本次应抽 3 张的计数来源。
- 右下角手牌区仍显示 `Tech Center / 技术中心` 本体，说明截图拍到的对象就是本轮要验证的卡，不是其它卡的误触发。

验收判断：

- 达标。该截图证明这次不是只在单测里建出了 prompt，而是浏览器里的真实出牌链路已经走到 `robot_tech_center` 交互层。

### 2. Resolve 后已完成抽牌并收口

截图：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-robot-tech-center.e2e\技术中心应通过真实-prompt-resolve-按己方随从数抽牌\02-tech-center-resolved.png`

肉眼观察：

- 顶部的基地选择提示已消失，说明交互已经 resolve 并收口，不存在卡死在 prompt 的现象。
- 底部手牌区能直接看到 3 张新牌本体：`Microbot Alpha`、`Microbot Guard`、`Zapbot`，与预置牌库顶顺序一致。
- 右下角弃牌计数显示为 `1`，与打出后 `robot_tech_center` 进入弃牌堆的预期一致。

验收判断：

- 达标。该截图证明 resolve 后确实完成了抽牌和交互清理，不是只把 prompt 关掉或只停在中间态。

## 自动断言结果

- `sys.interaction.current.data.sourceId === 'robot_tech_center'`
- 选择基地 0 后 `sys.interaction.current === null`
- P0 最终手牌 UID：
  - `deck-draw-1`
  - `deck-draw-2`
  - `deck-draw-3`
- P0 最终牌库长度：`0`
- P0 弃牌堆包含：`hand-tech-center`

## 结论

- 本轮技术中心回归已在真实 UI 入口下复现并验证通过。
- 这条证据直接覆盖了本次风险点：`prompt -> onResolve -> shared draw helper` 在浏览器实际 resolve 时不再因漏传 `random` 崩溃。
