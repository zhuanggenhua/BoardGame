## 0. Scope Correction
- [x] 0.1 Approval Gate：用户补放 BGG 电子版参考后，旧 TTS 布局完成口径失效；必须以 `dom.html`、`运行时.txt`、`css\03-thegang.css`、`settlement\*` 和最新真实截图重新验收。本轮已按该口径完成桌面中局满元素检查点；整体仍保持 `in_progress`。
- [x] 0.2 将 `add-the-gang-foundation` 从“整体完成”降级为“foundation 阶段完成”并在对齐表中写清
- [x] 0.3 建立 The Gang 后续 change 列表，标明哪些待批准、哪些可继续实现
- [x] 0.4 记录本 change 已在用户要求继续推进后实施；该记录不等同于逐条 change 批准门禁已在实施前满足
- [x] 0.5 记录 2026-07-10 用户裁定：纸牌帮正式牌桌固定单客户端玩家视角，不提供多人热座切换；所有玩家公开状态常驻可见，本地 AI / 测试运行能力不等同于多人热座产品合同

## 1. Data Intake Contracts
- [x] 1.1 建立真相源表：PDF、DOM、Images、已有实现、规则合同
- [x] 1.2 生成 Images 轻量 contact sheet 或等价预览，不直接读取大图
- [x] 1.3 建立图片用途分类表：基础版运行时 / 扩展 / 装饰 / 未识别 / 排除
- [x] 1.4 建立进入运行时资源的核对合同表：对象、源图、正式语义名、正式落点、压缩产物、manifest key、验证方式
- [x] 1.5 建立冲突待裁定表，禁止用猜测覆盖不可读或冲突素材；`blocked` / `base-runtime-candidate` 不得被口头裁掉后继续收口
- [x] 1.6 完成基础版规则对象到素材需求矩阵：扑克牌牌面、牌背、四轮筹码、警报/失败、金条/成功、桌面/牌槽、规则参考逐项有源文件/对象、命名、落点、使用方式或脚本参考板接入证据
- [x] 1.7 发现基础版必需素材缺口时，先补 proposal/tasks/spec 与矩阵缺口，再继续素材查找和实现；不得用 HTML/CSS/程序化元素或错用扩展素材强行通过端到端验收
- [x] 1.8 纠正 9250x7684 牌面源图 `httpssteamusercontentaakamaihdnetugc11150178257462815859B26889FF2BB711962C1798B79C870A35A62A80CF.png` 的旧 `blocked/基础版不接入` 口径，改为 52 张普通扑克牌牌面源图 `pass`
- [x] 1.9 从 TTS Workshop JSON 抽取素材和对象参考；该来源不再作为 UI 风格目标
- [x] 1.10 从 BGG 电子版 `dom.html`、`运行时.txt`、CSS 和结算抓取物抽取三区布局、底部手牌与 reveal/final 结算合同

## 2. Runtime Resource Closeout
- [x] 2.1 只复制并压缩已 locked 的基础版运行时图片资源；未 locked 的必需对象必须保持阻塞或取得明确替代批准
- [x] 2.2 重建 asset manifest 并确认 The Gang 新增资源 hash/bytes 匹配
- [ ] 2.3 发布到服务器资源主源/官方资源域名 并抽查代表性资源 URL；若环境阻塞，明确列出未上传资源和影响
- [x] 2.4 不把既有 DiceThrone manifest 漂移混入本 change
- [x] 2.5 牌背 `the-gang/cards/card-back` 已语义落盘、压缩、写入 The Gang manifest，并接入隐藏牌运行时

## 3. Runtime Entry Validation
- [x] 3.1 验证游戏注册表可发现 `the-gang`
- [x] 3.2 通过真实页面进入 The Gang 对局
- [x] 3.3 当前查看者的关键筹码选择与推进必须通过可见 UI 完成；单客户端代表态测试允许用状态注入或测试命令补齐其它座位的公开决策，但必须明确标注状态注入，不能冒充多人自然操作、座位权限或多端同步证明
- [x] 3.4 记录桌面与移动横屏页面证据；横屏是移动主交付方向，竖屏只验证兼容显示和关键区域可见性，不要求 Board 内层直接横向拖动
- [x] 3.5 当前真实页面 E2E 只能证明代码链路可跑；不得把 E2E 通过升级为基础版完整闭环
- [ ] 3.6 按新的 BGG 电子版 `layout-source-contract.md` 对 Board 布局做逐项复核并重新截图验收；桌面中局满元素截图已生成、PureRef 打开并 AI 复看，手机横屏仍待桌面验收后继续

## 4. Add-On Capability Decision
- [x] 4.1 裁定最低 AI/人机测试路径是否本轮实施
- [x] 4.2 裁定 action-log 是否本轮实施或拆后续 change
- [x] 4.3 裁定 undo UI 是否本轮实施或拆后续 change
- [x] 4.4 裁定 tutorial 是否本轮实施或拆后续 change
- [x] 4.5 裁定 debug-config 是否本轮实施或明确跳过

## 5. Verification
- [x] 5.1 `openspec validate add-the-gang-data-and-runtime-closeout --strict --no-interactive`
- [x] 5.2 The Gang 定向测试与 typecheck 继续通过
- [ ] 5.3 对齐表逐项证明：基础版素材已接入，BGG 电子版桌面过程态已通过；官方资源域名/服务器资源、手机验收和最终完成口径仍需继续，当前只标记 `in_progress`
