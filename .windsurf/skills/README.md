# BoardGame 项目 Skill 约定

这个目录是 **BoardGame 项目专用 skill 入口**。虽然一些 Codex 通用说明会把项目 skill 写成 `.codex/skills/`，但 **本仓库统一使用 `./.windsurf/skills/` 作为项目 skill 目录**。

## 放置规则

新增或改动 skill 前，先判断落点：

1. **跨项目可复用的通用能力**  
   例如通用 TDD、通用 UI/UX、通用 PR 审查。  
   这类应放到全局 / 用户级 skill，**不要**复制一整份到项目目录。

2. **BoardGame 专属 workflow**  
   只要内容依赖本仓库目录、脚本、游戏模型、验收门禁、evidence、R2/CDN、manifest、E2E 口径，就应放在本目录。

3. **BoardGame 对通用 skill 的补充层（overlay）**  
   如果只是“在通用 skill 之上再加本项目约束”，本目录里只保留 **增量规则**：
   - 先说明“先用哪个全局 skill”
   - 再写本项目补充
   - 不要把通用 skill 正文整份复制进来

## 当前分类

### 项目 workflow

- `adapt-game-mobile`
- `add-new-faction`
- `android-app-release`
- `atlas-crop`
- `boardgame-ui-imagegen`
- `create-new-game`
- `data-entry-workflow`
- `deploy-after-ci`
- `feedback-closeout`
- `game-ai-adaptation`
- `game-audit-workflow`
- `generated-design-implementation`
- `merge-pr-workflow`
- `smashup-faction-addition`
- `sticker-imagegen`

### 项目 overlay

- `git-operations`
- `github-pr-review-merge`
- `tdd`
- `ui-ux-pro-max`

### 历史兼容 / 重定向

- `mobile-responsiveness`
  这是通用 mobile-first 思路的历史副本；本项目实际应改走 `adapt-game-mobile`。
- `pua-debugging`
  这是通用恢复/逼进度思路的历史副本；本项目应直接使用全局 `pua`。

## 命名建议

- **项目 workflow**：优先用业务名或仓库语义，例如 `add-new-faction`、`deploy-after-ci`
- **项目 overlay**：优先保留“正在补充哪个全局 skill”的语义，但正文必须明确这是 overlay，不是全量副本
- **禁止**：把某个项目事故、某个游戏字段、某次临时流程直接升格成“所有项目通用 skill”

## 最低门禁

任何新建或改写的项目 skill，至少要回答四个问题：

1. 这份内容离开 BoardGame 还能成立吗？
2. 它是否依赖本仓库路径、脚本、资源链路或验收口径？
3. 它是在补充全局 skill，还是想替代全局 skill？
4. 如果别的项目也看到了这份 skill，会不会被误导成通用规则？
