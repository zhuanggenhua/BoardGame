# DiceThrone 在线 AI 隐藏多步交互 E2E 证据

## 目标

- 验证在线房间里，AI seat 持有仅自己可见的 `multistep-choice` 时：
  - 人类视角不会看到私有交互；
  - 在线 AI 会使用 batch 一次提交多条 `MODIFY_DIE`；
  - 交互完成后，权威状态与房主过滤视角都会推进。

## 用例

- 测试文件：`e2e/dicethrone-simple-start.e2e.ts`
- 用例名：`Online AI 持有隐藏 multistep-choice 时应 batch 提交多条 MODIFY_DIE 并完成私有结算`
- 运行命令：

```bash
BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- e2e/dicethrone-simple-start.e2e.ts "Online AI 持有隐藏 multistep-choice 时应 batch 提交多条 MODIFY_DIE 并完成私有结算"
```

## 截图

### 1. 处理前

![before](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-AI-持有隐藏-multistep-choice-时应-batch-提交多条-MODIFY_DIE-并完成私有结算/13-online-ai-hidden-multistep-before-resolve.png)

- 左侧阶段条停在 `4. 强掷攻击阶段`，说明房间已经处于投掷流程，不是 setup 页残留。
- 右侧骰列显示为一组混合结果，没有出现给房主的选择面板、确认弹层或额外遮罩，符合“交互只属于 AI seat”的预期。
- 右下角主操作区仍是正常战斗 HUD，而不是交互按钮列表，说明房主过滤视角没有泄漏 AI 私有 `multistep-choice`。

### 2. 处理后

![after](../test-results/evidence-screenshots/dicethrone-simple-start.e2e/Online-AI-持有隐藏-multistep-choice-时应-batch-提交多条-MODIFY_DIE-并完成私有结算/14-online-ai-hidden-after.png)

- 画面里仍然没有给房主弹出任何选择 UI，说明 AI 私有交互已在后台完成，而不是被转交给人类。
- 右侧骰列已经从“混合结果”变成统一结果，说明 AI 提交的多条 `MODIFY_DIE` 已实际生效，不是只清掉了交互壳。
- 主界面仍保持在同一阶段 HUD，没有出现房间断线、错误 toast 或卡住不动的遮挡层。

## 关键状态断言

### 注入后、AI 处理前

- 服务端原始状态：
  - `sys.interaction.current.playerId === '1'`
  - `sys.interaction.current.kind === 'multistep-choice'`
  - `sys.interaction.current.data.meta.dtType === 'modifyDie'`
  - `sys.interaction.current.data.meta.selectCount === 2`
  - `core.dice.slice(0, 2).map(v) === [1, 2]`
- 房主过滤视角：
  - `sys.interaction.current === null/undefined`
  - `sys.interaction.isBlocked === true`
  - `core.dice.slice(0, 2).map(v) === [1, 2]`

### AI 处理后

- 服务端原始状态：
  - `sys.interaction.current === null/undefined`
  - `core.dice.slice(0, 2).map(v) === [6, 6]`
- 房主过滤视角：
  - `sys.interaction.current === null/undefined`
  - `sys.interaction.isBlocked === false`
  - `core.dice.slice(0, 2).map(v) === [6, 6]`

## 结论

- 这条 E2E 已补上“在线 AI 私有多步交互 + 多命令 batch” 的真实房间证据。
- 当前可以确认：
  - 在线 AI 不再只覆盖 `simple-choice`；
  - `multistep-choice` 这类一次动作包含多条命令的场景，已经能在真实联机链路里自动完成；
  - 人类视角不会看到或接管 AI 的隐藏交互。
