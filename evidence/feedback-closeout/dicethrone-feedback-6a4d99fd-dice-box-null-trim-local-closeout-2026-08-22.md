# Dice Throne 本地自动反馈收口：dice-box-threejs 空日志 trim 噪音

- 日期：2026-08-22
- 口径：本地数据库反馈；Mongo `boardgame.feedbacks`
- 反馈组：
  - `6a4d99fd9509c0a7175b5a8a`
  - `6a4e5e16865a6de28d36e9b1`
  - `6a525e26516780094a87b08a`

## 自动检测场景

三条反馈都是 Dice Throne 前端窗口错误：

```text
Cannot read properties of null (reading 'trim')
```

错误栈都落在第三方 3D 骰子库 `@3d-dice/dice-box-threejs` 的 WebGL shader / program 编译信息读取链路，不是 Dice Throne 规则结算或玩家动作链路。

## 当前树结论

当前代码已经具备两层处理：

- 3D 骰子引擎创建前会安装 WebGL 空日志保护，把浏览器返回的 `null` shader/program info log 转成空字符串，避免第三方库内部继续 `.trim()` 崩溃。
- 自动反馈采集会过滤 `dice-box-threejs` 的这类第三方渲染空值噪音，避免旧噪音继续进入反馈队列。

因此这组三条按“当前树已恢复 / 旧自动噪音”关闭，本轮没有改业务代码。

## 验证记录

```text
node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/diceBoxThreeEngine.test.ts --configLoader native -t "兼容返回 null 的 WebGL shader 日志"
PASS: 1 passed / 2 skipped

node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/clientAutoReport.test.ts --configLoader native -t "dice-box-threejs 第三方渲染空值噪音会被过滤"
PASS: 1 passed / 32 skipped

node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/DiceBoxPhysicsSource.test.tsx --configLoader native -t "运行期渲染失败时会清空物理状态"
PASS: 1 passed / 4 skipped
```

## 收口口径

按已失效旧自动反馈关闭。当前版本不会再把同类第三方 `dice-box-threejs` 空日志 `trim` 噪音作为待处理反馈上报；若真实 3D 骰子仍初始化失败，会降级停用物理源并清空物理状态，不阻断 Dice Throne 规则流程。
