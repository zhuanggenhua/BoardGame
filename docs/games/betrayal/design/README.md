# 山屋惊魂设计稿索引

> 目录用途：统一管理 `betrayal` 的正式设计稿、参考稿和实现约束。
> 当前规则：默认按四步走，先规则提炼布局，再做单版布局收敛，再做与素材统一的单一风格，最后才分界面出稿；除非用户明确要求，否则不再默认裂变布局或风格。当前风格默认优先 **2D 印刷桌游设计稿**，不继续往 3D 实体渲染方向收。

## 当前设计状态

- 当前对话已经明确改为：停止继续生图，直接以 `generated/betrayal-runtime-prehaunt-board-v4.png` 作为运行时实现基线。
- `generated/betrayal-character-select-style-b.png` 作为角色选择实现基线。
- `generated/betrayal-endgame-style-b.png` 作为终局实现基线。
- `v5-v12` 以及其它继续稿统一降级为失败/过程参考；它们没有守住 `v4` 的版式纪律，不能再被当成默认候选。
- 当前已进入 **首剧本实现线**：目标是跑通 `角色选择 -> 恶兆前运行时 -> 终局`，并用真实页面截图完成验收。
- 旧的 `step2-imagegen-*`、`style-a / b / c` 只保留历史档案价值，不代表当前继续方向。

## 四步门禁

1. Step 1：规则提炼 / 运行时结构稿
2. Step 2：布局收敛 / 默认 1 张继续执行的布局母版
3. Step 3：同布局统一风格
4. Step 4：已选风格下分界面出稿

补充硬约束：

- Step 2 默认只沿当前已选母版继续收敛；除非用户明确要求，否则不再开多版布局比较。
- Step 2 继续收敛时，仍然必须守住素材优先：
  - 尽量复用原始素材的形状语言、牌框、槽位、徽记、属性语法；
  - 即使原素材对动态状态表达不完美，布局阶段也先保留它；
  - 对 `betrayal` 而言，属性表达优先沿用官方探索者板 / 五角属性语法，不先替换成泛化圆点、进度条或通用仪表盘。
- Step 2 在生成前必须先回答 3 件事：持有物最多放多少、玩家当前能做的事有没有入口、玩家先看哪里。
- 用户本轮已批准以 `v4 + character-select-style-b + endgame-style-b` 进入首剧本实现；实现验收必须回到真实页面截图，不得用 HTML mock 或静态图冒充。

## Step 1 候选稿：规则提炼 / 运行时布局

- `generated/step1-runtime-structure-material-v2.png`
  - 用途：新的 `pre-haunt` 运行时主界面结构稿
  - 状态：**Step 1 结构基线**
  - 说明：
    - 中央房间板块区仍是主视图
    - 左侧用官方探索者牌直承角色语法，并保留当前持有区
    - 右侧只保留紧凑牌堆、帮助入口、弃牌/日志入口，不让参考卡常驻抢位
    - 底部已经出现必要动作：`移动 / 探索 / 交易 / 使用 / 结束回合`
    - 当前稿优先复用了标题横幅、探索者牌、牌背、参考卡等原素材语言
    - 房间图仍是素材语法占位，不冒充“正式已裁好的全部房间运行素材”
- `generated/step1-runtime-structure-material-v1.png`
  - 用途：`v2` 的前一版结构稿
  - 状态：历史候选
  - 说明：结构方向成立，但信息块更杂，主次不如 `v2` 清楚

## Step 2 历史候选稿：布局分裂

- `generated/step2-imagegen-material-first-a2.png`
  - 用途：素材优先布局生图稿
  - 状态：历史候选
  - 说明：
    - 明确保留官方探索者五角板、牌背与桌游材质语言
    - 当前探索者区仍然较重，但这张图已经是正式生图稿，不再是手工拼贴布局图
- `generated/step2-imagegen-material-first-a3.png`
  - 用途：素材优先布局生图稿
  - 状态：历史候选
  - 说明：
    - 在 `A2` 的基础上继续降低了面板感
    - 大探索者板、属性徽记与手持卡都回到了更自然的桌面物件语义
    - 如果后续仍坚持“尽量保留原素材语法”，这张比 `A2` 更成立
- `generated/step2-imagegen-material-first-a4.png`
  - 用途：素材优先布局生图稿
  - 状态：当前候选
  - 说明：
    - 保留官方五角探索者板与素材优先语法
    - 去掉了 `A3` 底部整条 UI rail 的观感，动作提示改成桌边离散物件
    - 比 `A3` 更像商业概念设计画，而不是“素材优先的桌游 UI 稿”
- `generated/step2-imagegen-balanced-b2.png`
  - 用途：左右平衡布局生图稿
  - 状态：历史候选
  - 说明：
    - 中央房间主视区最大，左右信息区都被压轻
    - 动作条仍然明确，但没有大块后台面板感
    - 已被 `step2-imagegen-balanced-b3.png` 进一步收口
- `generated/step2-imagegen-balanced-b3.png`
  - 用途：左右平衡布局生图稿
  - 状态：历史候选
  - 说明：
    - 保留了 `B2` 的大棋盘优势
    - 进一步削弱了“软件面板感”，把当前玩家区、队友区、牌堆区都更自然地落回桌面对象
    - 已被 `step2-imagegen-balanced-b4.png` 进一步收口
- `generated/step2-imagegen-balanced-b4.png`
  - 用途：左右平衡布局生图稿
  - 状态：历史候选
  - 说明：
    - 继续保留大棋盘优势
    - 比 `B3` 更少框体感，牌堆和队友都更像桌面上自然摆放的实体对象
    - 已被 `step2-imagegen-balanced-b6.png` 继续压低“被组织成一块”的感觉
- `generated/step2-imagegen-balanced-b6.png`
  - 用途：左右平衡布局生图稿
  - 状态：历史候选
  - 说明：
    - 延续 `B4` 的大棋盘优势与少框体路线
    - 右侧牌堆改回“牌堆 + 散牌 + 小物件”，不再像被整理好的信息栏
    - 动作区继续收成桌边机关件，整体更像真实桌游桌面上的运行态设计稿
- `generated/step2-imagegen-balanced-b7.png`
  - 用途：左右平衡布局生图稿
  - 状态：历史候选
  - 说明：
    - 保留 `B6` 的大棋盘与少框体优势
    - 底部动作区进一步去掉“按钮排”观感，更像嵌进桌边的机械件
    - 左侧持有物与右侧散牌更自然，整体更像真实桌游桌面而不是被编排好的 UI 版式
- `generated/step2-imagegen-balanced-b8.png`
  - 用途：左右平衡布局生图稿
  - 状态：历史候选
  - 说明：
    - 延续 `B7` 的大棋盘、少框体和去组织化桌面语义
    - 底部动作区不再是一整条连续控制带，而是 5 个离散的桌边铭牌 / 机关件
    - 比 `B7` 更像真实桌游桌边的实体操作提示，而不是软件 UI rail
- `generated/step2-imagegen-balanced-b9.png`
  - 用途：左右平衡布局生图稿
  - 状态：历史候选
  - 说明：
    - 保留 `B8` 的大棋盘与离散桌边铭牌思路
    - 动作提示更像桌边临时摆放的小物件，而不是一组统一控件
    - 整体更接近“商业概念设计画”而不是“桌游 UI 稿”
- `generated/step2-imagegen-balanced-b10.png`
  - 用途：左右平衡布局生图稿
  - 状态：**当前推荐**
  - 说明：
    - 延续 `B9` 的大棋盘与桌边离散提示物件路线
    - 底部动作提示继续减弱“统一控件组”的整齐感，更像桌边符号物件
    - 当前是这条平衡布局线里最接近“概念设计画而非 UI 稿”的版本
- `generated/step2-imagegen-action-near-board-c2.png`
  - 用途：动作贴近主棋盘布局生图稿
  - 状态：历史候选
  - 说明：
    - 保留“动作离当前房间更近”的思路
    - 相比上一版 `C`，已经去掉大说明卡和解释味
    - 目前仍比 `B2` 更强调动作条存在感
- `generated/step2-imagegen-action-near-board-c3.png`
  - 用途：动作贴近主棋盘布局生图稿
  - 状态：当前候选
  - 说明：
    - 把动作条继续收成更像桌边机关件，而不是软件按钮栏
    - 当前玩家区被进一步压轻，视线更容易从当前房间落到动作条
    - 相比 `C2` 更像真正的生图设计稿

### Step 2 失败反例：手工拼贴稿

- `generated/step2-layout-material-first-a.png`
  - 用途：手工拼贴布局稿
  - 状态：**失败反例**
  - 说明：
    - 它虽然试图守住素材优先，但交付物类型错了
    - 这是一张带大量边框和素材拼盘感的手工拼贴稿，不是合格的生图设计稿
- `generated/step2-layout-balanced-b.png`
  - 用途：手工拼贴布局稿
  - 状态：**失败反例**
  - 说明：
    - 它说明了“左右平衡”这条布局思路存在价值
    - 但画面本身仍然是厚边框、深色大面板、拼贴式资产摆放，不能作为正式 Step 2 设计稿继续使用
- `generated/step2-layout-action-first-c.png`
  - 用途：手工拼贴布局稿
  - 状态：**失败反例**
  - 说明：
    - 它说明了“动作贴近主棋盘”这条布局思路存在价值
    - 但同样属于手工拼贴稿，不是可继续批准的生图设计稿

补充说明：

- 当前对话已改为沿 `generated/betrayal-runtime-prehaunt-board-v4.png` 单线继续收敛；上面这批 `step2-imagegen-*.png` 保留为历史档案，不再是默认继续母版。
- 旧的 `step2-layout-*.png` 只保留为**失败反例**与布局意图记录，不再作为当前 Step 2 候选。
- 在 `v4` 的友好性问题收干净前，仍然不能进入 Step 3。
- 当前继续稿还要额外守一条：默认继续线应是 **2D 印刷桌游 UI 稿**，不是 3D 实体渲染概念图。

## Step 3 历史候选稿：同布局风格分叉

- 状态：**未按当前口径启动**
- 说明：当前口径下只允许做“与素材统一的单一风格”；旧的 `style-a / b / c` 只保留为历史风格候选，不再视为当前默认 Step 3。

## Step 4 候选稿：已选风格下分界面出稿

- 状态：**尚未开始**
- 说明：必须建立在 Step 3 已批准的单一风格上；旧的角色选择稿和结算稿只保留为历史探索稿，不代表当前 Step 4 已通过。

## 历史试稿 / 反例

- `generated/betrayal-runtime-prehaunt-board-v1.png`
- `generated/betrayal-runtime-prehaunt-board-v2.png`
- `generated/betrayal-runtime-prehaunt-board-v3.png`
- `generated/betrayal-runtime-prehaunt-style-a.png`
- `generated/betrayal-runtime-prehaunt-style-b.png`
- `generated/betrayal-runtime-prehaunt-style-c.png`
- `generated/betrayal-character-select-style-b.png`
- `generated/betrayal-endgame-style-b.png`
- `generated/betrayal-foundation-ui-mockup-v3.png`
- `generated/betrayal-foundation-ui-mockup-v1.png`
- `generated/betrayal-foundation-ui-mockup-v2.png`
  - 说明：这些稿把“资源壳层 / 资料录入页”误当成了 UI 设计目标，只保留作反例和过程对照，不再作为当前有效稿引用

## 当前唯一有效的实现约束文档

- [design-system/games/betrayal.md](D:/gongzuo/webgame/BoardGame/.worktrees/betrayal/design-system/games/betrayal.md:1)
  - 用途：前端可复刻约束、UI 四步门禁、需求对齐、主交互槽位、可见性边界、禁止项、移动端基线

## 参考素材

- `reference/`：预留给后续量测底稿、素材裁图、参考对照

## 说明

- `design-system/games/betrayal.md` 不是位图设计稿本体。
- “foundation 资源壳层 / 录入界面”不再是 `betrayal` 的 UI 设计目标。
- 运行截图、E2E 截图、实现后页面截图不得放进本目录冒充设计稿。

## 当前自检结论

- `step1-runtime-structure-material-v2.png` 是当前最接近“能友好进行游戏”的 Step 1 候选稿。
- 当前已经具备：
  - 中央房间板块主视图
  - 当前探索者卡与持有物可见
  - 队友摘要可见
  - 牌堆与弃牌紧凑存在
  - 当前可执行动作可见
  - 当前推荐动作和当前探索位置有最小高亮
  - 原素材语言占比足够高，没有提前换成通用数字 HUD
- 当前仍未证明的内容：
  - 属性轨与动态等级如何在不破坏原素材语法的前提下表达
  - `betrayal-runtime-prehaunt-board-v4.png` 还能否在不改总构图的前提下，承受更多持有物、更多队友语义和更清楚的动作可用态
  - 后续统一风格稿与分界面稿
  - 可进入正式实现的用户批准

## 当前 `v4` 实施基线

- 当前运行时实现基线：`generated/betrayal-runtime-prehaunt-board-v4.png`
- 当前角色选择实现基线：`generated/betrayal-character-select-style-b.png`
- 当前终局实现基线：`generated/betrayal-endgame-style-b.png`
- `v4` 已成立的点：
  - 中央房间板块网络是主视区，玩家第一眼就知道这是房间探索桌面；
  - 左侧探索者板、右侧三堆牌、底部 5 个主动作对上前兆前规则；
  - 风格接近 2D 印刷桌游 UI，不需要再默认做 `style-a / b / c`；
  - 它的五区关系比后续过程稿更稳定，因此本轮直接按它实施。
- `v5-v12` 的当前定位：
  - `v5` 明显往 3D 实体渲染方向跑偏；
  - `v6` 把按钮功能解释和帮助说明做成了常驻正文；
  - `v7` 重写了分区关系，右侧和左侧都变碎；
  - `v8-v12` 虽有局部收敛，但已经不再是本轮实现目标，统一只保留为过程参考。
- 当前实现状态：
  - `src/games/betrayal/game.ts` 已接入角色选择、恶兆前运行时、终局三阶段；
  - `src/games/betrayal/Board.tsx` 已接入角色选择、运行时、终局三屏，并已把运行时从旧的抽象条形房间列表纠回 `v4` 五区结构；
  - 运行时房间牌已经接入 `public/assets/i18n/zh-CN/betrayal/rooms/` 的真实裁片，不再用 CSS 渐变/程序纹理冒充房间牌；
  - 终局页的目标、结果、奖励、统计和叛徒败退图标已经换成探索者牌、房间牌、牌背和参考卡等真实素材，不再使用 emoji 假图标；
  - `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 已覆盖首剧本命令链路；
  - `e2e/betrayal-first-scenario.e2e.ts` 已生成三阶段真实页面截图，位置在 `evidence/betrayal-first-scenario/`；
  - 当前截图只能证明首剧本流程可跑通、运行时方向已回到 `v4` 且核心图像不再是纯假前端；角色选择、运行时、终局均尚未达到对应设计稿的高保真最终验收。
- 当前素材缺口：完整 `6300x5400` 房间拼版原图远端已 404，本地只剩 `contact-11-1425-1426.jpg` 缩略拼图；因此当前房间裁片清晰度和房间唯一性仍不足，后续拿到高清房间源图后应按同名资源替换。

## 当前 Step 2 自检结论

- `step2-imagegen-material-first-a2.png`
  - 优点：
    - 素材保真度最高
    - 五角探索者板和桌游物理质感最强
    - 最符合“哪怕原素材表达不完美，也先保留它”的要求
  - 问题：
    - 左侧玩家区仍稍重
    - 比 `B2` 更像“素材优先展示”而不是“长期运行态”
- `step2-imagegen-material-first-a3.png`
  - 优点：
    - 比 `A2` 更少面板感
    - 仍然最守住官方探索者板与五角属性语法
    - “原素材优先”的要求在这一版里最明确
  - 问题：
    - 当前玩家区仍然是三条线里最重的一条，且底部仍有明显 UI rail 感，已被 `a4` 替换
- `step2-imagegen-material-first-a4.png`
  - 优点：
    - 比 `A3` 更少 UI 控件感，底部动作提示改成桌边离散物件
    - 仍然最守住官方五角板、牌背和原素材语法，是当前最强的素材优先方向
    - 整体更像概念设计画，而不是“素材优先的运行界面排布”
  - 问题：
    - 左侧角色区仍然是三条方向里最重的一条；如果继续收，只能围绕“减轻左侧存在感”做局部调整
- `step2-imagegen-balanced-b2.png`
  - 优点：
    - 主棋盘面积最大
    - 左右区域都足够轻，视线最稳定
    - 当前能点的动作清楚，但没有形成丑的后台条块感
    - 是当前最接近“友好进行游戏”的一张
  - 问题：
    - 玩家板被压得更轻，素材表达不如 `A2` 强
- `step2-imagegen-balanced-b3.png`
  - 优点：
    - 相比 `B2` 更像真实桌面设计稿，而不是 UI 面板排布
    - 当前玩家、队友、牌堆都变成了更自然的实体桌面对象
    - 保留了平衡布局的优势，同时明显降低了框体感
  - 问题：
    - 动作条仍然是强可见对象，但已经不再像后台按钮栏
- `step2-imagegen-balanced-b4.png`
  - 优点：
    - 比 `B3` 更克制，右侧不再像被组织过的信息区
    - 当前玩家、牌堆、队友、帮助都更像桌面物件
    - 仍然保留最稳定的游玩视线与主棋盘面积
  - 问题：
    - 动作条仍然是可见控制件，但已经更接近桌边机关件而不是 UI 条
- `step2-imagegen-balanced-b6.png`
  - 优点：
    - 比 `B4` 进一步拆掉了右侧“同一块 UI 信息区”的观感
    - 牌堆、散牌、队友和标记物更像桌面上自然摆放的实体对象
    - 动作区继续保留必要可读性，但更像嵌在桌边的机关件，而不是一排按钮
  - 问题：
    - 动作区仍然偏像一整条被雕出来的控制带，已被 `b7` 进一步压轻
- `step2-imagegen-balanced-b7.png`
  - 优点：
    - 比 `B6` 更少“按钮排”感，底部动作更像桌边机关件而不是软件控件
    - 左侧持有物和右侧散牌继续去组织化，更像桌面自然摆放的牌与配件
    - 仍保留平衡布局里最稳定的游玩视线与大棋盘优势
  - 问题：
    - 动作区虽然已经不像按钮排，但仍是一整条连续桌边控制带，已被 `b8` 拆成离散铭牌
- `step2-imagegen-balanced-b8.png`
  - 优点：
    - 比 `B7` 更进一步去掉了“整条控制条”观感，动作区读起来像 5 个独立的桌边铭牌
    - 大棋盘、探索者板、牌堆和散牌仍保持平衡布局里最稳定的游玩视线
    - 当前这张最接近“真实桌游桌面 + 少量必要数字增强”的第二阶段平衡方案
  - 问题：
    - 底部 5 个铭牌虽然已拆散，但仍像同一组被精心排过的控件，已被 `b9` 再压轻一点
- `step2-imagegen-balanced-b9.png`
  - 优点：
    - 比 `B8` 更少“统一控件组”的感觉，动作提示更像桌边临时摆放的实体物件
    - 大棋盘、探索者板、牌堆和散牌继续保持最稳定的平衡视线
    - 当前这张最接近“商业概念设计画中的可实现牌桌”，而不是 UI layout
  - 问题：
    - 底部 5 个提示物件虽然更像道具，但 still 偏整齐，已被 `b10` 再轻微打散
- `step2-imagegen-balanced-b10.png`
  - 优点：
    - 比 `B9` 更少一点“同组控件”规整感，动作提示更像桌边符号物件
    - 大棋盘、探索者板、牌堆和散牌继续保持最稳定的平衡视线
    - 当前这张是平衡布局线里最接近“概念设计画”的版本
  - 问题：
    - 提升已经明显变窄，后续若继续沿这条线压，也只会是很小的局部收益；不能再回到连续 rail、统一按钮组或厚边框思路
- `step2-imagegen-action-near-board-c2.png`
  - 优点：
    - 动作条与当前房间关系最近
    - 当前行动节奏最直接
    - 已经摆脱了上一版 `C` 的说明卡和拼贴感
  - 问题：
    - 动作条存在感仍偏强
    - 整体平衡性仍稍弱于 `B2`
- `step2-imagegen-action-near-board-c3.png`
  - 优点：
    - 比 `C2` 更自然，动作条更像牌桌机关件
    - 当前房间到动作条的视线关系最直接
    - 侧边信息被压得更轻，不再像功能面板
  - 问题：
    - 仍然是一条强调“操作贴近主棋盘”的激进方向，不如 `B3` 稳

- 当前推荐顺序：
  1. `step2-imagegen-balanced-b10.png`
  2. `step2-imagegen-material-first-a4.png`
  3. `step2-imagegen-action-near-board-c3.png`
