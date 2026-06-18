# BoardGame 项目 Skill 约定

这个目录是 **BoardGame 项目内 skill 的唯一目录**。只要属于本仓库项目 skill，就必须放在 `./.codex/skill/`。

## 放置规则

新增或改动 skill 前，先判断落点：

1. **跨项目可复用的通用能力**  
   例如通用 TDD、通用 UI/UX、通用 PR 审查。  
   这类优先放到全局 / 用户级 skill；项目目录只保留 BoardGame 的增量约束。

2. **BoardGame 专属 workflow**  
   只要内容依赖本仓库目录、脚本、游戏模型、验收门禁、evidence、R2/CDN、manifest、E2E 口径，就应放在本目录。

3. **BoardGame 对通用 skill 的补充层（overlay）**  
   如果只是“在通用 skill 之上再加本项目约束”，本目录里只保留增量规则：
   - 先说明“先用哪个全局 skill”
   - 再写本项目补充
   - 不要把通用 skill 正文整份复制进来
   - 不要把本项目事故、项目口径、项目补丁反写回 `D:\\codex-home\\skills\\**`

## 目录硬规则

1. 项目 skill 只允许出现在 `./.codex/skill/`。
2. 不允许在 `./.codex/skill/` 之外保留项目 skill 正文、README、重定向说明或副本。
3. 调整目录结构时，必须同步清理多余入口和过时引用，保持单目录状态。
4. 未经用户当轮明确要求，禁止把项目 skill 的新增条款、项目事故结论或项目 overlay 规则上升到全局 skill。

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
- `merge-decision-package`
- `merge-pr-workflow`
- `smashup-faction-addition`
- `sticker-imagegen`

### 项目 overlay

- `audio-integration`
- `git-operations`
- `github-pr-review-merge`
- `tdd`
- `ui-ux-pro-max`

### 仓库内辅助 skill

- `brainstorming`
- `planning-with-files`

## 特殊说明

- `mobile-adaptive`
  这是仓库内仍在维护的一份 OpenSpec/mobile-first workflow。是否使用，按具体任务决定。
- `mobile-responsiveness`
  这是项目内的移动端路由 skill；新任务默认优先走 `adapt-game-mobile`。
- `pua-debugging`
  这是项目内的恢复/收敛路由 skill；新任务默认直接使用全局 `pua`。

## 最低门禁

任何新建或改写的项目 skill，至少要回答四个问题：

1. 这份内容离开 BoardGame 还能成立吗？
2. 它是否依赖本仓库路径、脚本、资源链路或验收口径？
3. 它是在补充全局 skill，还是想替代全局 skill？
4. 如果别的项目也看到了这份 skill，会不会被误导成通用规则？
5. 这条内容如果写进 `D:\\codex-home\\skills\\`，会不会把 BoardGame 的局部经验冒充成跨项目默认？
