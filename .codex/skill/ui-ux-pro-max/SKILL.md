---
name: ui-ux-pro-max
description: "BoardGame 的 UI/UX overlay。先使用全局 ui-ux-pro-max 获取通用设计系统/风格建议，再叠加本项目的双端、游戏 UI、目标稿实现与验收门禁。这里不重复维护通用 UI/UX 知识库正文。"
---

# BoardGame UI/UX Overlay

## 作用

这不是全局 `ui-ux-pro-max` 的副本，而是 **BoardGame 对该全局 skill 的补充层**。

使用顺序固定为：

1. 先使用全局 `ui-ux-pro-max`
2. 再回到本文件叠加 BoardGame 规则

## 什么时候用

- 新页面 / 新组件 / 新游戏 UI
- 共享 UI 重排、布局重构、视觉层级重做
- 需要把通用 UI/UX 建议收敛到 BoardGame 的实现口径

## 先做什么

1. 先看 `docs/ai-rules/ui-ux.md`
2. 再按需要看：
   - `design-system/game-ui/MASTER.md`
   - `design-system/game-ui/source-families.md`
   - `design-system/styles/*.md`
   - `design-system/games/<gameId>.md`
   - 若这轮会改 prompt / waiting / 手牌区 / 右侧 rail / HUD 主选择层，先专门核对 `主交互槽位五联单`、`来源家族`、`双主焦点`、`主交互槽位前中后不漂移` 这些门禁
3. 若是 AI 设计稿落地，补读 `docs/ai-rules/generated-design-implementation.md`
4. 若是新游戏或棋盘 UI 生图，改走 `.codex/skill/boardgame-ui-imagegen/SKILL.md`
5. 若是游戏移动端适配，改走 `.codex/skill/adapt-game-mobile/SKILL.md`

## 本项目补充规则

- 本项目默认是 **双端并行**，不是纯桌面站点
- 游戏页、共享壳层、App WebView、手机横屏不能套用通用“mobile-first 小网页”思路
- 固定构图游戏界面默认 `PC 权威 + 移动端条件覆盖`
- 如果用户明确说“布局不变 / 位置不变 / 排名改回去 / 只要徽章或动画”，默认只允许改现有槽位内的装饰、颜色、图标、数值动画；禁止移动牌桌、中央牌区、手牌区、排名面板或主按钮锚点。若确实必须动布局，先停下说明原因并等确认。
- 只要本轮会改变用户如何点击、确认、取消、选目标、弃牌、支付、推进或等待，就必须先写 `主交互槽位五联单`：`主交互对象 / 固定槽位 / 让位顺序 / 禁止侵入对象 / 来源家族`
- `来源家族` 不能只写“参考成熟游戏”，必须点名到真实文件或截图。当前项目内优先参考的大类包括：`src/games/smashup/ui/HandArea.tsx`、`src/games/smashup/ui/PromptOverlay.tsx`、`src/games/smashup/ui/MeFirstOverlay.tsx`、`src/games/smashup/Board.tsx` 中 `activePromptSurface`
- 临时 UI、`waiting`、`hint`、`confirm strip`、流程横幅默认不得侵入底部手牌槽位、右侧动作槽位、中央主选择壳层；只要把主交互入口挤走、压窄或做成第二组并列主入口，就直接判失败
- 生成稿落地时，目标稿是语义和比例真相源；断言通过不能替代看图
- 只要改动进入共享层或游戏主界面，就必须按项目 E2E 截图规则验收
- 本项目常同时存在多 `worktree`、多 dev server、`classic/book` 并存入口；任何截图验收前，默认先锁 `真实 URL / 真实端口 / 真实进程命令行 / 实际模块文件路径`，没锁清就不要基于截图下结论
- 游戏 UI、书本双页、牌桌、棋盘、HUD、主选择层默认先交 `整屏整体图`；局部按钮、徽章、token、角标近景只能做辅证，不能单独当主交付
- 计分、结算、翻牌这类过程动画不能只交最终静态图；验收图至少要有一张过程中的整屏截图和一张最终态整屏截图，证明“过程存在”且“布局未漂移”
- 这类整屏验收图必须至少能回答三件事：主交互槽位在交互前/中/后是否漂移，临时 UI 是否侵入主槽位，页面是否出现双主焦点。答不清就不能宣称“UI 已友好”
- BoardGame 当前大量使用 `Tailwind + lucide-react`；凡是图标贴文字的按钮、徽章、菜单项、统计项，默认先用 `inline-flex items-center gap-*`，文本优先收紧 `leading-none/tight`，图标优先用 `h-[1em] w-[1em] shrink-0` 跟随字号，不要一上来先写 `translate-y-*` 这类魔法位移
- 涉及相对摆位口令时，`同一排`、`左侧`、`右侧`、`页码左侧` 这类词，默认解释为“与被参照元素共用同一条水平带/基线关系”，不是只满足“在同一个象限”或“也在左下区域”
- 当用户同时给出 `左下` 与 `同一排` 时，优先保留 `同一排` 的锚点语义：控件应留在左页下部，但必须贴合底部分页/账本行的同轴关系，不能再落到页脚边缘角落
- 任何带截图交付的 UI 调整，在向用户汇报“已完成/请验收”前，必须先由 agent 自己复看最新截图；只要截图仍明显违背用户口语化要求（例如“不要居中”“要在书本里”“同一排”），就不得先交给用户验收，必须继续修

## 不该放在这里的内容

- 通用配色库、通用字体库、通用组件样例正文
- 与本仓库无关的 SaaS / 电商 / 落地页套路
- 整份复制全局 `ui-ux-pro-max` 正文

## 命令与资料

若需要全局设计系统检索或脚本示例，回到全局 `ui-ux-pro-max` 读取其原始说明与脚本入口，不在本项目重复抄一份。
