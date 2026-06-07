# MatchRoom 旧前端包 `engineConfig` 未定义自动反馈归档关闭（2026-06-07）

## 范围

- 目标反馈：
  - `6a23bfcb8bfd75951e98412b`
  - `6a23d4503f06ad518a7dec4b`
  - `6a23dea1dcb72bc9665b4ddf`
  - `6a23e468dcb72bc9665b4df3`
  - `6a23c2583f06ad518a7dec0f`
  - `6a23df61dcb72bc9665b4de1`
  - `6a23bbbb8bfd75951e984109`
- 目标环境：生产 `boardgame.feedbacks`
- 涉及游戏：
  - `dicethrone`
  - `smashup`

## 线上真实症状

- 这 7 条都是自动反馈，不是用户手填。
- 表面上分成两种文案：
  - `engineConfig is not defined`
  - `Can't find variable: engineConfig`
- 但它们都指向同一类前端异常：
  - MatchRoom 页面旧前端包里，有一处 AI 座位尝试收口函数漏了 `engineConfig` 参数绑定。

## 真相源

### 1. 旧报错包

- 反馈里的堆栈明确指向旧 MatchRoom 包：
  - `MatchRoom-C9n6V1P_.js`
  - `MatchRoom-CJhvjseb.js`
- 对旧包直接取样可见：
  - 对应函数内部使用了 `engineConfig`
  - 但函数参数解构里没有把 `engineConfig` 取出来
- 这会直接触发浏览器报：
  - `engineConfig is not defined`

### 2. 当前线上包

- 当前生产首页 `https://easyboardgame.top` 现在引用：
  - `/assets/index-ChHuQmhc.js`
- 该入口当前懒加载的 MatchRoom 包是：
  - `MatchRoom-Gs9GFSiC.js`
- 对当前线上包直接取样可见：
  - 同一个函数现在已经显式解构 `engineConfig`
  - 不再存在旧包那种“内部使用但未绑定”的漏参形态

### 3. 当前仓库源码与测试

- 当前源码文件：
  - `src/pages/useOnlineAiSeatAutoDispatch.ts`
- 当前源码里 `releaseConfirmedOnlineAiAttempt(...)` 已正确解构：
  - `engineConfig`
- 现有单测已覆盖这条线：
  - `src/pages/__tests__/matchSeatValidation.test.ts`
  - 用例含义：shared state 已吸收 manual setup 结果时，不应因缺少 `engineConfig` 而在 release 阶段抛错

## 验证

- 线上现状核对：
  - 生产首页当前引用 `/assets/index-ChHuQmhc.js`
  - 当前入口懒加载 `MatchRoom-Gs9GFSiC.js`
- 本地定向测试：
  - `node scripts/infra/vitest-cli-safe.mjs run src/pages/__tests__/matchSeatValidation.test.ts --configLoader native -t "shared state 已吸收 manual setup 结果时，不应因缺少 engineConfig 而在 release 阶段抛错"`
  - 结果：`1 passed | 146 skipped`

## 收口结论

- 这 7 条自动反馈对应的是旧 MatchRoom 包的历史前端异常。
- 当前生产站点已经切到不含该漏参的新包；当前仓库源码和单测也与“已修状态”一致。
- 因此这 7 条不按 `resolved` 收口。
- 更准确口径是：
  - `当前线上已恢复，旧 bundle 噪音归档关闭`
- 所以统一按 `closed` 归档。
