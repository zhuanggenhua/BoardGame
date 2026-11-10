# 七大恨横屏与人口定位重构

## 用户纠偏：旧移动验收失效

用户明确要求手机是 PC 等比缩放；本目录先前手机专版布局与该要求不符，下文原有整体 PASS 和截图仅为历史失败候选，不代表当前版本通过。人口定位的单独测试结论仍只证明其各自覆盖范围。

角色：本轮任务合同与证据记录；规范正文仍在 `.spec/`。

用户原话：“手机横屏明显有问题吧，还有人口标记好像有的地方重叠了？检查一下是不是区域中心找的算法不对”“按skill、规范重构啊”。

## 范围与来源

- 目标：当前工作树七大恨主棋盘；恢复横屏信息、修正已证实的人口定位与重叠，不改玩法、地图边界或视觉皮肤。
- 真相源：`runtime-region-graph.json`、正式 `region-mask.png` 与 `runtimeRegionOwnership.ts`、现有 PC HUD、已批准 `refactor-qidahen-decision-flow-and-mobile-hud/design.md`。
- 环境：本地当前工作树；PC 1920×1080、2560×1304，手机横屏936×432（13:6）。
- 验收：当前代码离线检查37区归属、完整方块/窄区引线、人口与部队/控制标记不相撞；同版本真实页常态、支付、地图目标、放大与返回的整屏对照。局部通过不等于整体通过。
- 当前阶段：本轮限定范围代码/行为/图面及查看器门禁通过；未执行提交、推送或发布。

## owner 与元素职责

| 对象 | 唯一职责/来源 | 本轮处置 |
| --- | --- | --- |
| 地图 | 正式底图与蒙版；地图平移缩放 | 保留同一Scene坐标系和原交互 |
| 区域中心 | runtime graph；新局读模型与标记的作者源 | 修正辽东/辽西落邻区的保存值，seed及分区不变 |
| 人口方块 | region.population；连续计数 | 独立populationLayout只读消费正式像素归属，检查完整占位，窄区短引线指向内部点；不改计数 |
| HUD视口 | QidahenBoardShell测量容器 | hudLayout提供同一读合同，HandZone删除独立window监听 |
| 玩家公开读数 | 原PlayerFloat三席 | 恢复同源人物标记，收回横屏全宽扩张 |
| 轮盘 | 原印刷轮盘本体 | 保留左上HUD，调整对象级尺寸 |
| 纪年 | 原YearCardSlot两张正式卡面 | 取消横屏隐藏，左侧同源卡面缩略与放大 |
| 朝鲜 | 原KoreaZone卡牌本体/数量 | 取消横屏隐藏，右上原对象继续显示 |
| 手牌/抽弃牌 | 原HandCard/DeckStack | 提高手牌尺寸、保留长按/查看/主点击；查看与类别角标不压标题；堆位仍左下/右下语义的原对象 |
| 支付 | 原HandInteractionTray与原命令 | 共享手牌宽高合同推导位置，按内容换行，保留确认/取消 |
| 当前决策 | 原ActionsZone | 原右侧单一承载，内部滚动，不新增代理按钮 |
| 放大 | 原MagnifyOverlay | 保留portal阅读与关闭回到原选择 |

三条影响画面的领域事实：人口是各区的当前数值；共享印刷区域拆成多个运行时区域，保存center不能替代像素归属；轮盘、纪年、朝鲜牌槽是独立固定HUD，地图自由查看不能使其消失。当前任务是选牌→确认或取消，地图目标阶段继续由地图本体承接。

## 参考与限制

- 已读当前PC源码与上一轮两张整屏原图；旧图只作为失败基线，不能作为当前验收。
- 独立审查实际读取 Root 官方 GooglePlay 图14/15地图近远景、16放大、17翻牌：场景变换与HUD分离、边缘锚点稳定、阅读集中；不复制其3D、术语、图标行动列或牌面数量。图11/13营销/菜单排除。来源：https://play.google.com/store/apps/details?id=com.direwolfdigital.root 。缓存位于 `temp/qidahen-mobile-population-20261027/root14.png` 等。
- 商店静态图不证明连续交互、触控热区或PC来源；本轮为恢复已批准同源HUD合同，不据此新设承载。
- 标准：before-you-code、code-design、game-ui-design、qidahen-ui-imagegen-rules、adapt-game-mobile、ui-responsive-layout、ui-change-gates、ui-audit-loop。

## 验证记录

- 原3套定向测试26/26；新增人口归属与占位合同2/2。
- 首次支付取消E2E 1/1，当前截图待审；该用例使用basic-opening代表态测试入口，只证明该消费链，不证明完整联机开局。
- 实施过程曾保持待审；最终图面与证据角色见下方收口记录，旧进度不代表最终状态。


## 最终实现与验证补充

- 地图缩放/复位控件迁到原HUD，移除无人消费的Scene overlay壳；状态仍由Board唯一mapViewport持有。手机右侧动作留出全局工具展开组；手牌与托盘共用同一空间预算。
- 桌面支付托盘给选中scale的真实上沿留出间隔；招安目标态保留右侧唯一原决策承载，删除同任务地图绿色横幅，继续点地图本体。
- 多牌滚动时，查看镜像层与手牌层共用handAlignmentClass及同一个滚动偏移；保留6张合法普通手牌代表态，逐张真实横滚检视并关闭。该代表态只验证消费链，不证明自然抽取。
- 原正式蒙版37区离线检查通过；真实basic-opening局面显示34个正人口，另外3个朝鲜区域人口为0，不伪造显示。人口0变正数不会挤动邻区固定几何槽位。
- 8个定向行为/几何套件57/57通过，记录 `temp/qidahen-mobile-population-20261027/behavior-final.json`。
- 最新标准隔离E2E：`e2e-api-index-fixed.log`，1 passed（31.3s），跑次 `e2e-1793069378737-telj5e`。覆盖PC1920×1080、宽屏2560×1304、手机936×432的常态、支付、查看关闭返回、取消不扣牌、支付进入地图目标，以及6张牌滚动检视。
- `raw/runtime-at-entry.json` 证明采集入口前后端源码身份匹配；目标10文件采集前后相同，采集版本 `67b748a948d1f83e0ad98cd45af2205f323da8417f212db816948e6efe38911c`。`raw/Board.source.tsx` 保存该跑次源码，可核对后续同文件并行变更；不得把其它修改说成本轮所有。
- 新增UI模块ESLint通过，spec-lint及本轮diff空白检查通过。全仓typecheck该次未过（4860项）；Board旧源码字串套件该次207/215通过、8项未过，未宣称全仓检查通过。相关日志在同一temp目录。

## 正式入口启动的必要修复

并行新增的外链功能令最新API无法启动；只做恢复正式验收入口所必需的小修，未改变其业务、默认值或权限：

1. `external-game`、`creator-claim`、`external-play` 三个schema共26个已有primitive字段增加显式Mongoose type，修复esbuild产物无design:type时的CannotDetermineTypeError。改前快照及字段列表保存在temp中的api-schema-before/api-schema-fix.json。依据本地已安装Prop装饰器和Context7官方nestjs/mongoose文档。
2. 认领表普通gameId索引和已批准唯一索引默认同名，MongoDB code86阻止启动；给原partial unique索引显式命名unique_approved_creator_claim_per_game，保留普通索引、unique与approved条件。未执行drop、数据清理或生产动作。
3. 修后完整标准API启动并跑通上述隔离E2E；独立代码审查确认只新增字段类型和索引名称。

未覆盖：手机竖屏、其它手机尺寸、其它全部游戏阶段、完整联机开局及全游戏规则审计。当前目标仅本轮主棋盘横屏与人口定位，不将代表态升级为整游戏验收。


## 最终收口

- 最新本轮独立流程：`temp/qidahen-mobile-population-20261027/e2e-final-board.log`，1 passed（27.6秒）；采集版本 `9ee82167d57efea727cab98bcdac2a77b91b249ad7892723d5d25375201b48c7`，入口、快照、10图与几何记录在 `raw-current/`。其前端/后端身份在入口实际匹配，采集前后目标代码匹配。
- 最终当前定向测试刷新为58/58通过（原57条后并行任务增加一条）；报告 `behavior-final-current.json`。不得据此宣称全仓检查通过。
- 独立图面审查10/10 PASS，评分92–95，汇总93.6。相同原图字节沿用7张，只增量重审3张；报告 `verified/final-original-review.json`。
- 图组已逐媒体绑定实际source/hash/状态，另有独立旧新职责审查；地图段只证明支付进入选择、候选高亮保留，不声称已实际点击地图目标完成结算。六牌是本轮合法代表态，无旧六牌图；旧图仅为父棋盘背景之处均明确标注，代码/日志/内部压力图与前后图片分开登记。
- 采集后并行任务仅对教程地区标签及突袭支付专属分支继续改动，原始整文件hash随之变化。`verified/source-scope-equivalence-review.json` 精确锁定当前Board/CSS/Tray hash；测试模式无教程步骤、征召动作不匹配突袭样式，当前所示非教程/非突袭状态可限定沿用。不能宣称整个Board字节同版本，也不把新教程/突袭分支计入本轮视觉验收。
- 最终查看器清单6图；其余宽屏、桌面目标和六牌压力4图留作内部。正式入口dry-run通过、目录注册6媒体，网页HTTP200。
- 供用户查看：http://127.0.0.1:14924/?key=cf5156b248f6 。未自动打开浏览器；链接可用不代表用户已查看或验收。
- 未覆盖竖屏、其它手机尺寸、全部游戏阶段和完整联机开局；全仓类型检查和旧源码字串套件尚未全部通过。未执行Git提交、推送或部署；保留并行任务所有改动。
