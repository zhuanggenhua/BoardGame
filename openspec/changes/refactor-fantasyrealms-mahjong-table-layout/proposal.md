# Change: 幻想国度改为麻将桌式牌桌布局

## Why
- 当前 `fantasyrealms` Board 本质仍是网页三栏后台布局：左栏堆状态，中间放公共区，右栏放焦点与进度。这种构图会把牌桌切碎，主区看起来像内容容器，不像正在进行中的牌局。
- 用户已经明确否定这条路线，并要求先完成设计，再按成熟麻将游戏的桌面信息层级重构。
- Fantasy Realms 的本质关注路径与麻将桌接近：自己的手牌是第一操作带，公共河/公开区是第二观察带，分数/进度/提示应退到边缘，不应继续与牌桌主区等权竞争。
- 用户已经进一步明确：`PC` 进行页要像 `SmashUp` 一样几乎不带描述性文字；说明、推演、提示、解释类 UI 不得在桌面 live 页面常驻。
- 这次不是 spacing bug 或局部美化，而是主布局模型切换，必须用新的 OpenSpec change 独立管理，并明确“PC 真实页先过，再进入移动端适配”的实施顺序。

## What Changes
- 为 `fantasyrealms-foundation` 新增“麻将桌式牌桌布局”要求，正式放弃当前三栏后台式构图。
- 先交付设计阶段产物：
  - 成熟麻将 UI 参考结论
  - `fantasyrealms` 桌面端重构布局规则
  - SVG 低保真草图
- 将桌面端主布局固定为：
  - 底部连续手牌操作带
  - 中央公开弃牌河
  - 顶部/角落的极简状态条
  - 右上压缩为座位式分数条，而不是信息卡片列
- 将桌面端进行页额外收紧为：
  - 禁止常驻 `当前焦点`
  - 禁止常驻 `结束进度`
  - 禁止出现大段规则说明、推演说明、观察者说明
  - 禁止把牌库/回合/分数/公开区/手牌分别包成同级厚面板
- 将实施顺序固定为：
  - 先做桌面端真实页重构与验收
  - 只有桌面端真实页达标后，才允许进入移动端适配
  - 除非用户明确要求并行或先做移动端

## Impact
- Affected specs: `fantasyrealms-foundation`
- Affected code:
  - `src/games/fantasyrealms/Board.tsx`
  - `design-system/games/fantasyrealms.md`
  - `design-system/games/fantasyrealms-mahjong-table-layout.svg`
  - `evidence/fantasyrealms/**`
  - `./.codex/skill/generated-design-implementation/SKILL.md`
  - `./.codex/skill/create-new-game/SKILL.md`

## Approval Boundary
- 本 change 当前只批准到**设计与方案冻结**：
  - 研究参考
  - 更新 OpenSpec
  - 更新设计规范
  - 绘制 SVG 草图
- `Board.tsx` 的真实实现、PC 端重构、移动端适配都属于后续实施任务；在用户明确说“按这个设计开工”前，不得把实现任务标记为已完成。
