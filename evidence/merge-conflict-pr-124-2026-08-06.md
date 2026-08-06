# PR #124 三方合并裁决记录

## 合并对象

- PR：#124「新增并闭环大杀四方迪士尼首批四派系」
- 主线父提交：`f032be421f1ddb4458711293510f9eafc52ad389`
- PR 父提交：`6ed10963f8259194af06d820b1903319646480cb`
- 共同祖先：`225b0bf0aa2c26dca0e01b41544ee8ffe39884ad`
- 合并提交：`c60fabc321da21e66d9f3e88567cff223c6e9079`

PR 分支相对共同祖先落后主线 86 个提交，因此本次按文件内容和三方差异裁决，没有把 PR 分支整份覆盖到主线。

## 裁决结果

### 保留主线版本

以下内容在主线已经有更新版本，或 PR 侧相对主线表现为旧分支回退，因此以主线为准：

- Disney 基地/卡图资源、两份资源 manifest：保留主线 #122 的资源与哈希；PR 旧资源未覆盖主线。
- 中英文 Smash Up locale：保留主线已有文案、Munchkin、半场战争、企鹅、DIY 等内容；没有采用 PR 旧 locale 的整份删除。
- `disney-factions-abilities.test.ts`、`criticalImageResolver.test.ts`：保留主线已有测试，包括贝儿、玫瑰花瓣、冬季惊喜和主线既有派系图片测试；没有接受 PR 删除测试的结果。
- `beauty_and_the_beast.ts`、能力注册、卡牌注册、图集目录、ID 定义：保留主线当前并集和交互实现，避免丢失主线新增派系和注册。

### 吸收 PR 有效内容

- PR 新增的阿拉丁、美女与野兽、圣诞夜惊魂、无敌破坏王数据、能力、静态测试、真实入口 E2E 和 OpenSpec 文件在主线已有等价内容时不重复覆盖；逐项比对确认合并树保留这些内容。
- PR 审计 evidence 与 OpenSpec tasks 的 closeout 信息被吸收，但同步修正为当前合并现场的事实：公开资源地址可访问但仍是旧资源版本，全量资源校验仍有既有 Dice Throne manifest 漂移。

### 合并现场的必要辅助修复

`src/games/smashup/domain/index.ts` 增加了最小后处理修复：当命令事件已经先归约时，弃牌/磨牌触发器从归约后的各玩家弃牌堆按 UID 回查卡牌快照。否则“玫瑰花瓣”这类弃牌触发会因卡牌已离开手牌而无法入队，玩家看不到反应交互。

这不是删除测试或改变业务规则，而是恢复现有测试和既有触发契约要求的事件快照。

## 验证结果

- Disney 行为、静态注册、关键图片：3 个文件 / 36 个测试通过。
- 运行时随机审计：3 个测试通过。
- Disney 真实入口 E2E：2 个测试通过。
- ESLint：0 error。
- TypeScript：通过。
- i18n：无缺失 key。
- Smash Up 定向 manifest：通过。
- OpenSpec strict：通过。
- `git diff --check`：通过。

全量 `npm run assets:validate` 仍被主线既有的两个 Dice Throne atlas-configs manifest 条目阻塞：`ability-cards-gunslinger.atlas.json` 和 `ability-cards-tianshi.atlas.json`。这两个文件不在 PR #124 的有效改动范围，项目已有历史 evidence 记录同一漂移；本次没有借合并顺手改动或删除它们。

## 审计结论

普通 `npm run merge:audit -- HEAD` 通过。

严格 `npm run merge:audit:strict -- HEAD` 按工具设计失败，因为它把“合并结果完全等于主线父提交”列为需要人工解释的单边结果。本次这些单边结果正是三方裁决的预期结果：主线内容比 PR 更新，必须保留，不能为了通过严格模式恢复旧资源、旧 locale 或已删除的测试。因此严格审计失败属于已解释的裁决结果，不代表存在未处理的冲突。
