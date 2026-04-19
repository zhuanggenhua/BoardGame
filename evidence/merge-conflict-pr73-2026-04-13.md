# 冲突解决汇报：PR73 -> main

## 1. 背景
- base: `main`
- head: `pr-73-head` (`feat/game-cardia`)
- 触发命令: `git merge --no-commit --no-ff pr-73-head`
- 当前状态：处于未完成 merge 状态

## 2. 预检查摘要
- `ahead=773`
- `behind=993`
- 删除文件数：`90`（超过文档预警阈值 50，需要人工审查）
- 删除测试文件数：`0`
- 删除脚本数：`5`
- 删除文档数：`16`
- 当前冲突总数（记录时）：`620`

## 3. 冲突分组（进行中）
- `src/games/*`：292
- `src/components/*`：66
- `src/engine/*`：30
- `src/pages/*`：15
- `openspec/changes/*`：15
- `scripts/infra/*`：12
- `public/locales/*`：12
- `apps/api/*`：9
- 其余：若干

## 4. 已处理文件

### docs/git-merge-checklist.md
- 策略：双方合并，保留更严格的块级裁决 / 审计 / 汇报要求
- 原因：该文档直接约束本次冲突处理，不能保留带冲突标记的旧状态

### docs/mobile-adaptation.md
- 策略：双方合并，保留双端并行、board-shell、App 壳方向链路、二次缩放禁令等更严格规则
- 原因：后续若碰到移动端相关冲突，需要以最新版约束为准

## 5. 主攻范围（进行中）
- 第一优先级：`src/games/cardia/*` 与 `public/locales/*cardia*`
- 第二优先级：Cardia 直接依赖的 E2E / helper / evidence
- 第三优先级：与 PR73 无关但阻塞 merge commit 的共享基础设施文件

## 6. 风险评估
- 风险 1：当前 main 与 PR73 均已各自演进很久，存在多重 merge-base，不能按“单边覆盖”处理
- 风险 2：大量 `AA` / `UU` 文件分布在 `src/games/smashup`、`src/games/summonerwars` 等区域，说明本地 main 的工作树提交与 PR73 叠加后冲突面远超 Cardia 本身
- 风险 3：若直接整批吃单边，极易静默丢失测试、文档、i18n 与共享层修复

## 7. 回归与行为变化登记
- 原 PR 目标问题：Cardia 游戏完整实现、音频系统、AI 对手、ActionLog、Deck1 审计
- 本次额外发现的真实回归：待冲突解析过程中补充
- 仅业务口径 / 规则变化：待冲突解析过程中补充

## 8. 验证清单
- [x] 提交当前 main 工作树为 checkpoint commit
- [x] 跑完提交钩子的增量质量门（typecheck / eslint / build / 部分 tests）
- [ ] 合并冲突全部解决
- [ ] 生成 merge commit
- [ ] 运行 `npm run merge:audit -- HEAD`
- [ ] 运行 `npm run merge:audit:strict -- HEAD`
- [ ] 运行回归验证

## 9. 最终结果
- 提交：待完成
- 推送：待完成
