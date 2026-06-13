# SmashUp 线上反馈收口（6a2a58e18061c85a5fc8b82a）

## 范围

- 反馈 ID：`6a2a58e18061c85a5fc8b82a`
- 游戏：`smashup`
- 反馈原文：`外星人的家园配合丧尸的战术他们来了，可以从弃牌堆里打出高于2点战力的随从，且可以一直打，达到弃牌堆中没有牌为止。`
- 关联对象：
  - 母星（`base_the_homeworld`）
  - 他们来了（`zombie_theyre_coming_to_get_you`）

## 真相源

- 生产反馈快照：`temp/feedback-open-6a2a58e1.ejson.json`
- 生产反馈回写前状态：`temp/feedback-closeout/query-feedback-6a2a58e1-before-writeback-20260612.raw.txt`
- 生产反馈回写结果：`temp/feedback-closeout/update-feedback-status-20260612-6a2a58e1-to-resolved.raw.txt`
- 生产反馈回写后状态：`temp/feedback-closeout/query-feedback-6a2a58e1-after-writeback-20260612.raw.txt`
- 生产人工反馈未收口列表回写后快照：`temp/feedback-closeout/query-human-open-inprogress-after-20260612.raw.txt`
- 生产人工反馈未收口数量回写后快照：`temp/feedback-closeout/query-human-open-inprogress-count-after-20260612.raw.txt`

现场快照可直接看到：

- 0 号位在母星上已有 `他们来了`
- 玩家同时存在普通额外随从额度与母星的“力量不高于 2”受限额度
- 实际从弃牌堆继续打出了力量 `3 / 4 / 5` 的随从

## 根因

- 问题不在普通手牌出牌链。
- 真正失守的是“从弃牌堆打出随从，并且这次出牌会消耗普通随从额度”这条链。
- 旧逻辑在“普通额外额度”和“母星给的力量受限额度”并存时，会让弃牌堆高战力随从错误走进普通额度，从而绕过母星限制。

## 本轮修复

- `src/games/smashup/domain/playLegality.ts`
  - 在 `validateDiscardMinionPlaySemantics(...)` 中补上并存额度场景的力量上限拦截。
- `src/games/smashup/domain/commands.ts`
  - `PLAY_MINION fromDiscard` 改为统一复用 `validateDiscardMinionPlaySemantics(...)`，不再走更松的重复判断。
- `src/games/smashup/__tests__/abilities/zombies.test.ts`
  - 新增：`zombie_theyre_coming_to_get_you: 普通额外额度与母星力量受限额度并存时，仍不得从弃牌堆打出高战力随从`
- `src/games/smashup/__tests__/baseRestrictions.test.ts`
  - 新增：`公共弃牌堆出牌校验：全局受限额度和普通额度并存时，仍必须先满足力量限制`

## 本地验证

- 验证命令：
  - `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseRestrictions.test.ts src/games/smashup/__tests__/abilities/zombies.test.ts src/games/smashup/__tests__/abilities/robots.test.ts --configLoader native --testNamePattern "母星|zombie_theyre_coming_to_get_you|robot_microbot_fixer"`
- 结果：
  - `3` 个测试文件通过
  - `14` 个定向测试通过

## 生产反馈状态

### 1. 本地已修

- 已定位根因并补定向回归。

### 2. 已推送

- 本轮未执行 `git push`。

### 3. 已部署

- 本轮未核对生产容器 revision，也未执行部署。
- 因此这里不能把结论表述成“生产代码已上线”。

### 4. 已回写状态

- 生产 `boardgame.feedbacks` 中该条反馈已由 `open` 回写为 `resolved`。
- 回写结果：`matchedCount=1`、`modifiedCount=1`
- 回写后生产人工 `feedback-modal` 的 `open/in_progress` 数量为 `0`。

## 收口结论

- `6a2a58e18061c85a5fc8b82a`：`resolved`
- 含义：
  - 当前仓库已补齐对应根因与回归测试
  - 生产反馈状态已正式回写
- 当前边界：
  - 本轮没有提交、推送或部署证据，不能把这条文档表述成“生产包已带上修复”
