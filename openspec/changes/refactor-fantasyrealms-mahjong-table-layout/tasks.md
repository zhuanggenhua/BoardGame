# 幻想国度 `fr-merge-pass2` 路线收口任务

## Addendum（2026-06-13）：用户后续已否掉底部横幅版本，当前必须把正式方向继续收口到 `fr-merge-pass2-*`

- [x] A.1 锁定当前正式桌面对象：`fr-merge-pass2-opening / after-draw / after-select`
- [x] A.2 将 OpenSpec / 设计规范 / 专项 README 的现行方向，统一改为去掉底部常驻提示横条后的 `fr-merge-pass2` 路线
- [x] A.3 将旧麻将桌候选、旧 rework 候选、旧 `fr-ui-current-*` 路线从“当前正式方向”降级为“历史候选/过程材料”
- [x] A.4 给出一份当前正式方向的截图型真相说明，后续不再靠文字猜路线
- [x] A.5 清点 `fr-merge-pass2` 路线剩余代码/测试/命名遗留，并逐项归零

## Addendum（2026-06-14）：main 与专项 worktree 只能先做裁定，不得把“收口”偷换成直接 merge

- [x] B.1 产出 `main` vs `fantasyrealms worktree` 的非程序用户决策包，明确正式 UI 先认哪边
- [x] B.2 把“双边差异分成正式 UI 冲突 / 过程材料 / 后续独立吸收项”落成证据，不再把所有差异混成一个二选一问题
- [x] B.3 将上述决策包接入当前设计真相源索引，后续不再重复口头解释“到底认哪边”

## Addendum（2026-06-14）：终局 UI 与端到端证据链继续收口到当前 worktree 真相

- [x] C.1 将终局态从旧底部复盘块收成右上最终排名榜单，并支持点击榜单切换查看其他玩家终局手牌
- [x] C.2 将 Board foundation 与 online basic E2E 的终局合同切到当前右上榜单 DOM，不再依赖旧“终局复盘”文案和旧列表容器
- [x] C.3 将 FantasyRealms 正式真相图从 `test-results/manual/` 改回可追溯的 `test-results/evidence-screenshots/fantasyrealms/...` E2E 证据链
- [x] C.4 更新 E2E 验收规范，明确正式截图必须能反查到 `游戏 -> 测试文件 -> 用例名`，且不得继续混进 `_shared`

## 0. Approval Gate
- [x] 0.1 用户明确批准 `refactor-fantasyrealms-mahjong-table-layout` 的设计方案并允许开始实现

## 1. 设计冻结
- [x] 1.1 审计当前 `fantasyrealms` 真实页面，确认现状属于三栏后台式布局而非牌桌式布局
- [x] 1.2 整理成熟麻将游戏的布局参考，并提炼可迁移的信息层级
- [x] 1.3 更新 `design-system/games/fantasyrealms.md`，先把桌面端方案从三栏切出
- [x] 1.4 产出 SVG 低保真草图，固定主区、手牌带、弃牌河和边缘信息位

## 2. PC 端真实页重构（批准后实施）
- [x] 2.1 将 `Board.tsx` 从三栏等权布局改为单牌桌 live 壳
- [x] 2.2 将主要操作对象收回到桌面中央承接区
- [x] 2.3 将顶部/侧边信息压缩成轻量状态轴、牌库物件和右侧动作/分数区
- [x] 2.4 将焦点推演、分数、终局说明压缩到贴边信息层，不再抢主区
- [x] 2.5 将桌面进行页拆成独立 live 分支，移除 `panel` 级容器和区块标题
- [x] 2.6 将桌面进行页的规则说明、观察者说明、焦点推演、结束进度彻底退出常驻 UI
- [x] 2.7 将桌面进行页的分数区改成右侧轻量信息条，而不是卡片列

## 3. 桌面端验收（批准后实施）
- [x] 3.1 对桌面端 opening / live discard / gameover 三个真实状态补齐截图 evidence
- [x] 3.2 跑桌面端相关定向测试与真实页检查，确认无阻塞级 UI bug
- [x] 3.3 只有当桌面端真实页达标后，才将本 change 进入移动端阶段
- [x] 3.4 补一张“临近结束但仍在进行中”的桌面代表态截图，并核对无描述性文字常驻

## 4. 移动端适配（桌面端通过后）
- [ ] 4.1 以桌面端已验收构图为基线，设计移动端压缩与重排策略
- [ ] 4.2 实施移动端适配并补齐真实页 evidence
- [ ] 4.3 明确记录任何用户批准的顺序豁免或并行实现例外

## 5. 验证
- [x] 5.1 运行 `openspec validate refactor-fantasyrealms-mahjong-table-layout --strict --no-interactive`
- [x] 5.2 验证 skill 门禁与设计文档口径一致
