# Change: 幻想国度收敛为 `fr-merge-pass2` 中央承接牌桌路线

## Why
- 当前 `fantasyrealms` Board 本质仍是网页三栏后台布局：左栏堆状态，中间放公共区，右栏放焦点与进度。这种构图会把牌桌切碎，主区看起来像内容容器，不像正在进行中的牌局。
- 当前 worktree 里又并行长出多套桌面候选：旧“三栏后台”、中段 `rework-v*`、以及早先曾被采用过的 `fr-ui-current-*` 路线。如果不收口成一套正式真相，后续会继续出现“像两个游戏”的分裂。
- 用户后续已经进一步明确：**底部横幅/底部提示条绝对不是要采用的一版**。因此当前正式方向不能停在旧 `fr-ui-current-*`，而必须继续收口到去掉底部常驻提示横条后的 `fr-merge-pass2-*` 当前 worktree 真实运行态。
- 因此本 change 现在不再只是“放弃三栏并参考麻将桌层级”，而是要把 **`fr-merge-pass2` 中央承接牌桌路线** 正式翻正，并把旧麻将桌候选 / rework 候选降级为历史材料。
- 用户已经进一步明确：`PC` 进行页要像 `SmashUp` 一样几乎不带描述性文字；说明、推演、提示、解释类 UI 不得在桌面 live 页面常驻。
- 这次不是 spacing bug 或局部美化，而是主布局模型切换，必须用新的 OpenSpec change 独立管理，并明确“PC 真实页先过，再进入移动端适配”的实施顺序。

## What Changes
- 为 `fantasyrealms-foundation` 新增“`fr-merge-pass2` 中央承接牌桌路线”要求，正式放弃当前三栏后台式构图与未翻正的其它桌面候选。
- 将桌面端正式路线固定为：
  - 开局或无待处理对象时，保留大面积干净牌桌，不摆巨型空盒或永久底部厚带
  - 当前回合真正要处理的牌，集中承接在桌面中央
  - 顶部只保留极简状态轴
  - 左侧保留牌库物件
  - 右侧只保留必要的确认动作和分数摘要
  - 桌面端默认不再保留底部常驻提示横条
- 将桌面端进行页额外收紧为：
  - 禁止常驻 `当前焦点`
  - 禁止常驻 `结束进度`
  - 禁止出现大段规则说明、推演说明、观察者说明
  - 禁止把牌库/回合/分数/公开区/手牌分别包成同级厚面板
- 将当前 worktree 里的真相源收敛为：
  - `fr-merge-pass2-opening-2026-06-13.png`
  - `fr-merge-pass2-after-draw-2026-06-13.png`
  - `fr-merge-pass2-after-select-2026-06-13.png`
  这三张图所代表的 live 路线
- 将旧 `麻将桌式底部连续手牌带 / 中央公共河` 方案降级为历史候选，不再继续当作当前正式实现方向
- 将实施顺序固定为：
  - 先做桌面端真实页重构与验收
  - 只有桌面端真实页达标后，才允许进入移动端适配
  - 除非用户明确要求并行或先做移动端

## Impact
- Affected specs: `fantasyrealms-foundation`
- Affected code:
  - `src/games/fantasyrealms/Board.tsx`
  - `design-system/games/fantasyrealms.md`
  - `docs/games/fantasyrealms/design/README.md`
  - `evidence/fantasyrealms/**`
  - `openspec/changes/refactor-fantasyrealms-mahjong-table-layout/**`

## Approval Boundary
- 用户已明确批准按“去掉底部常驻提示横条后的 `fr-merge-pass2` live 方向”继续重构。
- 本 change 接下来的收口重点是：
  - 把 `fr-merge-pass2` live 路线翻成唯一正式方向
  - 清掉旧麻将桌候选 / rework 候选仍残留在规范、任务、证据口径里的“现行态”表述
  - 在桌面端 `fr-merge-pass2` live 路线稳定后，再进入移动端适配
