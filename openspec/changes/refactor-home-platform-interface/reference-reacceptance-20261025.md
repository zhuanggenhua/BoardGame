# 逐功能双端参考与交付依据

用户原话：“不是头像要这么做，是每个功能都要这么做”“同时找pc和移动端的”“前端……只需要找到前端参考网站……成熟设计的网页的截图”“一切设计都要是可考证的”。指定资料为 Checklist Design、UI Notes、Refero。

本记录是当前首页任务的证据与差距，不另定义规范。当前主源为 [UI 改动门禁](../../../.spec/knowledge/standards/ui-change-gates.md#开工门槛)，参考库入口为 [来源索引](../../../.spec/skills/ui-design-pipeline/references/reference-sources.md)。

## 已采用的资料分工

| 资料 | 本轮已核对的用途 | 交付时怎样使用 |
| --- | --- | --- |
| [Checklist Design](https://www.checklist.design/) | 覆盖网站、Web 应用、手机、组件和流程。实际读取了 [头像检查项](https://www.checklist.design/elements/avatar)，包含预览、修改入口、空头像占位、文件格式和更新状态等；部分旧详情路由已失效 | 每个功能选适用检查项，关联当前状态和直接证据；不适用项说明原因。目录页不等于已读全部细项，也不把可选建议变成新需求 |
| [UI Notes](https://uinotes.com/) | 真实产品 App 及截图库，按厂商、行业和具体产品定位。账户研究已确认五张公开页面提供的精确截图链接 | 优先补国内手机端真实界面；记录具体产品、版本、屏幕与链接。没有 PC 图就保留 PC 缺口 |
| [Refero](https://refero.design/) | [官方检索说明](https://refero.design/how-it-works) 支持按页面类型、交互、文字和产品查找 Web 与 iOS 截图 | 用具体产品屏幕作候选；只有实际可见或页面明确提供的媒体才计入可用参考。受限、低清晰度或仅有入口图的状态分别记录 |

三类依据分别回答：功能状态是否漏项、界面与操作如何表达、业务是否真实正确。检查清单不能替代真实产品参考；参考图也不替代本项目行为测试。

## 此次流程纠正

旧规范已有“所有 UI 先找参考”，但旧报告把单个手机上传参考扩展为整个双端页面设计的依据；总账中的“来源”没有逐功能、逐设备、逐状态定位。旧清单与机器校验主要检查测试、媒体和报告同一性，不能证明该参考覆盖了那个控件。此次在既有主源中收紧对照粒度，参考链路仅引用该主源，没有为头像建立特例，也没有另抄一套规范。

- 每个保留控件说明唯一任务、真实来源与必要性；无变化可提交的专用默认按钮是实际漏审，已移除，不能以其业务接口可用放行。
- 所有功能均查 PC 与手机；自然打开的登录、资料、头像、菜单、设置和二级窗口不能被排除。
- 静态表现采用对应状态截图。手势、展开、返回、取消等查相邻状态或实际流程；不默认要求源码。
- 保留现有项目风格和业务语义；不把参考的支付、营销、第三方登录、短信验证等顺带加入本产品。

## 已有资料与未证明项

Luna 研究已切换为 `gpt-6-luna`、`max`；此前代理报告保留原始身份，不追认为 max 结果。账户逐功能报告和原图来源记录位于 `.tmp/home-function-reference-account-20261025.md`、同名 JSON 及 `.tmp/home-function-references/account/`。主页其余功能继续在 `.tmp/home-function-reference-home-20261025.md` / JSON 中逐项记录。

账户图的来源复核查出：原先收集的二十四条 Refero 原图 URL，未能证明由对应公开页面提供，已从可用设计依据降为未证明候选；图片不删不改，保留审计记录。五张 UI Notes 页面在公开 HTML 中包含对应的精确原图链接，可以用于已覆盖的手机登录、验证码及相关资料态。它们不能替代 PC、头像裁剪、换邮箱或所有账户功能的参考。

当前仍需逐项补齐：主页导航与发现、搜索分类、详情和收藏、房间创建加入退出、账户链、菜单设置与主题、好友通知、反馈附图、投稿编辑上传送审、支持作者与关于、教程及配置入口。没有来源的格子继续未证明，不用列表名称或相邻状态凑齐。

本轮可核查的参考原图共二十二张：十七张来源页面明确提供的首页相关功能图片，加五张已核实公开链接的账户图片。参考图查看器为 <http://127.0.0.1:19687/?key=e9768d4acd21>，仅用于查看来源，不代表项目修后图或产品通过。二十四张来源未证明的 Refero 候选，以及二十四张采集方式不符合本会话浏览器约束的现场图均未纳入；原记录保留。具体索引位于 `test-results/evidence-screenshots/home/首页功能真实参考-20261025/source-review-manifest.json`。

## 当前实现和验收状态

- 默认及预设的专用提交按钮已改为有真实变化才出现的通用保存；八项单测先七失败一通过、修后八通过；三端浏览器用例三项通过，相关检查及构建通过。
- 新十八张头像图仅为候选：独立审查中三张裁剪态缺少直接可见取消；用户随后进一步否决上传入口和滑条式裁剪设计，整段上传方案保持退回，不能只补关闭就放行。
- 原九十六图的旧观察和所有行为日志保留；它们没有满足当前逐功能双端参考要求，整体最终通过资格撤回。未改实现且未被新条件覆盖的行为事实不因此作废。
- 上述是开始重构前的状态。用户随后明确允许与现有设计比较、收益明确才吸收，并授权开始重构；检查点已提交，后续全合同重审以[全部重审](full-reaudit-20261025.md)为当前记录，旧23图整体资格撤回。重构后修改尚未提交、推送或部署。

## 2026-10-26来源补证与当前边界

Discord官方[自定义资料](https://support.discord.com/hc/en-us/articles/4403147417623-Custom-Profiles)的桌面头像过程（附件33835248167831）和[服务器资料](https://support.discord.com/hc/en-us/articles/4409388345495-Per-Server-Profiles)的头像裁剪过程（附件30767021264919）已实际读取；完整原始动图及抽取帧保存在`.tmp/home-full-reaudit-references/`。只借鉴明确来源入口、圆形构图和直接操作、取消确认，不引入服务器头像或旋转等额外业务。官方手机过程与用户手机Steam的既有实际截图分别保留，不拿手机过程代替PC。

本轮28张当前变化图已完成主代理/Luna max逐张核对，实际上传文件选择事件、格式错误、拖动/滚轮/双指及保存持久化由行为测试另证。它们不是旧18张退回候选的重新放行。PC头像具体来源已补充，不能继续写成“PC完全无参考”；逐功能全部状态的完整双端商业来源仍未全部齐备，按未证明格子保留，不把登录短信、入口图或相邻产品状态充作换邮箱/发邮件等链路。

## 2026-11-05剩余来源复核

本轮由Luna以max完成只读查证。按用户后续要求与现有设计对比，只吸收可证明更合适的部分。下面的媒体覆盖是设计查证，不代替本项目行为。

| 功能 | 可复用的PC与手机来源 | 仍未覆盖的具体状态 |
| --- | --- | --- |
| 资料、头像 | Discord官方Custom Profiles桌面过程及Getting Started on Mobile的手机编辑过程，既有本地原始动图及帧可读；GitHub官方资料表单补充PC字段分区 | 上传失败及保存失败的参考状态 |
| 主题选择 | [Discord官方主题说明](https://support.discord.com/hc/en-us/articles/207260127-How-can-I-change-Discord-s-appearance-theme)有PC和手机独立主题设置图。PC附件42820984153239，手机附件42820961125911 | 本产品跨标签同步由自身行为要求验证 |
| 好友与通知 | [Discord官方Friends List 101](https://support.discord.com/hc/en-us/articles/217674288-Friends-List-101)的PC好友添加、手机添加及请求接受/忽略图，手机附件26294772461079和26294772477591 | PC通知的具体后续状态 |
| 投稿编辑与图片入口 | WordPress官方PC编辑器及插图弹层；[UI Notes腾讯地图手机表单](https://uinotes.com/pin/977327236520552803)展示照片空槽、定位与提交 | 对应本产品完整送审、审核中、退回与修订状态的双端来源 |
| 反馈附图 | 微软Outlook官方PC反馈窗可见描述与Include screenshot，手机资料只覆盖入口 | 手机完整附图表单，双端已选图片及删除状态 |
| 导航、搜索、详情、收藏 | 用户提供的Steam前后悬浮图可直接约束卡片选中效果；Valve官方资料可补PC详情，旧手机Steam现场图的部分本地文件已缺失 | 手机搜索分类、收藏返回和完整房间流程媒体仍未锁定 |
| 支持作者、教程和配置 | 已查Lichess公开支持与学习页面，页面文字和入口本身不足以证明具体双端状态 | 双端支持作者展开，手机教程步骤与配置状态 |

上述未覆盖格子继续保持未证明。第三方旧图仅作为候选，未将搜索摘要或图库入口写为已看过实际画面。

## 2026-11-08手机附图与退回状态补证

Luna max查找后，主代理逐张打开原始图片核对，三张均保存于 `.tmp/home-reference-closeout-20261108/`。首次传回的两个无 `original` 后缀临时副本全透明，已排除；以下哈希对应重新核实的可见原图。

| 对象与来源 | 原图直接证明 | 对当前实现的比较与剩余边界 |
| --- | --- | --- |
| [Sonar 手机反馈附图](https://docs.sonar.expert/field-tech-app/the-sonar-field-tech-app)，[原图](https://files.helpdocs.io/y0fqv9nyr6/articles/qsvfqgnuaf/1748287615092/field-tech-app-bug-attach-screenshots.png)，`sonar-attachments.png`，SHA-256 `212e0dc8eb08d4bba7a0053b2fbede57e48415c3ad140324ab139c241f66d81f` | 已有图片缩略图、可见删除按钮和继续添加入口 | 本项目只有单图粘贴，不因此增加多图功能；当前手机删除按钮的可发现性须按真实粘贴路径单独测试。原图没有展示系统选图器或大图预览 |
| [Domyland 手机退回及修改](https://help.domyland.ru/adverts)，[退回图](https://static.tildacdn.com/tild6233-3762-4235-b564-333332306237/image.png)，`domyland-rejected.png`，SHA-256 `af559c7d08492f7f6a6cbfabf3c3d7904a8644dfc7f64f55d8aee2dbf786fe2a` | 拒绝状态、审核意见和修改入口 | 可对比本项目退回意见及修订入口；不证明同一对象完成重送 |
| 同上，[编辑保存图](https://static.tildacdn.com/tild6433-3136-4636-a331-376135363038/image.png)，`domyland-edit.png`，SHA-256 `2c023ef85209b66de5adcd37babb0e5c9b27dE3a8df2a2f002e17e939f4d8e8` | 已发布对象进入编辑，保存后进入审核状态 | 该图与退回图不是同对象连续流程，不能证明退回后重提进入待审；项目自身完整链由真实浏览器行为另验 |

其余设备与状态缺口继续逐格记录，不把一个产品或相邻状态扩展为全部功能的设计依据。

## 2026-11-08 手机筛选、房间和教程补证

Luna max 检索后，主代理逐张查看以下四份原图，留存于 `.tmp/home-reference-closeout-20261108/`。这些是设计参考，并不证明本项目行为：

| 对象与来源 | 画面直接证明 | 与本项目比较及边界 |
| --- | --- | --- |
| [Board Game Stats 官方筛选说明](https://www.bgstatsapp.com/explanations/custom-filter/)，[手机筛选原图](https://www.bgstatsapp.com/wp-content/uploads/2024/07/allFiltersDropdown.png)，SHA-256 `164306aceaabdea639b68f295b8c05769cacf01cba9c488078574fe4a4c0396c` | 分类、人数等多条件位于筛选菜单 | 本项目手机发现页提供搜索与分类，参考提供复杂筛选而非同样场景，不据此添加额外筛选；图中没有文字搜索和筛选前后结果 |
| [BoardGameGeek 官方商店](https://apps.apple.com/us/app/boardgamegeek/id1559701270)，[手机列表原图](https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/51/34/0c/51340cbc-b9d9-c1d0-e1fa-50e1b0099a08/4ea798ec-cfa6-456f-8afc-d0c135db6e6f_iPhone_8_Plus_2.png/1000x1000bb.png)，SHA-256 `8f3faa76bb52c9bd066dfbb751150a62df25f0a1a931644c3fbaffef5725bbee` | 游戏列表、类型选择和底部导航 | 可核对列表与导航的基本职责；没有收藏选中、详情返回原位置的连续状态，不据此更换本项目布局 |
| [WePlay 建房攻略](https://www.malavida.com/es/articulos/como-crear-una-sala-privada-en-weplay-para-jugar-solo-con-tus-amigos)，[手机建房原图](https://imag.malavida.com/articulos/pasos-para-crear-una-sala-privada-en-weplay.jpg)，SHA-256 `aa05f2eef3165e52cf1da45f5313bad5b9207ee44ca329a9d7c1ceefc61b12aa` | 建房入口、表单、密码开关及设置密码 | 是第三方记录的社交派对游戏，可比较步骤与密码入口；没有加入时输入密码或房主等待状态。本项目实际建房及加入由自身浏览器回归验证 |
| [Chess.com 官方报告](https://www.chess.com/board-reports/2025-q4)，[手机教学原图](https://images.chesscomfiles.com/uploads/ad_image/30787.632dcc1c.png)，SHA-256 `026d90065f65f06a0315264bac52054398f9599306656d50398c27d1c7578807` | 教程入口、步骤进度、提示及下一步 | 可比较教程步骤的可识别性；不证明配置入口，也不以其他游戏教程内容替换本项目教程 |

仍缺手机收藏返回原位置、目标类产品密码加入确认，以及对应桌面完整状态链的可核查原图；这些格子不因检索结束而标记为已证明。

追加核验的 [BGA 第三方旧版桌面教程](https://boku-boardgame.net/board-game-arena)包含[房间配置](https://boku-boardgame.net/wp-content/uploads/2022/09/board-game-arena-friend-7-680x272.webp)与[可加入桌列表](https://boku-boardgame.net/wp-content/uploads/2022/09/board-game-arena-manual-2-680x234.webp)原图；主代理分别打开确认，可比较房间参数、人数和加入入口，不能证明当前版本或密码确认。对应本地文件 `bga-friend-configuration.webp`、`bga-open-tables.webp` 的 SHA-256 分别为 `8409dfb78670a713681e7fccf2641db0cefd032cfa1299c33dadf36da1021a52`、`94f36a2013533b6298c62f7566fa8831b73a188b1b51cd4839cc70fed70b3394`。教程中一张被描述为接受邀请的图实际上是主持人开始游戏，不计作接受邀请证据。
