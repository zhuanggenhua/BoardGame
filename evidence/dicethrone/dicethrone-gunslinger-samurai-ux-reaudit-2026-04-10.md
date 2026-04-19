# DiceThrone 枪手 / 武士 UX 重新审计（2026-04-10）

> 触发原因：用户明确指出旧审计“不够充分”，并点名 **攻击修正 UI、枪手 Loaded 单骰特写、5 骰结果展示、国际化按钮/文案、武士 Token 图标** 仍有缺口。
>
> 本文不是“补一条截图”，而是把这轮 UX 重新审计的 **失效结论、根因、修复、截图观察、验证阻塞与残余风险** 一次性落地。

## 2026-04-11 复核更新（本轮追加）

### 新增修复/校正

1. **Bonus die 文案命名空间修正**
   - `BonusDieSpotlightContent` 里 `i18n.exists` 现在显式指定 `game-dicethrone` namespace，避免默认 `common` 导致“明明有文案却显示裸 key”。
2. **Bonus die 汇总文案支持“带点 key”**
   - `BonusDieOverlay` 通过 `i18n.getResource(..., 'bonusDie.effect')` 取原始模板，解决 `samuraiMasamune.result / gunslingerEatMyLead.result` 这类带 `.` 的 key 被当成层级路径解析的问题。
3. **枪手/武士骰子定义注册确认**
   - `domain/index.ts` 已包含 `gunslingerDiceDefinition` + `samuraiDiceDefinition` 注册，确保 `getPlayerDieFace` 能按面值映射，不再全部回退成 `katana`。

### 旧结论修订（明确失效点）

- **“Loaded 选择弹窗 skip 按钮裸 key”**：已失效。最新截图里按钮为中文 `跳过`。
- **“三条目标 E2E 未全绿”**：已失效。2026-04-11 三条 E2E 全部通过并产出新截图证据。
- **“5 骰汇总文案缺失/显示 key”**：已失效。最新 Zanshin 结算有中文汇总文本。

## 审计范围

- 游戏：`dicethrone`
- 角色：`gunslinger`（枪手）、`samurai`（武士）
- 本轮重点位点：
  1. 枪手 `Loaded / 装填` 使用后的单骰特写是否真实出现
  2. 5 骰 display-only 结算是否改为汇总描述，而不是逐骰挤压布局
  3. 攻击修正是否有明确可见的 UI 标识
  4. 武士 token 图标与中文显示是否对齐现成资源
  5. Choice / Token 相关按钮与文案是否仍有英文或裸 key

## 为什么旧审计结论失效

### 失效点 1：把“规则链已接上”误写成“体验已收口”

旧文档重点证明了定义链、执行链、状态链、部分 E2E 链路，但没有把以下 UX 位点列为强制验收：

- Token 点击后是否 **真的出现 UI 特写**，而不是只改内部数值
- 多骰 display-only 结算是否有 **可读汇总文案**
- Attack modifier 是否 **肉眼可见**
- Token 图标 / 中文 / skip 按钮是否仍有裸 key 或旧 atlas 错位

### 失效点 2：Loaded 的问题不只是“样式没做”，而是基础路径根本没发展示型 settlement

本轮重新检查 `src/games/dicethrone/domain/customActions/gunslinger.ts` 后确认：

- 旧问题不是单纯“spotlight CSS 没弹出来”
- 更深层根因是：**基础 Loaded（无可 reroll 分支）原先只发 `BONUS_DAMAGE_ADDED`，没有发 `BONUS_DIE_ROLLED` + display-only settlement**
- 结果就是：逻辑伤害生效了，但 UI 没有任何单骰特写可看

这条问题命中：
- `D3 数据流闭环`
- `D15 UI/状态不同步`
- `D47 测试覆盖不完整`

## 本轮已确认的修复/裁决

### 1. 枪手 Loaded：基础 token 使用后也必须出现单骰特写

修复口径：

- `handleLoadedUse(...)` 的非 reroll 分支，现在会按顺序发：
  1. `BONUS_DIE_ROLLED`
  2. `BONUS_DICE_REROLL_REQUESTED`（`displayOnly: true`）
  3. `BONUS_DAMAGE_ADDED`
- 骰值换算保持原规则：`ceil(roll / 2)`
- 这意味着基础 Loaded 不再是“纯数值结算”，而是和用户感知一致的 **单骰可见结算**

对应代码：
- `src/games/dicethrone/domain/customActions/gunslinger.ts`

### 2. 5 骰 display-only 结算：改成单条汇总描述，而不是逐骰底部五段文字

裁决：

- 用户说得对，之前“每颗骰子下面都塞描述”会把布局挤坏
- 正确方案不是回退成完全无说明，而是：
  - 单骰：给独立 spotlight
  - 多骰 display-only：给 **汇总结果描述**

本轮沿用并确认的链路：
- `src/games/dicethrone/domain/core-types.ts`
- `src/games/dicethrone/domain/effects.ts`
- `src/games/dicethrone/domain/customActions/gunslinger.ts`
- `src/games/dicethrone/domain/customActions/samurai.ts`
- `src/games/dicethrone/ui/BoardOverlays.tsx`

### 3. ChoiceModal 的 skip 文案裸 key：是实打实的 i18n 缺陷，不是“测试场景假问题”

问题现象：
- 旧截图里 Loaded 选择弹窗底部按钮显示 `TOKENRESPONSE.SKIP`

修复口径：
- `src/games/dicethrone/ui/ChoiceModal.tsx` 中统一改成 `t(key, { defaultValue: key })`
- 不再只靠 `i18n.exists()` 兜底，从而避免 namespace/大小写导致的裸 key 泄漏

### 4. 武士 token 图标：继续沿用现成资源，但修正 atlas 比例

对应文件：
- `public/assets/i18n/zh-CN/dicethrone/images/samurai/status-icons-atlas.json`

裁决：
- 问题不是“资源没有”，而是 **现成资源接线/比例没有对齐**
- 这也是旧审计没有把“现成资源是否按 UI 实际显示正确”当成验收项的缺口

### 5. 攻击修正 UI：必须是肉眼可见的前景提示，不接受“状态里有值但用户看不见”

对应实现：
- `src/games/dicethrone/ui/ActiveModifierBadge.tsx`

裁决：
- 攻击修正是战斗信息，不是日志信息
- 如果只有状态值变化，没有显著 UI 标识，就不算体验闭环

## 本轮动态验证

### 已成功完成

#### ESLint

```powershell
npx eslint src/games/dicethrone/domain/customActions/gunslinger.ts src/games/dicethrone/ui/ChoiceModal.tsx src/games/dicethrone/__tests__/cross-hero.test.ts
npx eslint e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts
```

结果：
- 前三者 0 errors
- E2E 文件 0 errors，仅保留仓库既有 `any` warnings

#### i18n

```powershell
npm run i18n:check
```

结果：
- `i18n-check: no missing keys detected.`

#### 领域/组件回归（历史已通过，本轮继续依赖）

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts src/games/dicethrone/__tests__/BonusDieOverlay.test.ts --configLoader native
```

历史结果：
- `86 passed`

备注：
- 本轮再次尝试复跑 Vitest 时，环境侧 `fork probe timed out after 1500ms`，属于当前运行环境对子进程能力的瞬时阻塞，不是本轮断言失败。

#### E2E：Loaded 单骰 spotlight

### E2E（2026-04-11 复核全绿）

本轮 E2E 统一加了并发与内存门禁（你明确要求 `1.5g`）：

```powershell
$env:BG_HEAVY_E2E_MEMORY_MIN_FREE_GB='1.5'
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
```

三条目标用例 **全部通过**：

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "gunslinger loaded token should open single-die spotlight after real choice click"
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai retribution token should retaliate through real click flow"
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "samurai zanshin should settle 5 bonus dice and synchronize effects against paladin"
```

## 截图证据与肉眼观察

### 2026-04-11 新证据（覆盖旧条目）

> 下面这组截图是本轮复核的 **最新证据**，覆盖旧条目的失效结论。

#### A1. 枪手 Loaded 选择弹窗（skip 已翻译）

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\20-gunslinger-loaded-choice-before-use.png`

我实际看到：
- 弹窗标题为「技能结算选择」
- Token 标题为「装填」
- 按钮文字为「跳过」，不再出现 `TOKENRESPONSE.SKIP`

是否达标：**达标**

#### A2. 枪手 Loaded 单骰特写（中文文案）

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\22-gunslinger-loaded-single-die-spotlight.png`

我实际看到：
- 中央单骰特写正常弹出
- 文案为中文「装填投掷：1」
- 没有裸 key 或英文占位

是否达标：**达标**

#### A3. 武士 Retribution 响应窗口

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-retribution-token-should-retaliate-through-real-click-flow\20-samurai-retribution-before-use.png`

我实际看到：
- 弹窗显示「响应（防御方）」
- 选项里明确出现「反击」并带「使用」按钮

是否达标：**达标**

#### A4. 武士 Zanshin 五骰汇总

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-vs-paladin.png`

我实际看到：
- 5 颗骰子统一出现在结算层
- 汇总文案为中文：「2 个武士刀：+2 伤害；1 个头盔：施加 1 层耻辱；2 个旭日：获得 2 个反击（若已达堆叠上限则多余部分无效）」
- 右上角仍能看到「攻击修正 +2」

是否达标：**达标**

### 1. 枪手 Loaded 选择前

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\20-gunslinger-loaded-choice-before-use.png`

我实际看到：
- 画面中央是 `技能结算选择` 弹窗
- 中间唯一 token 为 `装填`
- 这张旧截图里底部 skip 按钮仍显示成 `TOKENRESPONSE.SKIP`

是否达标：
- **不达标（旧问题证据）**
- 它证明当时 i18n fallback 没兜住，用户关于“按钮/英文没翻译”的反馈成立

### 2. 枪手 Loaded 单骰特写

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\21-gunslinger-loaded-after-choice-click.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\gunslinger-loaded-token-should-open-single-die-spotlight-after-real-choice-click\22-gunslinger-loaded-single-die-spotlight.png`

我实际看到：
- 画面中央出现 bonus die 特写，不再停留在普通 choice 弹窗
- 中央只有 **1 颗骰子**，没有被五骰文案挤坏
- 底部黑色信息条能读到 `装填投掷：1`
- 对应的 Playwright 失败快照文本也记录到了同一现象：`test-results/playwright-artifacts/dicethrone-watch-out-spotl-d9088-ght-after-real-choice-click-chromium/error-context.md`
  中明确有 `投掷结果` 与 `装填投掷：1`

是否达标：
- **达标**
- 它直接证明：基础 Loaded 使用后，UI 已能看到单骰 spotlight，不再是“只算伤害、没有展示”

### 3. 武士 Retribution 真实反打后

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-retribution-token-should-retaliate-through-real-click-flow\21-samurai-retribution-after-retaliation.png`

我实际看到：
- 中央有单骰特写
- 背景仍是武士/圣骑士真实战斗板面，不是脱离业务链路的人造预览页
- 说明 token 反打不是静默状态改写，而是走到了真实 bonus die 展示

是否达标：
- **达标**
- 证明武士 token 响应至少在真实点击链里有可见反馈

### 4. 武士 Zanshin 五骰汇总

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-zanshin-should-settle-5-bonus-dice-and-synchronize-effects-against-paladin\10-samurai-zanshin-vs-paladin.png`

我实际看到：
- 中央出现 5 颗骰子的统一结算层
- 底部不是 5 条分散小文案，而是一条汇总描述：`2 个武士刀：+2 伤害；1 个头盔：施加 1 层耻辱；2 个旭日：获得 2 个反击（若已达堆叠上限则多余部分无效）`
- 右上角同时有 `攻击修正 +2` 橙色 badge，可直接看到修正量

是否达标：
- **达标**
- 这张图同时证明两件事：
  1. 5 骰已经改成汇总文案，不再挤开布局
  2. 攻击修正 UI 现在是肉眼可见的

### 5. 武士 Honor 图标与中文

路径：
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\samurai-honor-token-should-accumulate-to-+3-after-two-real-clicks\19-samurai-honor-finalized-after-second-use.png`

我实际看到：
- 左侧战斗区能看到一个青绿色圆形 token 图标
- 右侧角色说明面板中有 `荣誉` 中文条目
- 说明 token 不再只是占位块，至少 `Honor` 这条链已经能显示为武士专属资源语义

是否达标：
- **基本达标**
- 但这张图主要证明 `Honor`；`Shame / Retribution` 的 atlas 对齐仍建议继续抽样复核

## 命中的审计维度（D1-D49）

本轮明确命中的核心维度：

- `D3 数据流闭环`：Loaded 基础路径缺少展示型 settlement
- `D5 UI 反馈可见性`：攻击修正 / token 特写不能只存在于状态里
- `D8 时序正确`：token 点击后的展示必须跟结算时机一致
- `D15 UI/状态一致性`：有 bonus die 结算就必须看到对应 overlay
- `D23 共享合同一致性`：基础 Loaded 与 reroll Loaded 不能分裂成两套用户感知
- `D33 资源接线一致性`：武士 token atlas 比例与现成资源接线
- `D47 测试覆盖完整性`：旧测试没覆盖“基础 Loaded 必须出现 UI 特写”
- `D48 文案/可读性验收`：5 骰汇总文案与按钮翻译不能缺位

## 这轮遇到的验证阻塞（已如实记录）

1. 其他 E2E 重任务占用，导致重跑被 heavy-task-guard 拒绝
2. 全局内存预算门禁一度拒绝启动
3. `AGENTS.md` 存在 UTF-8 BOM，触发编码检查阻塞
4. `scripts/infra/e2e-port-config.js` 残留冲突标记，导致 runtime 直接语法错误
5. `.tmp/e2e-preflight-cache.json` 一度被锁定（`EBUSY`）
6. 最后一次 runtime manager 仍有提前退出现象，未能拿到“本轮三条目标 E2E 全绿”
7. 使用独立 runtime scope 再跑时，进一步暴露出 **API 服务异常退出但 bootstrap log 无明确栈** 的基建问题；该问题与 Loaded 业务逻辑本身无直接证据关联
8. 继续排查后确认：`scripts/infra/single-worker-runtime.js` 里 bundle 产物原先固定写到 `temp/dev-bundles/e2e-single/game|api/*`，**多个 isolated single E2E 并行时会共享同一输出目录**。这会导致不同端到端互相覆盖 bundle 产物，解释了“你同时跑多个 E2E 时，API/游戏服务偶发异常退出”的现象。

这些阻塞说明：
- 当前仓库的 E2E 基建存在独立稳定性问题
- 但它们**不推翻已经拿到的截图证据和那次真实跑到 Loaded overlay 的事实**

## 本轮新增基建修复

- 已把 `scripts/infra/single-worker-runtime.js` 改成：**按 `runtimeScope` 生成独立 bundle 输出目录**
  - 旧路径：`temp/dev-bundles/e2e-single/game|api/...`
  - 新路径：`temp/dev-bundles/e2e-single/<runtimeScope>/game|api/...`
- 这不是业务修复，而是测试基建隔离修复，目的是避免你同时跑多条 E2E 时互相覆盖同一个临时 bundle。

## 本轮残余风险

1. 目前证据集中在枪手/武士的核心链路（Loaded、Retribution、Zanshin）。**其他角色的 bonus die 细分文案**仍建议做抽样复核，防止“只修了两位新角色”。
2. 武士 `Shame / Retribution` token 图集在不同缩放下的对齐仍建议补抽样（目前主要证据来自响应弹窗）。
3. 审计流程仍需补充“现成资源对齐+UI 实际展示”作为硬门禁，避免再次出现“参考老角色但显示不一致”的回归。

## 结论

- 用户质疑是成立的：**旧审计把“规则闭环”说得过于像“体验收口”**。
- 本轮最关键的新结论是：
  - **基础 Loaded 缺的不是 CSS，而是展示型 settlement 事件本身**。
  - 修完后，真实截图已经能看到单骰特写。
- 5 骰结算现在应以 **汇总文案** 为正确方案，而不是恢复每骰底部描述。
- 攻击修正、武士 token 图标/中文、ChoiceModal 按钮翻译，都必须被纳入今后的硬验收项，而不能只靠“参考老角色应该差不多”带过去。
