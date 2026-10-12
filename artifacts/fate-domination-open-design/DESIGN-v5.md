# Fate/Domination OpenDesign 开放式牌桌候选稿 v5

## 状态

- `open-design-artifact-candidate`
- 人工设计验收：`not-approved`
- v5 根据最新反馈重排空间，不覆盖 v1-v4 历史稿。

## 设计决定

- 中央只保留正式未标记棋盘和必要的轻量状态文字；不再使用底部手牌容器或外围大型 UI 面板。
- 其他玩家全部放在棋盘上方，作为横向玩家带，给中央战场和底部手牌腾出空间。
- 手牌直接悬浮在桌面下沿，按通常 3 张手牌横向平铺，保留明确卡距和完整牌面，不旋转、不扇形、不互相遮挡。
- 选中牌只做上浮和金色边框强调，检查入口独立于选中动作；运行时落地时复用这份对象/交互契约，不复用其它游戏的扇形布局。
- 顶部不再放一组容易被误认为手牌的牌背扇形，改为规则相关的“局势 / 深山町 / 新都”状态摘要；正式牌区仍由中央棋盘内的 A/B 区域承担。
- 右上角不再放 Supply / Log / Menu 矩形按钮，统一由一个悬浮工具球展开圆形动作入口。
- 下一阶段使用右下角阶段球和轻量文字/箭头，不使用矩形按钮。

## 方格交互合同

- 使用项目正式未标记棋盘 `assets/fuyuki-city.webp`。
- `repository-relative-reference-not-committed` 仅作为区域坐标参考，不进入画面。
- 测试层默认打开。每个热点由 HTML 独立绘制白色半透明遮罩和字母/区域编号。
- 点击热点后变为 cyan 高亮，底部文字与短提示同步更新。
- 高亮只改变颜色、边框和光晕，不改变热点的几何位置，确保视觉高亮边界与半透遮罩严格一致。
- 右侧积分轨道不再使用 F1/F2/H 矩形；根据参考图圆环边缘检测结果绘制 4 列 x 10 行圆形交互节点，底部节点保留 0/10/20/30 等分值。
- 正式底图使用完整 `fill` 映射到参考图的 1000x600 坐标系，避免 `object-fit: cover` 裁切造成区域错位。
- GRID 动作可显示/隐藏测试层；正式态可以沿用同一坐标映射而移除标记。

## 区域映射

| 标记 | 交互责任 |
|---|---|
| A1 / A2 | 事件牌槽与中央局势/区域卡面 |
| B1 | 目标牌槽 |
| B2-1..3 | 深山町三个区域格 |
| B3-1..2 | 新都两个区域格 |
| C1..4 | 远坂工房四个资源格 |
| D1-1..2 | 深山町加成格 |
| D2-1..2 | 新都加成格 |
| E1..3 | 各区域行动出口 |
| F1..2 | 右侧 Servant 轨道分区 |
| G | 侦察入口 |
| H | 分数轨道 |

## 当前验收尺寸

- PC：1920x1080，无横向溢出；中央棋盘、顶部玩家、平铺手牌、阶段球同屏。
- 移动端不属于本 foundation 的当前验收范围；已有 `390x844` 渲染只作为后续适配的探索性参考，不代表移动适配已完成。
- OpenDesign artifact：`fate-domination-v5-2.html`
- 设计项目：`b4bb4fbb-ee71-4465-9e34-e4c24f397155`

## 2026-09-30 素材回查

- 服务器专属命名空间已拉取 57 个对象；本地文件、manifest、字节数与 SHA-256 全部一致。
- `masters/compressed/emiya-shirou.webp` 图面确认为卫宫士郎，可继续用于 `YOU · 卫宫士郎`。
- `masters/compressed/master-slot-b.webp` 图面确认为技能牌「干将·莫邪」，不得作为 Master、慎二或 Rival 肖像。
- `servants/compressed/saber.webp` 图面确认为阿尔托莉雅·潘德拉贡（Saber），可作为 Servant 真实素材。
- `servants/compressed/unlocked-pending.webp` 图面为卡背，不作为角色肖像。
- 目前远端 Fate 资源包没有独立的 `masters/compressed/kotomine-kirei` 或 `masters/compressed/matou-shinji` 文件；OpenDesign v5 已把这三个错误肖像位改成“待补图”，避免错图冒充角色素材。
- 本轮继续将 `servant-saber.webp` 接入当前玩家身份和顶部对手带，并将 `event-fate-battle.webp`、`situation-turning-point.webp` 实际放入棋盘 A1/A2 槽位；这三处不再只以文字摘要代表素材。
- 本轮 TTS Workshop 真源记录到绮礼、慎二的 `FaceURL`，但 Steam CDN 返回 HTTP 403，未把未取回的图片写入正式资源树。
