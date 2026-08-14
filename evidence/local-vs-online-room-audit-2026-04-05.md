# 本地房间 vs 联机房间审计（2026-04-05）

## 审计范围

- 页面入口：
  - `src/pages/LocalMatchRoom.tsx`
  - `src/pages/MatchRoom.tsx`
- 传输 / Provider：
  - `src/engine/transport/react.tsx`
  - `src/engine/transport/followCurrentTurnPlayer.ts`
  - `src/engine/transport/localSession.ts`
- 相关 UI 门禁：
  - `src/components/game/framework/CriticalImageGate.tsx`

## 权威来源

- 本项目 `AGENTS.md`
- `.spec/knowledge/standards/testing-audit.md`
- `.spec/knowledge/standards/ui-ux.md`
- 当前实现代码本身（本地房间、联机房间、LocalGameProvider、GameProvider）

## 审计维度

- `D3` 数据流闭环
- `D8` 时序正确
- `D15` UI 状态同步
- `D17` 隐式依赖
- `D23` 架构假设一致性
- `D43` 重构完整性检查

## 逐项结论

### 1. 本地 AI 局错误复用“同屏轮流视角”策略，导致视角翻转与隐藏信息泄漏

- 结论：命中问题，已修复。
- 实现入口：
  - 修复前问题点在 `LocalMatchRoom` 无条件传入 `followCurrentTurnPlayer`
  - `LocalGameProvider` 在 `followCurrentTurnPlayer=true` 时优先用当前回合玩家覆盖 `playerId`
- 风险说明：
  - 联机房间固定使用玩家自己的 `effectivePlayerID`
  - 本地房间此前无论是否有人机 seat，都会跟随当前行动方
  - 对 Smash Up / Dice Throne / Summoner Wars 这类 `playerID` 决定手牌/隐藏信息视角的游戏，本地人机局会在 AI 回合切到 AI 视角
  - 这不仅造成“整页像刷新”的体验，也会把 AI 手牌/隐藏区暴露给人类玩家
- 修复：
  - `LocalMatchRoom` 现在先识别 `humanSeatIds`
  - 只在“纯同屏多人”或“没有 human seat”时启用 `followCurrentTurnPlayer`
  - 有 AI 且存在 human seat 时，固定视角到首个 human seat
- 代码位置：
  - `src/pages/LocalMatchRoom.tsx:97`
  - `src/pages/LocalMatchRoom.tsx:108`
  - `src/pages/LocalMatchRoom.tsx:202`
  - `src/pages/LocalMatchRoom.tsx:213`
- 命中维度：
  - `D15` UI 状态同步
  - `D17` 隐式依赖
  - `D23` 架构假设一致性

### 2. 本地 rematch/reset 没有透传 setupData，重赛会静默掉回默认配置

- 结论：命中问题，已修复。
- 实现入口：
  - `LocalGameProvider.reset`
- 风险说明：
  - 本地房间初始化时会把 `setupData` 透传给 `domain.setup`
  - 但 reset/rematch 之前只调用 `config.domain.setup(playerIds, random)`，遗漏第三个参数
  - 结果是本地重赛与联机重赛不对称：玩家在本地设置的扩展、角色、房规、自定义开局，会在重赛时悄悄丢失
- 修复：
  - `reset` 已改为复用 `config.domain.setup(playerIds, random, setupData)`
- 代码位置：
  - `src/engine/transport/react.tsx:1043`
  - `src/engine/transport/react.tsx:1046`
- 命中维度：
  - `D3` 数据流闭环
  - `D8` 时序正确
  - `D43` 重构完整性检查

### 3. 本地房间的 WrappedBoard 仍依赖 `t` 引用，存在语言切换 / namespace 变化时的重挂载风险

- 结论：命中问题，已修复。
- 实现入口：
  - `LocalMatchRoom` 的 `WrappedBoard`
- 风险说明：
  - 联机房间已明确通过 `tRef` 规避这个问题
  - 本地房间此前仍把 `t` 放进 `useMemo` 依赖
  - 这会让语言切换、namespace 完成加载时重建 `WrappedBoard`，从而触发 Board 卸载重挂载，连带触发图片门禁重跑和局部 UI 状态丢失
- 修复：
  - 本地房间已改为 `tRef.current('matchRoom.loadingResources')`
  - `WrappedBoard` 不再绑定 `t` 引用
- 代码位置：
  - `src/pages/LocalMatchRoom.tsx:123`
  - `src/pages/LocalMatchRoom.tsx:137`
- 命中维度：
  - `D8` 时序正确
  - `D17` 隐式依赖
  - `D43` 重构完整性检查

### 4. 本地快照持久化仍缺少“构建/协议/schema 失效”门禁

- 结论：命中风险，暂未在本轮修复。
- 实现入口：
  - `src/engine/transport/localSession.ts`
- 风险说明：
  - 联机房间每次都以服务端权威状态为准
  - 本地房间会直接恢复 `localStorage` 里的 `state`
  - 当前快照键和版本只依赖固定常量 `LOCAL_MATCH_SNAPSHOT_VERSION = 1`、`gameId`、`seed`、`numPlayers`
  - 一旦领域结构、系统字段、playerView 假设或 setup 语义发生变化，而版本号忘记手动提升，就可能恢复旧 schema 的脏状态
- 当前判断：
  - 这是本地房间独有而联机房间天然没有的恢复风险
  - 需要单独设计迁移策略或 build/schema 指纹，不适合在本轮直接拍脑袋热修
- 代码位置：
  - `src/engine/transport/localSession.ts:4`
  - `src/engine/transport/localSession.ts:48`
  - `src/engine/transport/localSession.ts:84`
- 命中维度：
  - `D3` 数据流闭环
  - `D17` 隐式依赖
  - `D23` 架构假设一致性

## 验证证据

- 代码修复后运行：
  - `npx vitest run src/pages/__tests__/matchSeatValidation.test.ts src/components/game/framework/__tests__/CriticalImageGate.test.tsx`
  - `npx tsc --noEmit --pretty false`
- 新增 / 命中的回归：
  - `src/pages/__tests__/matchSeatValidation.test.ts`
  - 验证固定 `playerId + followCurrentTurnPlayer=false` 时视角不翻转
  - 验证 `reset` 会继续透传原始 `setupData`

## 未覆盖风险

- 尚未补本地房间的人机局 E2E，因此“不会再看见 AI 手牌”目前由代码链路与单测证明，缺少浏览器证据。
- 本轮未设计快照 schema/build 指纹迁移；本地旧局恢复风险仍存在。
- `TestMatchRoom` 属于测试专用入口，本轮未把生产本地房间的新视角策略同步抽象成共享 helper；如果后续继续扩展测试房间能力，应避免再次与生产入口漂移。

## 修订记录

- 2026-04-05：
  - 首次建立“本地房间 vs 联机房间”专项审计文档。
  - 命中并修复 3 条真实分叉：
    - 本地 AI 局视角翻转/隐藏信息泄漏
    - 本地 rematch 丢 setupData
    - 本地 WrappedBoard 绑定 `t` 导致重挂载风险
  - 保留 1 条未收口残留风险：
    - 本地快照 schema/build 失效门禁缺失
