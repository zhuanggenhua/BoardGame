# 首页双风格候选合并到 main 的冲突记录

## 目标和现场

- 用户当轮授权：“直接在main合并，先提交后合并”。
- 工作区：`D:/gongzuo/webgame/BoardGame`，全程留在 `main`，未创建或切换分支 / worktree。
- 合并前主线：`312c473b632f69a31572369f16ba47c7cc5be47d`，已将 70 个现有源码、测试、文档及同名设计源文件提交保留。
- 最新候选：`b8f41d9eecd9c20ae3c66a31fba1ec84de7f9c14`；旧候选为 `dd64c42eee648004416278bdb3dfdc646d1aa07c`。
- 共同祖先：`1bd95e0260bd2faee79eebed4d8d8dede931f685`；主线独有 1 提交，候选独有 11 提交，无旧分支漂移、无真实文件删除。
- 命令：`git merge origin/candidate/home-modern-classic-20261023 --no-commit --no-ff`。

## 冲突逐项裁定

| 文件 | 裁定与有效内容保留 |
| --- | --- |
| `artifacts/fate-domination-open-design/DESIGN-v6.md` | 采用同一稿的后续候选增量：席位抽屉、详情大图、令咒单次确认、图片解码等待及相应测试 / 返工记录；不恢复被后续合同替代的旧行为。 |
| `artifacts/fate-domination-open-design/capture-current.mjs` | 采用同一稿的后续候选增量：席位抽屉、详情大图、令咒单次确认、图片解码等待及相应测试 / 返工记录；不恢复被后续合同替代的旧行为。 |
| `artifacts/fate-domination-open-design/index-v6.html` | 采用同一稿的后续候选增量：席位抽屉、详情大图、令咒单次确认、图片解码等待及相应测试 / 返工记录；不恢复被后续合同替代的旧行为。 |
| `artifacts/fate-domination-open-design/open-design-v6.contract.test.ts` | 采用同一稿的后续候选增量：席位抽屉、详情大图、令咒单次确认、图片解码等待及相应测试 / 返工记录；不恢复被后续合同替代的旧行为。 |
| `artifacts/fate-domination-open-design/vitest.config.ts` | 采用同一稿的后续候选增量：席位抽屉、详情大图、令咒单次确认、图片解码等待及相应测试 / 返工记录；不恢复被后续合同替代的旧行为。 |
| `artifacts/home-platform-v3-neo-brutalist/index.html` | 采用同一稿的后续候选增量：共享详情摘要、手机可展开次要信息、房间保留及返回位置；本地旧稿没有独有有效行为。 |
| `artifacts/home-platform-v3-neo-brutalist/library-fusion.contract.test.mjs` | 采用同一稿的后续候选增量：共享详情摘要、手机可展开次要信息、房间保留及返回位置；本地旧稿没有独有有效行为。 |
| `artifacts/home-platform-v3-neo-brutalist/mobile.css` | 采用同一稿的后续候选增量：共享详情摘要、手机可展开次要信息、房间保留及返回位置；本地旧稿没有独有有效行为。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/betrayal.md` | 候选只隐藏机器素材绝对路径，规则正文不变；保留原始路径的版本已在父提交中保存。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/cardia.md` | 两边正文一致，仅 CRLF / LF 差异，按候选行尾统一。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/dicethrone.md` | 两边正文一致，仅 CRLF / LF 差异，按候选行尾统一。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/fantasyrealms.md` | 候选只隐藏机器素材绝对路径，规则正文不变；保留原始路径的版本已在父提交中保存。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/qidahen.md` | 候选只隐藏机器素材绝对路径，规则正文不变；保留原始路径的版本已在父提交中保存。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/smashup.md` | 两边正文一致，仅 CRLF / LF 差异，按候选行尾统一。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/splendor.md` | 两边正文一致，仅 CRLF / LF 差异，按候选行尾统一。 |
| `artifacts/home-platform-v3-neo-brutalist/rules/summonerwars.md` | 两边正文一致，仅 CRLF / LF 差异，按候选行尾统一。 |
| `public/assets/i18n/assets-manifest.json` | 按正式退役合同和逐键内容比较采用候选；本地新增 57 键中 39 键被候选完全包含，另外 18 键与 Fate 退役合同完全相等，不恢复旧单图、错误御主图或占位图。 |
| `src/components/game/framework/widgets/__tests__/GameHUD.test.tsx` | 两边测试同时保留：七大恨教程右上角菜单 / 独立位置键，以及 Fate 阶段按钮避让 / 独立位置键。 |

独立 reviewer 已逐文件比对设计源文件，并独立验证 57 / 39 / 18 个 manifest 键的集合与定义。完全等于候选的结果有内容裁定依据，不能为了让严格审计返回 0 人造混合内容。

## 自动合并和最小补丁

- 共享 `GameHUD.tsx` 同时保留七大恨教程位置隔离及 Fate 位置 / 偏移设置。
- `src/engine/types.ts` 同时保留教程无目标居中、完成后留局和 Fate 旁观者过滤字段；对应教程生命周期消费仍在。
- 截图索引保留本地角色 / 视口 / 转换字段及候选独特界面态元数据。
- 七大恨 E2E 对手定位器限定为 `button[data-testid^="qidahen-wheel-opponent-"]`，避免先匹配外层容器。
- 交接文档状态按既有枚举设为“实施中”，同步知识索引；无新规范正文。
- 补齐中英文 `auth.menu.profile`，中文为“个人主页”，英文为“Profile”。
- `.claude/agents` 是指向 `.spec/agents` 的既有 Junction；同步被跟踪的 reviewer 镜像内容，与 canonical 保持一致。
- 执行 `npm install --no-audit --no-fund` 同步候选依赖，新增 75 个本地包，未改变锁文件。

## 已验证和边界

- 保留提交：提交前 `npm run i18n:check`、`npm run spec:lint` 通过；提交 hook 的 ESLint 与当时的 `tsc --noEmit` 通过。后者不是合并后的项目构建检查。
- 合并后相关 Vitest：14 文件、154 测试通过。范围为首页五文件、GameHUD、七大恨训练 / 轮盘 / AI / 教程、骰子王座教程，以及 Fate 卡图 / 资源 / 骑乘代表测试。
- 合并后 `npm run spec:lint`：修复状态和导航登记后通过。
- 合并后国际化检查：缺失 key 已归零，仍有 152 条候选新增可见文案警告，退出码 1；未更新 baseline、未屏蔽检查。
- 全 `src` ESLint 检查 3,649 个文件：1 error / 1,506 warnings；唯一 error 是 `useGameLibrary.test.tsx` 的小写 `wrapper` 被识别为非法 Hook 容器。已改为 `Wrapper` 并更新引用，定向 ESLint 退出码 0，相关 4 项收藏行为测试通过。没有重跑全量 ESLint，没有更新 warning baseline。
- 完整 `npm run typecheck`（`tsc --build --pretty false`）退出码 1：4,892 条诊断，按文件 / 行 / 列 / 错误码 / 消息去重后 2,713 项，涉及 331 个文件。例：`HomeVersionFooter.tsx:119` 缺 `manifestUrls`；`createRoomSetupGate.ts:53` 可空 adapter；共享规则泛型和服务端编译图亦有诊断。本次不以合并任务扩修 331 文件，不改类型检查脚本、不屏蔽错误。
- 新增测试组件命名修正后，当前定向回归累计 15 文件 / 158 测试通过；这不是全仓类型或浏览器验收通过。
- 完整日志位于本机 `%TEMP%/boardgame-home-merge-20261023/merge-typecheck.log`、`merge-eslint.json` 和 `merge-i18n.log`，未纳入 Git。
- 此前执行合并 `git commit`：9 批暂存文件 ESLint 全部通过，随后完整 `npm run typecheck` 失败，提交退出码 1。该次未使用 `--no-verify`，保留已解决冲突的暂存合并结果。用户现已明确允许仅本次合并提交跳过钩子，类型错误仍保留为未解决项。
- 提交前父节点核对：`HEAD` 是保留提交 `312c473b632f69a31572369f16ba47c7cc5be47d`，`MERGE_HEAD` 为最新候选 `b8f41d9eecd9c20ae3c66a31fba1ec84de7f9c14`。无未解决冲突、无未暂存改动；合并提交生成后运行两项 merge audit。
- 未 push、未部署、未做双端浏览器 / 视觉验收。

## 风险

最可能的串线风险是共享 HUD 漏掉一方、清单复活已退役素材及旧设计覆盖后续行为；上述冲突裁定和 154 项代表测试覆盖这些合并风险的部分边界。完整玩法、资源远端可达、建房加入重连与视觉仍需要另行验收，不能用本记录或单测替代。

## 追加整合两项新提交

- 用户追加授权：“有新提交，一起合并了吧”。远端仅配置 fetch main，故额外显式 fetch 候选引用；远端候选新增 `6b964a80a0be26c95ebc3fc28af66416b3cf5007` 与 `b8f41d9eecd9c20ae3c66a31fba1ec84de7f9c14`，共 10 路径。
- 在 `%TEMP%/boardgame-home-merge-20261023/before-new-candidate` 保存 2,909,145 字节完整暂存 binary patch、已解决索引树 `2e5ba1def3b0ba13ffeac792ab4b5e8fdf08106d` 及 25 个文件的逐字节校验备份后，执行 `git merge --abort` 结束旧待提交合并；保留提交 HEAD 未变化。随后重新 merge 最新候选，无分支 / worktree 创建或切换。
- 新候选中原 18 个冲突文件的候选 blob 均未变化，复用已审查解决结果和机械补丁；交接文档保留新增 Betrayal 整节，仅同步原状态枚举。
- 最新增量由独立 reviewer 只读审查，发现并完成最小修补：① 脑状食品 E2E 恢复缺失的正式投骰点击及局部采集 Promise；② 删除吊死鬼 E2E 的重复变量 / 重复断言，保留原奖励断言；③ 真人移动动画锚点使用实际 playerId，修正硬编码 0 号座位；④ 自然事件卡牌 / 属性候选定位器限定 button；⑤ 自然事件循环保留最终返回动作，自动退场亦须验证 pending 清空、牌桌可见及下回合推进。
- 新增相关 4 个 E2E 文件 esbuild 语法检查通过；对应源码 / E2E 定向 ESLint `--quiet` 退出码 0；当前 `npm run spec:lint` 通过。
- `eventChoiceSurface.test.tsx`（3 项）和 `Board.foundation.test.tsx`（210 项）共 213 项通过；执行期间有外部请求 ECONNRESET 输出，测试最终退出码 0。没有运行真实浏览器或视觉验收。
- 上述 158 项回归、全量 ESLint 与 4,892 条类型诊断均来自上一轮旧候选整合结果；追加新提交后尚未重跑全仓类型检查或提交钩子。旧类型阻塞未被新提交覆盖，不以语法 / 定向检查代替全仓通过，不把既有失败伪称通过；用户现已明确授权仅本次合并提交跳过钩子。

## 本次提交授权

- 用户在明确收到“仅这次合并提交使用 `--no-verify`”的提问后回答“允许”。授权只用于本次本地合并提交，不改钩子配置，不更新质量 baseline，不扩展为 push / 部署授权。
- 提交标题：`合并首页双风格、Fate 与山屋候选并保留主线教程改动`。
- 提交后以 Git 双亲、候选祖先关系、无 MERGE_HEAD / 无未解决冲突作为本地 Git 动作证据；两项 merge audit 的实际输出保存在 `%TEMP%/boardgame-home-merge-20261023/` 并如实汇报。
- 审计若指出结果等于候选一侧，按上表逐项核对：设计后续增量、内容一致行尾统一、退役资源合同或已包含本地字段均有裁定依据；不为消除审计提示编造混合内容。
