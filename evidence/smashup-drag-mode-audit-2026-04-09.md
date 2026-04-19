# Smash Up 拖拽模式全量审计（2026-04-09）

## 背景
- 用户反馈不是单点问题，而是两类问题叠加：
  1. **交互语义泄漏**：全局“拖拽出牌”偏好不该污染 prompt 选择语义，但“额外打出随从”等手牌选择 prompt 被错误看成可拖拽。
  2. **视觉引导质量问题**：正常拖拽时的箭头曲线不自然，出现“前段鼓起、尾段发折”的观感。

## 审计范围
- `D:\gongzuo\webgame\BoardGame\src\games\smashup\Board.tsx`
- `D:\gongzuo\webgame\BoardGame\src\games\smashup\ui\HandArea.tsx`
- `D:\gongzuo\webgame\BoardGame\src\games\smashup\ui\interactionMode.ts`
- `D:\gongzuo\webgame\BoardGame\src\components\game\framework\widgets\GameHUD.tsx`
- `D:\gongzuo\webgame\BoardGame\e2e\smashup-local-gameplay.e2e.ts`

## 根因分类

### 1. 全局偏好和当前 prompt 语义没有彻底分层
- `interactionMode = drag` 本质上只是“**正常打牌**时的输入偏好”。
- 之前代码只对“手牌直选 + 弃牌到上限”做了局部门禁，**没有把所有 active prompt surface 一起纳入分类**。
- 结果是：
  - 手牌直选 prompt 可能被误看成拖拽入口；
  - 基地/随从/ongoing/弃牌堆等非手牌 prompt 期间，手牌表面上仍可能保留正常打牌语义。

### 2. 防御逻辑分散，UI 表层和提交层不一致
- `handleCardDragPlay()` 已经有一层 prompt 防守，但 `HandArea` 的呈现模式仍可能来自全局 drag 偏好。
- 这会导致“**看起来能拖，但松手又不该生效**”的错觉。

### 3. 相邻手牌能力没有一起收口
- 非 hand prompt 激活时，除手牌本身外，**set-aside titan** 也属于同一批“手边正常出牌入口”。
- 如果不一起锁，后续容易以另一种入口复发同类问题。

### 4. 拖拽箭头曲线参数不够平顺
- 旧曲线前段抬升过猛、后段抬升不足，导致肉眼观感生硬。

## 审计结论：各类 prompt 应该如何处理

| 交互场景 | UI 承接面 | 手牌模式 | 结论 |
|---|---|---|---|
| 正常打牌（无 prompt） | 手牌 / 棋盘 | 跟随用户 click/drag 偏好 | 可 drag |
| 手牌单选 prompt（`targetType: hand` 且非 multi） | 手牌区直接点选 | 强制 click | **必须 click** |
| 手牌多选 prompt（`targetType: hand` 且 multi） | PromptOverlay | 强制 click | **必须 click** |
| 基地选择 prompt（`targetType: base`） | 棋盘基地 | 手牌锁定 | **必须 click，不得拖手牌** |
| 随从选择 prompt（`targetType: minion`） | 棋盘随从 | 手牌锁定 | **必须 click，不得拖手牌** |
| ongoing 选择 prompt（`targetType: ongoing`） | 棋盘 ongoing | 手牌锁定 | **必须 click，不得拖手牌** |
| 埋葬牌选择 prompt（generic + buried） | 棋盘埋葬区 | 手牌锁定 | **必须 click，不得拖手牌** |
| 弃牌堆随从 prompt（`targetType: discard_minion`） | 弃牌条 + 基地点击 | 手牌锁定 | **必须 click，不得拖手牌** |
| button / generic overlay prompt | PromptOverlay | 手牌锁定 | **必须 click，不得拖手牌** |

## 本轮代码修复

### 1. 引入统一的 hand prompt / hand interaction 分类
- 使用 `resolveSmashUpHandPromptUiMode()` 区分：
  - `direct`：手牌区直接承接
  - `overlay`：继续交给 `PromptOverlay`
  - `none`

### 2. 新增 `activePromptSurface`
- 统一把当前 prompt 归类为：
  - `none`
  - `hand`
  - `board`
  - `overlay`

### 3. 拖拽模式统一退回 click
- `resolveSmashUpHandInteractionMode()` 现在按 **active prompt surface** 决定，而不是只看 hand prompt。
- 只要当前存在任意 prompt surface，或处于弃牌到上限阶段，**手牌统一强制 click**。

### 4. 非 hand prompt 期间锁 normal hand interaction
- `shouldLockNormalHandInteraction` 用于锁住：
  - 手牌正常点击出牌
  - 手牌正常拖拽出牌
  - set-aside titan 的正常激活

### 5. E2E 补强
- 在现有 `smashup-local-gameplay.e2e.ts` 中补了 3 段真实链路验证：
  1. hand prompt 下拖动手牌不会出现拖拽箭头，也不会偷偷把牌打出去。
  2. base prompt 下拖动手牌不会出现拖拽箭头，也不会误打到基地。
  3. prompt 清空后，正常拖拽仍能出现箭头并完成打出。

## 视觉验收截图与肉眼结论

### A. hand prompt 应保持点击选择
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：手牌额外交互应保持点击选择，正常拖拽箭头曲线应可见且更平顺\smashup-drag-prompt-click-mode.png`
- 我实际看到：
  1. 顶部明确显示“选择要额外打出的随从”，中部有“跳过”按钮，说明当前确实处在额外随从选择 prompt。
  2. 手牌区两张手牌仍在底部，但**没有出现任何拖拽箭头**。
  3. 这张图里看不到“正常拖拽引导文案”或箭头头部，说明 prompt 没被误当成拖拽出牌。
- 是否达到验收标准：
  - **达到。**

### B. board prompt 期间也不能把手牌误拖出去
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：手牌额外交互应保持点击选择，正常拖拽箭头曲线应可见且更平顺\smashup-drag-board-prompt-lock-mode.png`
- 我实际看到：
  1. 顶部提示变成“选择一个基地”，说明现在是基地选择 prompt，不是手牌 prompt。
  2. 两个可选基地发紫光，第三个基地被压暗，符合“棋盘点击选择”的语义。
  3. 手牌仍显示在底部，但**没有拖拽箭头，也没有把手牌拖到基地的视觉引导**。
- 是否达到验收标准：
  - **达到。**

### C. 正常拖拽时箭头曲线需要自然
- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：手牌额外交互应保持点击选择，正常拖拽箭头曲线应可见且更平顺\smashup-drag-arrow-curve-optimized.png`
- 我实际看到：
  1. 橙色箭头从手牌上缘自然抬起，往左上目标基地弯过去，没有贴着卡牌乱折。
  2. 中段弧线连续，没有“前面突然鼓起、后面突然变直”的折感。
  3. 提示气泡“松手打到这个基地”出现在曲线中段附近，和箭头方向一致，目标也被高亮。
- 是否达到验收标准：
  - **达到。**

## 自动化验证

### 已通过
1. `npx eslint src/games/smashup/Board.tsx src/games/smashup/ui/interactionMode.ts e2e/smashup-local-gameplay.e2e.ts`
   - 结果：0 error
   - 备注：仅剩仓库既有 warning（`Date.now()` purity、旧 `any`），与本轮问题无关。

2. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts -t "hand targetType 的交互必须先按 direct / overlay 分流，再决定是否允许拖拽" --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
   - 结果：**1 passed / 6 skipped**
   - 说明：锁定本轮新增的 hand prompt 语义分流 helper 行为。

3. `npm run test:e2e:ci:file -- e2e/smashup-local-gameplay.e2e.ts "本地模式：手牌额外交互应保持点击选择，正常拖拽箭头曲线应可见且更平顺"`
   - 结果：**1 passed**
   - 时间：2026-04-09 01:25（Asia/Shanghai）

### 本轮补充截图
- 局部箭头截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-local-gameplay.e2e\本地模式：手牌额外交互应保持点击选择，正常拖拽箭头曲线应可见且更平顺\smashup-drag-arrow-curve-optimized-arrow.png`
- 我实际看到：
  1. 箭头从手牌上缘起弧，整条曲线连续，没有中段折返。
  2. 提示气泡落在曲线中段偏上，方向与箭头一致。
  3. 目标基地仍保持高亮，说明视觉引导和真实落点没有脱节。
- 是否达到验收标准：
  - **达到。**

## 审计门禁现状（非本轮回归）
- 我额外运行过完整审计文件：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts --config vitest.config.audit.ts --configLoader native --maxWorkers 1`
- 结果中有 **1 条与本轮无关的既有失败**：
  - `D:\gongzuo\webgame\BoardGame\src\games\smashup\domain\baseAbilities_expansion.ts:80 [base_the_asylum] targetType 期望 "button"，实际 "hand"`
- 结论：
  - 这是 Smash Up 既有审计债，不是这次 drag-mode 修复引入的新问题；
  - 本轮只把“hand prompt / board prompt / 正常拖拽”这一条交互串线问题收口并留证。

## 防再发规则
1. `interactionMode=drag` 只能代表“正常打牌输入偏好”，**绝不能直接等同于当前 prompt 也允许拖拽**。
2. 以后 Smash Up 新增 prompt 时，必须先判断它属于：
   - `hand`
   - `board`
   - `overlay`
   - `none`
3. 只要 `activePromptSurface !== 'none'`，手牌默认就不再是“正常打牌入口”。
4. E2E 以后至少保留一条“prompt 锁手牌 + 正常拖拽恢复”的代表用例，防止语义再次串线。
