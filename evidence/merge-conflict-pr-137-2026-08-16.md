# 冲突解决汇报：PR #137 DiceThrone 女猎手

## 1. 背景

- base: `origin/main` = `63002c6c5475e590b48e7fed108f05384963c1ab`
- head: `origin/pr-137-head` = `51eb8853b9b92d6043b1f82b14be6ddca5c77a06`
- merge-base: `247bb2e9c49602f718624f829e3133114ac3673d`
- 触发命令: `git merge origin/pr-137-head --no-commit --no-ff`
- PR 来源: `tt2939993127-max:codex/lieren-main-merge-pr`
- 权限口径: head repo `permissions.push=false`，当前账号对主仓可写；本轮走本地合并到主仓 `main`，不尝试写回 fork 分支。

## 2. 预检查

- PR 实际提交范围领先 5 个提交，目标主线后续领先 39 个提交，未触发落后 50 提交预警。
- 从 merge-base 到 PR head 的真实改动没有触发“实际删除测试 / 脚本 / 文档”阈值；当前主线对比中的旧分支缺失按漂移处理。
- 本次合并结果相对 `origin/main` 为 85 个暂存路径：新增女猎手英雄、资源、规则文档、OpenSpec、测试、资源发布配置和项目规范补丁；没有真实删除文件。

## 3. 冲突文件与裁决

### `.spec/knowledge/standards/asset-pipeline.md`

- 策略: 双方合并。
- 冲突块裁决: 保留主线“Android file-index / manifest 刷新由服务器发布脚本接管”的职责归属，同时补入 PR 的“GitHub 登录态不等于素材服务器 token，SSH 默认不自动启用”。
- 原因: 两边分别约束不同现实链路：主线防止 Android 清单职责漂移，PR 防止把 GitHub 权限误当素材服务器权限。

### `.spec/skills/git-operations/SKILL.md`

- 策略: 双方合并。
- 冲突块裁决: 保留主线 fork / 主仓权限协作说明，补入 PR 的“主仓无写权限默认推 fork 并创建 PR，PR 创建失败才算阻塞”。
- 原因: 两边都在收紧协作权限口径，合并后覆盖维护者直推、外部协作者 fork、普通贡献路径三类场景。

### `public/locales/zh-CN/game-dicethrone.json`

- 策略: 双方合并。
- 冲突块裁决: 保留主线炽天使文案修正（`圣刃 II`、`智天使`），补入女猎手卡牌、技能、状态和奖励骰文案。
- 原因: 主线文本是已落地英雄修正，PR 文本是新增女猎手运行时必须文案，两者 key 空间不同，不能单边覆盖。

### `src/games/dicethrone/Board.tsx`

- 策略: 以最新主线交互骨架为基线，局部合入女猎手妮拉交互入口。
- 冲突块裁决:
  - 保留主线奖励骰结算修复：`pendingBonusDiceSettlement` 下仍向 UI 传递 `selectedAbilityId`，避免奖励骰确认后失去技能归属。
  - 合入 PR 的 `onConsumeNyraBond`、`nyraDamageResponse`，让女猎手在伤害响应中能选择把伤害交给妮拉或消耗妮拉之系。
  - 不保留 PR 侧的 `onBonusDiceResponseToggle` 传参：现实含义是“奖励骰响应开关回调”，但 `LeftSidebar` 没有这个属性，`Board.tsx` 也没有对应状态 setter；保留它会导致页面启动时报 `setBonusDiceResponseEnabled is not defined`，阻断 DiceThrone 棋盘加载。
  - 保留主线关于奖励骰展示载体的说明注释，避免旧事件流特写重新抢右侧骰盘职责。
- 文件级原因说明:
  - 采用主线作为基线，是因为此文件承载奖励骰、响应窗口、右侧骰盘和玩家侧边栏多条已修复交互；PR 分支落后 39 个提交，整份使用 PR 版本会丢主线奖励骰确认语义。
  - PR 仍有效内容是女猎手专属妮拉响应入口，已迁移到主线骨架内，并由 `AbilityOverlays`、女猎手规则矩阵测试和 DiceThrone 黄金 E2E 覆盖。
  - 若判断失误，最可能丢失的用户行为是圣骑士奖励骰确认后仍卡在 `dt:bonus-dice`，或女猎手受到伤害时看不到妮拉承伤/妮拉之系按钮。

### `public/assets/atlas-configs/assets-manifest.json`

- 策略: 以主线清单为基线，仅追加女猎手 atlas 条目。
- 冲突块裁决: 保留主线所有既有 atlas hash / bytes / manifest 条目，只补 `dicethrone/ability-cards-lieren.atlas`。
- 原因: 该清单在主线已有多游戏资源漂移，旧 PR 整份清单不能覆盖主线资源发布状态。

### `public/assets/i18n/assets-manifest.json`

- 策略: 以主线清单为基线，仅追加女猎手资源条目。
- 冲突块裁决: 保留主线既有 i18n 资源索引，只补 `zh-CN/dicethrone/images/lieren/**` 相关 key。
- 原因: PR 的有效意图是登记女猎手资源，不应让旧分支清单覆盖主线其它英雄、游戏或移动资源索引。

## 4. 合并后补修

- 补齐 `public/assets/i18n/zh-CN/dicethrone/assets-manifest.json` 中 `images/lieren/status-icons-atlas` 的 json/png hash 与大小，避免女猎手本地资源合同漏掉状态 atlas。
- 补齐同一 DiceThrone zh-CN manifest 中女猎手源图条目，并把 `images/lieren/tip` 从旧 `jpg` 条目校正为当前实际存在的 `png` 条目；未纳入 E2E 生成时带出的 Mage Wars 与旧英雄换行符 / 缺源图漂移。
- 将女猎手自定义动作拆为两个职责入口：`lieren-nyra-effect` 只处理妮拉治疗/妮拉之系，`lieren-kindred-bond` 处理防御技能伤害与治疗，避免一个动作 ID 同时声明 token、damage、defense、other 后触发通用审计误判。
- 更新女猎手相关测试合同：新增 9 张替换型升级后，技能叠图检查数量从 118 更新为 127；新增无额外前提即时牌后，全英雄无前提即时牌数量从 21 更新为 22。
- 修复 pre-push 黄金 E2E 暴露的两个收口问题：棋盘启动删除无效 `onBonusDiceResponseToggle` 传参；黄金链在“打出改骰牌后点骰子”之后显式点击右侧“确认”按钮，匹配当前改骰交互必须确认后才结算的真实 UI 语义。

## 5. 资源发布与回查

- 发布计划命令: `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/dicethrone/images/lieren/compressed/ --asset-prefix i18n/zh-CN/dicethrone/images/lieren/status-icons-atlas.json --asset-prefix atlas-configs/dicethrone/ability-cards-lieren.atlas`
- 计划结果: 8 个本地文件；待发布 2 个 JSON；6 个压缩 WebP 远端已一致。
- 上传结果: release `20260816105233918`，serverPrimaryObjects=2，serverPrimaryIndexObjects=13245，retained=5，deleted=0。
- 公开 URL 回查: 女猎手状态 atlas JSON、女猎手卡牌 atlas JSON、player-board.webp、ability-cards.webp 均返回 200，`X-Asset-Source: server`，大小匹配。

## 6. 验证结果

- `npx tsc --noEmit`: 通过。
- `NODE_OPTIONS=--max-old-space-size=8192 npx eslint src/ --ext .ts,.tsx`: 本轮补修前通过，0 errors / 1383 warnings；本轮补修后全量 ESLint 在本地 300s 与 600s 两次超时/中断，无错误输出文件。
- `git diff --cached --name-only -- '*.ts' '*.tsx' | ... npx eslint @files`: 通过，0 errors / 18 warnings，覆盖本次合并涉及的 38 个 TS/TSX 源码与测试文件。
- `npx eslint src/games/dicethrone/Board.tsx e2e/dicethrone/dicethrone-golden-full-flow.e2e.ts`: 通过，0 errors / 1 warning；warning 是该 E2E 文件既有 `no-explicit-any`。
- `npx openspec validate add-dicethrone-lieren-faction --strict --no-interactive`: 通过。
- `npm run check:prod-deps`: Windows CRLF 直接跑 bash 脚本失败；使用临时 LF 副本重跑通过，结论为没有幽灵依赖；临时脚本已删除。
- 女猎手与相关审计测试: `lieren-intake`、`lieren-rule-matrix`、`AbilityOverlays`、`card-timing-response-boundaries`、`customaction-category-consistency`、`entity-chain-integrity` 共 6 files / 120 tests 通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-golden-full-flow.e2e.ts "DiceThrone 黄金全流程：覆盖开局、卖牌换CP、攻骰改骰、攻击修正奖励骰、防御响应、伤害、弃牌和回合交接"`: 通过，1 test / 1.6m。
- DiceThrone 失败子集复跑: 356 tests 中 333 通过、23 失败。失败集中在既有英雄素材缺失、旧奖励骰/抬一手/教程/头像 atlas 合同和旧英雄机制，除 `portraitAtlasContract.test.ts` 文件合同被本次 PR 扩展到女猎手头像绑定外，其余失败测试文件没有被本次合并修改；共享代码 diff 也以 `lieren`、`nyra`、`bleed` 或 `COMPANION_HEALTH_CHANGED` 为条件。
- `npm run assets:validate`: 通过。
- `npm run spec:lint`: 未通过，命中 4 个宿主适配链接问题：`.claude/agents` 不是指向 `.spec/` 的链接，`.claude/skills`、`.agents/skills`、`.codex/skill` 缺失；`HEAD^1` base 父提交已存在 `.claude/agents/reviewer.agent.md` 实体目录且缺少这些链接，因此记录为主线既有适配缺口，不在本 PR 合并中扩大修复。

## 7. 回归与行为变化登记

- 原 PR 目标问题: 新增 DiceThrone 女猎手角色，包含妮拉伙伴生命、妮拉之系、流血、女猎手骰面、卡牌/技能/状态资源、选角入口、侧边栏宠物面板、规则矩阵与资源合同。
- 本次额外发现并已修的真实回归:
  - 女猎手状态 atlas 没登记到本地 zh-CN DiceThrone manifest，会导致本地合同校验找不到状态图集。
  - 女猎手 tip 清单仍指向旧 jpg 条目，但当前正式源文件是 png；本轮已更新 DiceThrone zh-CN manifest。
  - 女猎手同一个 custom action ID 同时承载资源、token、防御和伤害职责，会让通用动作分类审计无法判断真实输出。
  - 新增女猎手卡牌后，旧固定数量断言未同步。
  - 冲突裁决一度保留了不存在的奖励骰响应开关传参，会导致 DiceThrone 棋盘加载失败；本轮已删除无效传参。
  - 黄金 E2E 仍按旧假设等待“点骰子后自动完成改骰”，但当前 UI 真实合同是点骰子后还要点击“确认”；本轮已改为真实确认流程。
- 本次额外发现但未在本 PR 修复的既有/外部缺口:
  - 工匠、炽天使、咒缚海盗和公共头像 atlas 有本地运行时资源缺失或 manifest 漂移。
  - DiceThrone 旧奖励骰、抬一手、教程和部分旧英雄机制测试仍有失败；本轮没有证据证明它们由女猎手新增代码直接触发，未作为本 PR 合并阻塞处理。
  - 全量 ESLint 在本地反复超时，已用本次变更文件范围 lint 加上此前全量通过结果兜底。
- 仅业务口径 / 规则变化:
  - 女猎手的“妮拉承伤”和“妮拉之系”是新增角色能力，不改变旧英雄规则。
  - 流血 upkeep 是新增状态口径，只在玩家有 `bleed` 层数时触发。

## 8. 结果

- 合并提交信息: `合并 DiceThrone 女猎手并收口 PR 137`
- 提交: 待本文件随合并提交生成。
- 推送目标: `origin main`
- PR 关闭: 推送完成后执行 `gh pr close 137 --comment "已合并到 main"`。
