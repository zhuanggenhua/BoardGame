# 幻想国度 foundation 实现任务

> 说明：当前仓库里已经有 `fantasyrealms` 的探索性代码和证据，但在 `0.1` 未完成前，它们都只能算“已存在的探索产物”，不能按正式实施收口。下面已勾选的条目，仅表示 proposal 审计、草稿对齐或探索产物已经存在；不代表本 change 已获正式批准。

## 0. Approval Gate
- [x] 0.1 用户明确批准 `add-fantasyrealms-foundation` proposal 的范围与边界

## 1. Proposal 对齐与范围冻结
- [x] 1.1 审计当前 `src/games/fantasyrealms/**`、`design-system/games/fantasyrealms.md`、`evidence/fantasyrealms/**`、`manifest.ts / game.ts / domain/**` 与本 proposal/spec 是否一致
- [x] 1.2 记录当前探索实现与正式 change 的差异，收敛掉与单一实体牌桌方向冲突的表述
- [x] 1.3 把当前 change 的真实状态改回“待批准 / 待实施”，不再把 proposal 误标为已完成
- [x] 1.4 在获得批准前，不继续扩大到完整 gameplay、registry 或额外风格分支

## 2. 实体牌桌 Board foundation（批准后转正）
- [x] 2.1 将当前 `Board` 首屏收口为正式 foundation：牌桌优先，不显示大标题、`已连接` 或高权重壳层状态条
- [x] 2.2 将当前正式公共区语义与 7 张手牌完整展示约束转为正式实现与正式验收，不再沿用旧静态稿里的固定 7 张公共牌口径
- [x] 2.3 将分数摘要、当前焦点卡、终局进度固定为次级信息位，不回退为中央大计分纸
- [x] 2.4 确认桌面端与窄视口都沿用同一套优先级，不生成另一套割裂的手机风格稿

## 3. 设计文档与证据（批准后转正）
- [x] 3.1 将 `design-system/games/fantasyrealms.md` 作为正式 foundation 设计文档收口，并复核与 proposal/spec 一致
- [x] 3.2 将 `evidence/fantasyrealms/**` 作为正式 change evidence 收口，明确记录布局依据、禁止项和当前边界
- [x] 3.3 若继续出图或截图，只保留单一实体牌桌方向的有效证据，不再扩散多风格废案

## 4. 与后续 gameplay / runtime change 的职责对齐
- [x] 4.1 确认 foundation 只负责视觉与布局基础层，后续 gameplay / scoring / runtime-entry 由独立 change 接管
- [x] 4.2 清理早期 `enabled: false` / runtime skeleton 独占边界口径，避免继续拿 foundation 代表整个新游戏总状态

## 5. 验证
- [x] 5.1 运行 `openspec validate add-fantasyrealms-foundation --strict --no-interactive`
- [x] 5.2 对当前 Board/evidence 进行正式人工核对，确认真实公共区语义、7 张手牌与去标题/去大计分板约束都成立
- [x] 5.3 按真实页面主路径执行 completion audit，明确阻塞级 UI bug 是否已清零
- [x] 5.4 将仍属当前任务范围的阻塞级 UI bug 与后续非阻塞 polish 分开记录
