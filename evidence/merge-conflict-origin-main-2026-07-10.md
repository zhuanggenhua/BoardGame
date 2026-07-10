# origin/main 合并审计记录（2026-07-10）

## 背景

- 目标分支：`main`
- 合并来源：`origin/main`
- 触发命令：`git merge --no-edit origin/main`
- merge commit：`60a3d8c5bece7102ba66c0eb6f4e7b3498831e00`
- 父1（本地）：`5808c2b374c64f083f7e9aa2c3470666202bb567`
- 父2（远端）：`4d203a60f92f7c6b4b2445ba93809a79114a463b`
- 共同父提交：`e63cc2eb1bc59dc729bdca35fc244879cae9a7eb`
- 说明：远端在本地门禁运行期间推送了同一笔“纸牌帮 0.6.3 发布”提交。两侧发布内容相同，本地父1仅额外包含 `MatchRoom.routeIdentity` 的教程测试夹具修复。Git 自动完成合并，没有 `UU` 文本冲突。

## 双侧重叠文件

merge audit 命中的 13 个文件在两个父提交中内容完全一致，merge 结果也与两侧相同：

1. `docs/games/the-gang/final-closeout.md`
2. `docs/games/the-gang/runtime-entry-validation.md`
3. `docs/games/the-gang/user-stories/online-viewer-and-landscape-contract-2026-07-10.md`
4. `docs/user-stories/README.md`
5. `e2e/the-gang/the-gang-runtime.e2e.ts`
6. `openspec/changes/add-server-primary-r2-fallback-assets/tasks.md`
7. `openspec/changes/add-the-gang-data-and-runtime-closeout/specs/the-gang/spec.md`
8. `openspec/changes/add-the-gang-data-and-runtime-closeout/tasks.md`
9. `openspec/changes/add-the-gang-foundation/design.md`
10. `openspec/project.md`
11. `openspec/specs/the-gang/spec.md`
12. `package-lock.json`
13. `package.json`

## 解决策略

- 上述 13 个文件不需要人工选择父1或父2，也没有拼接冲突块；两侧字节级内容一致，merge 结果保持该共同内容。
- 本地父1独有的 `src/pages/__tests__/MatchRoom.routeIdentity.test.tsx` 不属于双侧重叠文件。该文件补齐 `useTutorial()` 的必填教程状态对象，用于修复 pre-push 中 5 条路由身份测试因读取空对象 `manifestId` 而崩溃的问题。
- 远端父2没有该测试修复，因此 merge 结果保留本地父1版本；没有覆盖或放弃远端的有效实现。

## 文件级风险说明

- `e2e/the-gang/the-gang-runtime.e2e.ts` 和两份纸牌帮正式规格属于高风险行为合同，但两侧内容完全一致，没有单边基线裁决，也没有交互步骤丢失。
- `package.json` 与 `package-lock.json` 两侧均为相同的 `0.6.3` 发布版本，merge 没有混用版本号或依赖锁内容。
- 若判断失误，最可能的用户可感知风险是纸牌帮在线观战或横屏合同被旧版本覆盖；三方结果显示 13 个重叠文件与两侧相同，因此该风险未发生。
- `MatchRoom.routeIdentity` 的变化仅修正测试夹具，不改变生产比赛房间、教程或身份恢复逻辑。

## 回归与行为变化登记

- 原始目标问题：
  - 完成多游戏、3D 骰子、移动端和资源回退提交的正常门禁与推送。
- 本次额外发现的真实回归：
  - 大杀四方 Android 包资源数量合同未包含龙族、鲨鱼、全明星和龙卷风正式图集，已更新数量与明确路径断言。
  - 两个比赛房间身份测试的 `useTutorial()` 替身缺少必填教程状态，已补齐真实上下文契约。
- 仅流程变化：
  - 远端在本地门禁执行期间并行推送了纸牌帮发布提交，因此通过普通 merge 保留双方历史；没有强推、回滚或绕过门禁。
- 本次 merge 本身没有新增业务行为，也没有发现额外业务回归。

## 验证

- `npx vitest run src/lib/__tests__/uploadToR2AndroidPackagePublishPlan.test.ts`
  - 结果：1 个文件、8 条测试通过。
- `npx vitest run src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx`
  - 结果：1 个文件、11 条测试通过。
- `npx vitest run src/pages/__tests__/MatchRoom.routeIdentity.test.tsx`
  - 结果：1 个文件、8 条测试通过。
- `node scripts/verify/merge-conflict-audit.mjs 60a3d8c5bece7102ba66c0eb6f4e7b3498831e00 --fail-on-single-side`
  - 结果：通过；13 个双侧重叠文件均为“与两侧相同”，没有单边结果或混合裁决。
- 冲突标记扫描：
  - 命令：`git grep -n -E '^(<<<<<<< .+|=======|>>>>>>> .+)$' -- .`
  - 结果：无命中。
- `npm run quality:changed:pre-push`
  - 结果：补记提交后由正常 `git push` 再次执行，以最终门禁结果为准。

## 结果

- merge commit：`60a3d8c5bece7102ba66c0eb6f4e7b3498831e00`
- 冲突汇报补记：待本轮提交
- 推送目标：`origin/main`
