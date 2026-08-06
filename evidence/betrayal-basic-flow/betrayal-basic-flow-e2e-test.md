# 山屋惊魂基本流程 E2E 截图验收

## 命令

- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/basic-flow.e2e.ts`
- 结果：`1 passed`

## 截图核对

### 01 角色确认前

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-basic-flow\01-山屋惊魂-基本流程-角色确认前.png`
- 对应设计稿：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\docs\games\betrayal\design\generated\betrayal-character-select-style-b.png`
- 实际看到：角色选择页显示 6 个真实探索者牌，当前选择为杰登·琼斯，底部 `确认` 按钮清楚可见。
- 实际看到：玩家槽仍处于 `0/3`，说明这张图是确认前，不是已进入运行时后的补拍。
- 实际看到：左侧已经回到“大选中卡 + 属性/能力说明”的关系，中央是 5 张待选牌阵，底部席位条里 P1 也会显示“已选但待确认”的当前探索者，不再是空槽。
- 验收结论：基本流程的起点可操作。

### 02 基本流程运行时

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-basic-flow\02-山屋惊魂-基本流程-运行时.png`
- 对应设计稿：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\docs\games\betrayal\design\generated\betrayal-runtime-prehaunt-board-v4.png`
- 实际看到：通过真实点击 `确认` 和 `开始` 后进入恶兆前运行时，不是状态注入直接跳过。
- 实际看到：左侧探索者区仍是同一块连贯板件，但持有区已改成 `物品 / 预兆` 直接分组，不再把不同类型混成一排。
- 实际看到：中央房间簇、右侧牌堆/弃牌、底部五个动作和剧本入口都可见。
- 实际看到：房间牌使用原始图集裁剪，首屏没有上下压住，也没有异常黄色上边框。
- 实际看到：底部动作条已经收成贴桌面的动作牌，不再像一整块宽面板。
- 实际看到：右侧队友常驻态仍在功能按钮下方，没有再掉到底部动作条下面。
- 实际看到：顶部旧齿轮入口已经去掉，通用悬浮球仍保留在真实截图里，没有为了构图把它隐藏掉。
- 实际看到：顶部旧齿轮入口删除后，原来的右侧空 grid 占位也已经释放，顶部状态条现在是三段信息，不再留下“按钮没了但空列还在”的假删除。
- 实际看到：当前探索者 trait 危险位现在只剩一个红色致命点，不再出现双红。
- 实际看到：玩家位置已经落在房间牌上，用探索者自身真实肖像做棋子化承载；当前仓库尚未找到独立官方 figure 素材，所以这属于同对象真实素材代用，不是已接入官方独立棋子。
- 实际看到：持有区没有再显示重复的大选中卡；当前以 `物品 / 预兆` 分组呈现，点击卡牌仍会打开放大预览。
- 实际看到：手电筒命中真实物品正面图集；绳索和预兆书没有已确认正面素材，运行时诚实显示真实牌背 + 名称，没有再用无关 marker 冒充正面卡。
- 实际看到：本轮测试链如果先命中“页面没有正常显示”的保护层，会先刷新重试再继续等待 harness；这次正式通过截图不是保护页，而是真实运行时页。
- 验收结论：基本流程已跑到首个可操作运行时；但运行时整体仍是继续收敛中的实现稿，不应提前当成最终视觉定稿。

### 03 持有物放大

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-basic-flow\03-山屋惊魂-基本流程-持有物放大.png`
- 实际看到：点击持有区里的绳索后，左侧弹出放大查看层，卡牌本体按牌宽承载，没有再出现“窄卡旁边一大块空面板”的视觉空洞。
- 实际看到：绳索当前没有已确认正面素材，放大层诚实显示物品牌背 + 名称；这不是 marker 伪正面，也不是错误正面图集。
- 实际看到：放大层覆盖在牌桌上方，但没有遮住底部动作条和右侧牌堆主结构，关闭按钮清楚可见。
- 验收结论：持有物点击放大交互有真实页面截图证明，缺正面素材时的展示语义正确。

### 04 使用物品

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-basic-flow\04-山屋惊魂-基本流程-使用物品.png`
- 实际看到：真实点了 `使用`，并用的是持有区里的绳索，不是静态展示。
- 实际看到：绳索卡面左上角出现 `已用` 标记，底部 `使用` 动作也变灰，说明这次不是只亮了一下文案，而是真的锁成“本回合已用”。
- 实际看到：右上 `MOVE` 数从 `3` 变成 `4`，说明绳索的额外移动已经写进真实运行时状态。
- 验收结论：使用物品交互通过。

### 05 移动选目标

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-basic-flow\05-山屋惊魂-基本流程-移动选目标.png`
- 实际看到：真实点了 `移动` 后，已发现房间高亮成为可点击目标。
- 实际看到：底部主动作第一个已经切成 `取消移动`，说明当前确实进入了移动选目标模式，而不是普通待机态。
- 实际看到：目标绿点不再被相邻房间压住，两个可达房间都能清楚看到可点击标记。
- 验收结论：移动选目标交互通过。

### 06 移动后

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-basic-flow\06-山屋惊魂-基本流程-移动后.png`
- 实际看到：点下可达房间后，左侧位置从 `大楼梯` 变成 `二层平台`，不是只取消高亮。
- 实际看到：右上 `MOVE` 从 `4` 回到 `3`，说明这一步真实消耗了 1 点移动。
- 实际看到：当前房间发光点和人物所在房间都切到了 `二层平台`，证明移动不是只点亮目标，而是完成了真实位移。
- 验收结论：移动交互通过。

## 备注

- 本文件只记录基本流程 E2E，不承担第一剧本终局证明；第一剧本结算单独记录在 `evidence/betrayal-first-scenario/`。
- 当前默认首剧本已切到「木乃伊横行」；2026-07-12 及更早截图里涉及「赤红杰克归来」的描述只作为历史旧口径记录，不再作为当前基本流程验收。

## 2026-07-29 木乃伊默认剧本入口与书本式阅读复验

### 命令

- `node --max-old-space-size=8192 node_modules/eslint/bin/eslint.js src/games/betrayal/Board.tsx e2e/betrayal/basic-flow.e2e.ts`
  - 结果：通过。
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/basic-flow.e2e.ts "从角色选择确认到恶兆前运行时"`
  - 结果：`1 passed`
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/basic-flow.e2e.ts "移动端横屏角色选择包含竖向滚动、选中态和能力提示"`
  - 结果：`1 passed`

### PC 入口态

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\02a-山屋惊魂-基本流程-剧本弹窗入口.jpg`
- 实际看到：角色确认后底部“当前剧本”按钮可以打开剧本弹窗，弹窗仍保留在原角色选择布局之上，没有改动角色选择主版式。
- 实际看到：弹窗里当前剧本为「木乃伊横行」，候选总数为 7；「赤红杰克归来」显示待接入，不再被当作可运行默认剧本。
- 验收结论：基本流程入口已对齐当前默认首剧本。

### PC 书本式阅读首页

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\02b-山屋惊魂-基本流程-书本式剧本阅读首页.jpg`
- 实际看到：点击“阅读完整剧本”后先进入木乃伊公开揭示幕，再继续进入书本双页；首页包含英雄侧「敌方情报 / 胜利条件」和「驱逐木乃伊」，右页包含叛徒侧胜利条件和「木乃伊 / 战斗要诀」。
- 实际看到：开局完整阅读会显示英雄、叛徒、怪物和结局分册；作祟后的局内阅读仍按身份隐藏秘密页。
- 验收结论：实现已消费木乃伊规则书正文，不再把旧杰克摘要当作基本流程。

### PC 书本式阅读末页

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\02d-山屋惊魂-基本流程-书本式剧本阅读末页.jpg`
- 实际看到：通过“下一页”真实翻到末页，末页显示英雄结局和叛徒结局，而不是旧「胜负判定 / 杰克之灵」内容。
- 实际看到：末页“下一页”禁用，“上一页”仍可用，证明不是滚动到底部，而是翻页状态收口。
- 验收结论：PC 端木乃伊完整阅读链路通过。

### 移动端横屏入口态

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\09a-山屋惊魂-移动端横屏-剧本弹窗入口.jpg`
- 实际看到：移动横屏角色选择仍保持原有布局框架，剧本弹窗作为前台层打开；弹窗没有把主布局重做成另一套页面。
- 实际看到：当前剧本为「木乃伊横行」，阅读入口和确认入口在横屏下可见。
- 验收结论：移动横屏有剧本选择步骤入口，且未牺牲原角色选择布局。

### 移动端横屏书本式阅读首页

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\09b-山屋惊魂-移动端横屏-书本式剧本阅读首页.jpg`
- 实际看到：阅读层在移动横屏下仍是书本双页，英雄侧和叛徒侧正文都可见；较长的官方正文可在页内滚动到达底部，没有为了适配一屏而删减正文。
- 实际看到：阅读层通过 HUD 前台层承载，右下全局“离开”悬浮入口不再拦截“下一页”按钮。
- 验收结论：移动端点击翻页可用，阅读 UI 不再被全局悬浮按钮挡住。

### 移动端横屏书本式阅读末页

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\09d-山屋惊魂-移动端横屏-书本式剧本阅读末页.jpg`
- 实际看到：移动横屏通过翻页到达木乃伊结局页，末页显示英雄结局和叛徒结局。
- 实际看到：末页布局仍保持书本纸面和页脚控制，没有退化成长滚动内容。
- 验收结论：移动端横屏木乃伊完整阅读链路通过。

## 2026-07-12 剧本入口与书本式阅读补验收（历史旧杰克口径）

### 核验拼图

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\zz-书本式剧本阅读最终核验拼图.jpg`
- 实际看到：PC 与移动横屏的入口、首页、末页 6 张图同时对读，均为真实页面截图产物；书本样式、翻页按钮、末页内容和当前剧本入口都能对应起来。
- 验收结论：本轮“完整剧本需要沉浸式书本阅读”的 UI 目标已通过截图核验。

## 2026-07-18 队友详情、token 对应与换行动者视角补验收

### 命令

- `npm run test:e2e:ci:file -- e2e/betrayal/basic-flow.e2e.ts "真实页面队友详情与地图token图像一致，换行动者不自动跟踪视角"`
  - 结果：`1 passed`
- `npx eslint src/pages/TestMatchRoom.tsx src/pages/LocalMatchRoom.tsx src/games/betrayal/Board.tsx e2e/betrayal/basic-flow.e2e.ts e2e/betrayal/event-choice-coverage.e2e.ts`
  - 结果：`0 errors`；仍有既有 warning，未阻断。

### 队友面板详情不切视角

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\10-山屋惊魂-队友面板详情不切视角.jpg`
- 实际看到：点击右侧队友面板后打开探索者详情，背景仍停在当前玩家所在的一层牌桌，没有自动跳到地下室。
- 实际看到：详情里的探索者头像和详情下方小 token 为同一探索者素材；测试同时断言面板 token 的 `data-token-asset` 与详情 token 一致。
- 验收结论：队友面板点击现在是“查看详情”，不是“强制切视角/跟踪队友位置”。

### 地图 token 详情图像一致

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\11-山屋惊魂-地图token详情图像一致.jpg`
- 实际看到：手动切到上层后，点击房间里的队友 token 打开详情；背景仍停在上层，没有被详情弹窗重置回当前行动者楼层。
- 实际看到：地图 token、详情头像和详情小 token 指向同一探索者，角色面板与地图 token 的对应关系可直接核对。
- 验收结论：地图 token 与角色详情承接一致，且详情打开不改变玩家正在查看的楼层。

### 换行动者不自动跟踪视角

- 路径：`D:\gongzuo\webgame\BoardGame\evidence\betrayal-basic-flow\12-山屋惊魂-换行动者不自动跟踪视角.jpg`
- 实际看到：点击“结束回合”后当前回合切到丽贝卡·艾伦博士，但地图仍显示上层起始点，没有自动跳到她所在的地下室起始点。
- 实际看到：右侧队友列表里地下室队友仍可见，但主地图没有被另一位行动者强行接管；玩家保留自己刚刚查看的上层上下文。
- 验收结论：其他玩家行动时不再提前跟踪/抢走当前视角；这次修复直接覆盖用户指出的“别人行动不需要跟踪视角”问题。
