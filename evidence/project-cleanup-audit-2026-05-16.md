# 项目安全整理完成审计（2026-05-16）

## 目标拆解

用户目标：全面检查并深入清理项目垃圾；如果测试框架或规范会继续制造垃圾，需要重构门禁，而不是只删当前文件。

本轮可交付成功标准：

| 编号 | 成功标准 | 当前结论 | 证据 |
| --- | --- | --- | --- |
| C1 | `e2e/src` Junction 镜像不再被 Git 跟踪 | 通过 | `git ls-files e2e/src` 输出数量 `0`；`git diff --cached --name-only --diff-filter=D -- e2e/src` 输出数量 `1806`；`e2e/src` 仍是 Junction，目标为 `D:\gongzuo\webgame\BoardGame\src`。 |
| C2 | 本地真实 `src/` 没有被镜像治理删除 | 通过 | `e2e/src` LinkType 为 `Junction`，Target 为真实 `src`；本轮只做索引取消跟踪。 |
| C3 | 子目录 E2E 不再通过 `../src` 误指向镜像 | 通过 | `rg "['\"]\.\./src/|import\(['\"]\.\./src/" e2e\cardia e2e\dicethrone e2e\smashup e2e\summonerwars -g "*.ts" -g "*.tsx" -n` 无匹配。 |
| C4 | `src/games` 中已确认的无入口残留目录被删除 | 通过 | `Test-Path src\games\airepoworkbench` 为 `False`；`Test-Path src\games\ugcbuilder` 为 `False`；`rg "airepoworkbench|ugcbuilder" src\games src\config public\locales -n` 无匹配。 |
| C5 | 没有把未完成但有实现的游戏误删 | 通过 | `src/games/qidahen/manifest.ts` 为 `enabled: false`，但存在 `game.ts`、`Board.tsx`、domain、素材和 i18n；结论为“未开放实现”，不是空残留。 |
| C6 | 根级 E2E 重复入口已安全清理，且根级不再保留游戏 E2E 入口 | 通过 | 第一批删除根级 E2E `48` 个；第二批删除根/子目录同名且测试标题一致或被子目录覆盖的根级副本 `108` 个；最终复核又删除 4 个仍留在根级的游戏/临时副本；无子目录替代的 `12` 个根级游戏 E2E 已迁入对应 `e2e/<gameId>/`；剩余根级 E2E 总数 `20`，根级游戏 E2E 为 `0`。 |
| C7 | Playwright 配置不再用旧 ignore 误伤子目录规范文件 | 通过 | `rg "ROOT_SMASHUP_DEPRECATED_SPECS|LEGACY_DISCOVERY_BROKEN_TESTS|testIgnore" playwright.config.ts scripts docs -n` 在 `playwright.config.ts` 无匹配；全游戏子目录 `--list` 输出 `Total: 1006 tests in 245 files`。 |
| C8 | 测试框架/规范不再允许继续制造同类垃圾 | 通过 | `scripts/infra/testing-structure-guard.mjs` 阻止 `e2e/src/**` 入库、阻止新增根级游戏 E2E、阻止无历史根级源文件的新 `legacy-root` 用例，并阻止 `temp/**`、`.tmp/**`、`test-results/**`、`temp-*`、`scripts/temp_*.py`、`*.backup` 等临时/备份/测试输出被强制入库；`.gitignore` 和 `docs/temp-files-management.md` 已补充 `temp-*.mjs`、`scripts/temp_*.py`、`test-out.txt` 规则；`docs/testing-best-practices.md` 和 `docs/automated-testing.md` 已同步规则。 |
| C9 | 基础门禁验证当前清理不会破坏架构、类型和 i18n | 通过 | `npm run check:arch`、`npm run typecheck`、`npm run i18n:check`、`npm run test:structure`、`git diff --check`、`git diff --cached --check` 均通过。 |
| C10 | 仓库级 tracked 临时/备份文件已处理 | 通过 | 删除 `src/engine/hooks/useEventStreamCursor.ts.backup`（乱码旧备份）、4 个 tracked `temp/` 文件、根部 `test-out.txt`、空的 `temp-write-design.mjs`、一次性 OCR 脚本 `scripts/temp_read_rules_fast.py`；外部引用扫描无匹配。 |

## 残余范围

### 本地忽略数据清理

继续复核未跟踪/已忽略本地数据后，本轮只清理了可再生成或明确旧临时输出：

- 删除根目录旧临时文件：`temp_spawn_test.txt`、`test-debug.log`、`test-ninja-output.txt`、`test-out.txt`、`test-output.txt`。
- 删除 `.tmp` 中 2026-05-15 之前的旧 Playwright/runtime 日志和 4 个旧 `_server_*.mjs/.map` 临时 bundle：共 `3309` 个文件，约 `1246.04 MB`。
- 删除 `.tmp` 中明确的一次性测试/诊断输出：`9` 个文件，约 `5.84 MB`。
- 删除 `temp/dev-bundles` 旧开发/E2E bundle：`8682` 个文件，约 `35931.27 MB`；该目录由开发/E2E 脚本按需重建，删除后已有当前流程重建出小体积新目录。
- 删除 `temp/mobile-evidence-browser-profile-*` 旧浏览器 profile 缓存：`2` 个目录，`4078` 个文件，约 `385.63 MB`。
- 删除 `temp/` 根部旧质量门禁/Vitest/日志输出：`35` 个文件，约 `32.70 MB`。
- 继续删除重建出的 `temp/dev-bundles`、旧 `temp/prod-bundles` 与空 `test-results/manual-selection-inspect`：`8` 个文件，约 `34.28 MB`。
- 删除 `.tmp` 中 2026-05-01 之前的一次性脚本/文本快照：`40` 个文件，约 `0.22 MB`；保留当前 runtime `.json/.log` 和参考截图。
- 删除 `.tmp` 中无引用的 3 月 CDP 探针、旧浏览器 profile、手工 E2E 截图和临时查看图：`252` 个文件，约 `24.21 MB`；进程占用扫描只命中本次查询命令自身。
- 删除 `temp/dicethrone` 中无引用的旧远端包、临时 atlas 裁图批次、review/debug 目录和一次性诊断脚本：`374` 个文件，约 `106.23 MB`；保留被 evidence 和规则文档点名的 `temp/dicethrone/atlas-crops-20260411`。
- 再次删除自动重建出的 `temp/dev-bundles`：`8` 个文件，约 `37.30 MB`；该目录为开发/E2E bundle 输出目标，后续运行可再次生成。
- 删除 `temp/` 根部无引用的 `characterhead2-grid-*`、`local-ai-*`、`portrait-samurai-v2.png`、`homev2-shot`、`openclaw-evidence`、`moonelf-check`：`27` 个文件，约 `15.89 MB`。
- 删除 `temp/` 根部无引用的一次性构建输出、OCR 中间图、旧 diff、旧 DiceThrone AI 延迟诊断 JSON：`44` 个文件，约 `6.26 MB`。
- 删除 `temp/` 根部 2026-05-01 前无引用的任务状态、诊断脚本和运行日志：`49` 个文件，约 `0.38 MB`；保留 5 月后的近期反馈/审计状态文件。
- 二次收缩 `temp/dicethrone`：删除未被外部引用的旧截图、UI 验证图和小诊断状态文件：`22` 个文件，约 `17.02 MB`；当前只保留被引用的 `atlas-crops-20260411` 和 `feedback-triage-dicethrone.md`。
- 删除 `test-results` 中无完整路径引用的旧 Tictactoe 调试截图目录和 3 张 Cardia hover 顶层截图：`7` 个文件，约 `7.15 MB`；保留有路径引用的 Android/DiceThrone/SmashUp/教程测试产物。
- 删除 `temp`、`.tmp`、`test-results` 下空目录 `24` 个；跳过 `temp/pr79-merge-clone/.git/**` 内部 Git 结构。

清理后本地大目录当前约为：

- `temp/`：约 `4006.98 MB`
- `.tmp`：约 `3.34 MB`
- `test-results/`：约 `1333.32 MB`
- `.worktrees/`：约 `10563.26 MB`
- `node_modules/`：约 `903.33 MB`

继续复核时，`git ls-files` 中命中临时/备份/测试输出模式的对象均已处于删除待提交状态，没有发现仍存活的 tracked 临时文件：

- `e2e/temp-dicethrone-ability-atlas-regression.e2e.ts`
- `scripts/temp_read_rules_fast.py`
- `src/engine/hooks/useEventStreamCursor.ts.backup`
- `temp-write-design.mjs`
- `temp/decode-feedback-export.mjs`
- `temp/export-feedbacks-to-bulan.mjs`
- `temp/feedback-export-plan.md`
- `temp/repair-feedback-garbles.mjs`
- `test-out.txt`

未继续删除的对象及原因：

- `temp/audio-intake-2026-04-25`：约 `3273.27 MB`，属于素材录入材料，不按纯缓存处理。
- `temp/pr79-merge-clone`：约 `373.79 MB`，内部有 `.git`，按临时克隆/历史排查现场处理，未获明确许可前不删。
- `temp/dicethrone/atlas-crops-20260411`：被 `evidence/dicethrone/dicethrone-high-noon-branches-e2e-test.md`、`evidence/dicethrone/dicethrone-wild-west-e2e-test.md`、`src/games/dicethrone/rule/武士真相源表.md`、`src/games/dicethrone/rule/武士录入核对.md` 引用为可复查裁图来源，未清。
- `temp/dicethrone/feedback-triage-dicethrone.md`：被 `evidence/recent-5day-feedback-doc-audit-2026-04-05.md` 引用为 Dice Throne 反馈分诊间接证据，未清。
- `temp/feedback-closeout`、`temp/feedback-online`：反馈导出/关闭链路材料，仍有近期时间戳或外部引用，未清。
- `temp/qidahen-intake`、`temp/qidahen-ui-mock`：七大恨当前录入/UI 草图材料，未清。
- `temp/smashup-mermaids-card-crops-2026-04-26`、`temp/wangling*`、`temp/cards7*`、`temp/skeletons-card-*`：属于素材录入/核对图组，部分有证据引用；未做批量删除。
- `temp/dev-bundles`：本轮删除后又被当前流程重建，确认是自动生成目录；继续复核时发现仍有 Node 进程以 `temp\dev-bundles\e2e-single\...` 为 outfile/运行目标，当前约 `74.60 MB`，按“可再生成但正被占用”跳过，不作为仓库垃圾风险处理。
- `.tmp`：当前约 `3.34 MB`，主要是 Playwright 端口/运行日志和 `e2e-preflight-cache.json`；存在历史 evidence 对 `.tmp` 日志路径的引用，且收益很低，未继续逐个删除。
- `.worktrees/`：当前 `git worktree list` 显示多个注册 worktree，且 `qidahen`、`homepage-v2` 有本机程序打开，不能作为垃圾目录直接删除。
- `test-results/evidence-screenshots`：有截图查看进程打开，且按项目规范可作为 E2E 证据，未清。
- `test-results/android-compat-smoke`、`test-results/dicethrone`、`test-results/smashup` 和教程相关顶层截图：存在完整路径引用或审计引用，未清。

### 根级 E2E 历史债务

当前根级目录不再保留游戏 E2E 入口：

- 根级 E2E 总数：`20`
- 根级游戏 E2E：`0`
- 全游戏子目录发现检查：`1006 tests in 245 files`

本轮对根级游戏 E2E 的处理：

1. 删除已证明由子目录规范文件覆盖的根级副本：`108` 个。
2. 迁移没有子目录替代的根级游戏 E2E：`12` 个。
3. 迁移仍含根级独有用例的根级游戏 E2E：`29` 个，落点为 `e2e/<gameId>/legacy-root/`，保留覆盖但移出根目录。
4. 修复迁移后发现的 Playwright 发现阶段错误：`e2e/smashup/smashup-state-injection-test.e2e.ts` 的 `test.beforeEach` 参数改为 `{}` 解构，避免 `First argument must use the object destructuring pattern`。
5. 最终复核删除仍残留在根级的 4 个游戏/临时副本：`e2e/character-selection.e2e.ts`、`e2e/framework-pilot-simple.e2e.ts`、`e2e/ninja-hidden-ninja-ui-debug.e2e.ts`、`e2e/temp-dicethrone-ability-atlas-regression.e2e.ts`；对应内容已在 `e2e/dicethrone/` 或 `e2e/smashup/` 下保留。

### 迁移前判定记录

迁移前，根级 E2E 的旧状态如下。该状态已不再是当前残余，只作为清理依据保留：

- 根级 E2E 总数：`173`
- 根级游戏 E2E：`149`
- 有子目录同名文件：`137`
- 根/子目录 hash 完全相同：`0`
- 无子目录替代：`12`

当时无子目录替代、已迁入对应游戏目录的根级游戏 E2E：

| 文件 | 游戏 | 处理结论 |
| --- | --- | --- |
| `e2e/cardia-action-log.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-action-log.e2e.ts`。 |
| `e2e/cardia-ai-basic.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-ai-basic.e2e.ts`。 |
| `e2e/cardia-ai-gameover-overlay.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-ai-gameover-overlay.e2e.ts`。 |
| `e2e/cardia-ai-opponent.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-ai-opponent.e2e.ts`。 |
| `e2e/cardia-ai-transport-bug-exploration.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-ai-transport-bug-exploration.e2e.ts`。 |
| `e2e/cardia-ai-transport-preservation.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-ai-transport-preservation.e2e.ts`。 |
| `e2e/cardia-audio-system.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-audio-system.e2e.ts`。 |
| `e2e/cardia-card12-debug.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-card12-debug.e2e.ts`。 |
| `e2e/cardia-card12-user-scenario.e2e.ts` | cardia | 迁入 `e2e/cardia/cardia-card12-user-scenario.e2e.ts`。 |
| `e2e/smashup-shayu-factions.e2e.ts` | smashup | 迁入 `e2e/smashup/smashup-shayu-factions.e2e.ts`。 |
| `e2e/splendor.e2e.ts` | splendor | 迁入 `e2e/splendor/splendor.e2e.ts`。 |
| `e2e/tictactoe-rematch-ai.e2e.ts` | tictactoe | 迁入 `e2e/tictactoe/tictactoe-rematch-ai.e2e.ts`。 |

对有子目录同名文件但 hash 不同的 `137` 个根级游戏 E2E，先按测试标题覆盖关系分层：标题一致或被子目录覆盖的删掉，存在根级独有用例的迁入 `legacy-root/`，避免丢覆盖。

## 门禁说明

本轮不是只删文件，而是把三个会反复制造垃圾的入口堵住：

1. `e2e/src/**`：任何文件路径都纳入 `testing-structure-guard`，不再只检查测试文件。
2. 根级游戏 E2E：新增文件会失败；已有历史文件只警告，避免一次性误删仍有业务价值的旧用例。
3. `legacy-root/`：只允许承接历史根级 E2E 迁移；直接新增到该目录会失败。
4. 临时/备份/测试输出：`.gitignore` 已覆盖 `temp-*.mjs`、`scripts/temp_*.py`、`test-out.txt`，`testing-structure-guard` 也会阻止 `temp/**`、`.tmp/**`、`test-results/**`、`temp-*`、`scripts/temp_*.py`、`*.backup` 等被强制纳入仓库；`git check-ignore -v --no-index` 和负向门禁样例均已验证。

## 已执行命令

```text
node --check scripts/infra/testing-structure-guard.mjs
node --check scripts/infra/run-changed-quality-gate.mjs
node --check playwright.config.ts
npm run test:structure
node scripts/infra/testing-structure-guard.mjs --all
npm run check:arch
npm run typecheck
npm run i18n:check
git diff --check
git diff --cached --check
npx playwright test e2e/smashup/smashup-wizard-portal.e2e.ts e2e/smashup/ninja-hidden-ninja-skip-option.e2e.ts e2e/dicethrone/dicethrone-toggle-die-lock-in-response-window.e2e.ts e2e/summonerwars/summonerwars-illusion-fix.e2e.ts --list
npx playwright test e2e/cardia/cardia-action-log.e2e.ts e2e/cardia/cardia-ai-basic.e2e.ts e2e/cardia/cardia-ai-gameover-overlay.e2e.ts e2e/cardia/cardia-ai-opponent.e2e.ts e2e/cardia/cardia-ai-transport-bug-exploration.e2e.ts e2e/cardia/cardia-ai-transport-preservation.e2e.ts e2e/cardia/cardia-audio-system.e2e.ts e2e/cardia/cardia-card12-debug.e2e.ts e2e/cardia/cardia-card12-user-scenario.e2e.ts e2e/smashup/smashup-shayu-factions.e2e.ts e2e/splendor/splendor.e2e.ts e2e/tictactoe/tictactoe-rematch-ai.e2e.ts --list
npx playwright test e2e/cardia e2e/dicethrone e2e/smashup e2e/summonerwars e2e/tictactoe e2e/splendor --list
Get-ChildItem e2e -File -Filter *.e2e.ts
node scripts/infra/testing-structure-guard.mjs e2e/smashup/legacy-root/new-junk.e2e.ts
node scripts/infra/testing-structure-guard.mjs e2e/smashup-new-junk.e2e.ts
npx eslint scripts/infra/run-changed-quality-gate.mjs scripts/infra/testing-structure-guard.mjs
rg "decode-feedback-export|export-feedbacks-to-bulan|feedback-export-plan|repair-feedback-garbles|useEventStreamCursor\.ts\.backup" --glob "!temp/**" --glob "!src/engine/hooks/useEventStreamCursor.ts.backup" -n
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like '*temp\dev-bundles*' }
Remove-Item -LiteralPath temp\dev-bundles -Recurse -Force
git check-ignore -v --no-index temp-write-design.mjs scripts/temp_read_rules_fast.py test-out.txt
node scripts/infra/testing-structure-guard.mjs temp/feedback-triage-summary.md
git ls-files | rg -n "(^temp/|^test-results/|^\.tmp/|^temp-|^test-out\.txt$|^scripts/temp_|\.backup$|\.bak$|\.orig$|\.rej$|^e2e/temp-)"
git ls-files -d | rg -n "(^temp/|^test-results/|^\.tmp/|^temp-|^test-out\.txt$|^scripts/temp_|\.backup$|\.bak$|\.orig$|\.rej$|^e2e/temp-)"
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like '*temp*dev-bundles*' }
git check-ignore -v --no-index temp/dev-bundles .tmp/e2e-preflight-cache.json test-results/playwright-artifacts
```

说明：`quality:changed` 在当前工作树输出“未检测到已提交改动，跳过”，不能作为未提交工作区的完成证据；因此本审计只采用上面的直接门禁和命令结果。
