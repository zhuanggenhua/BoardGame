# 线上反馈收口（2026-06-10）

## 范围

- 目标反馈：
  - `6a2805e47ca0610e525c7e1a`
  - `6a26595752a24b6de8402504`
  - `6a27f671c248e7f42e953ce2`
  - `6a25adcbab42857a582671f4`
  - `6a2514c36586220765eb6962`
- 未收口、继续保留：
  - `6a26a66b52a24b6de8402763`
- 生产真相源：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`

## 1. DiceThrone 大厅首页崩溃链

### 反馈

- `6a2805e47ca0610e525c7e1a`
  - 原文：`[auto][react.error_boundary] Minified React error #185`
- `6a26595752a24b6de8402504`
  - 原文：`[auto][react.error_boundary] Cannot read properties of undefined (reading 'HomeEntry')`

### 根因

- 首页 `/` 路由把 `HomeEntry` 额外拆成了懒加载 chunk。
- 线上旧入口在切大厅时，`HomeEntry` 模块默认导出/命名导出装配链不稳定，最终落成：
  - 读 `HomeEntry` 时报 `undefined`
  - React error boundary 再包一层变成 `react error #185`

### 修复

- 文件：
  - `src/App.tsx`
  - `src/pages/HomeEntry.tsx`
  - `src/pages/__tests__/App.entrySource.test.ts`
- 处理：
  - 首页入口改回同步引入 `HomeEntry`
  - `/` 路由直接渲染 `<HomeEntry />`
  - 补 `default export`
  - 增加源码守卫测试，防止再次改回懒加载

### 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/App.localRoute.test.tsx src/pages/__tests__/App.entrySource.test.ts --configLoader native --environment happy-dom`
- 结果：
  - `2 passed`

### 收口

- 这两条属于同一根因，当前树已直接修复，应按 `resolved` 回写。

## 2. DiceThrone 教程卡在 play-six

### 反馈

- `6a25adcbab42857a582671f4`
  - 原文：`卡教程，手牌中没有那张手牌无法进入下一个流程`

### 根因

- 线上快照显示教程卡在 `play-six` 步骤，但 0 号位手牌里没有 `card-play-six`。
- 教程 `setup` 阶段有两条 AI 动作依赖默认当前行动位，导致起手牌/开局动作可能漂到错误座位。

### 修复

- 文件：
  - `src/games/dicethrone/tutorial.ts`
  - `src/games/dicethrone/__tests__/tutorial-e2e.test.ts`
- 处理：
  - `SELECT_CHARACTER` 的教程方显式绑 `playerId: '0'`
  - `HOST_START_GAME` 显式绑 `playerId: '0'`
  - 增加回归测试，强制要求 0 号位拿到教程关键起手牌并进入 `main1`

### 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/tutorial-e2e.test.ts --configLoader native --pool threads --maxWorkers 1 --no-file-parallelism`
- 结果：
  - `4 passed`

### 收口

- 根因、修复点、回归测试三者一致，应按 `resolved` 回写。

## 3. SummonerWars 棋盘渲染报 t is not defined

### 反馈

- `6a27f671c248e7f42e953ce2`
  - 原文：`[auto][board-render-error] t is not defined`

### 现状核对

- 当前仓库 `src/games/summonerwars/ui/BoardGrid.tsx` 已显式声明：
  - `const { t, i18n } = useTranslation('game-summonerwars');`

### 结论

- 当前代码面上，这条报错对应的缺口已经不存在。
- 结合它是自动渲染错误，更像线上旧包/旧页面缓存命中，而不是当前树仍缺实现。

### 收口

- 按“根因已不在当前树、反馈链当前可视为已处理”收口为 `resolved`。

## 4. SmashUp 计分后响应让过无效

### 反馈

- `6a2514c36586220765eb6962`
  - 原文：`计分后响应时卡死，点让过无效`

### 现状核对

- 已用生产快照本地回放：
  - `temp/smashup-feedback-6a2514c3-state.b64`
- 对 `传送门房间` 的当前交互执行：
  - `SYS_INTERACTION_RESPOND`
  - `optionId: pass`
- 本地结果：
  - `success: true`

### 结论

- 当前仓库无法复现“让过无效”。
- 这条更像当时线上旧实现/旧包状态，不像当前树仍有业务 bug。

### 收口

- 按“当前链路已证伪为现存 bug”收口为 `closed`。

## 5. 继续保留

### DiceThrone 绳缚卡死

- `6a26a66b52a24b6de8402763`
  - 原文：`有绳缚对手没有cp时卡死`
- 当前只确认：
  - `ROLL_DICE` 会报 `not_enough_cp`
  - `CONFIRM_ROLL` 在本地领域层仍可合法推进
- 还没锁到真实卡死点究竟在 UI、旧包还是领域链。
- 本轮不回写状态，继续保留 `open`。
