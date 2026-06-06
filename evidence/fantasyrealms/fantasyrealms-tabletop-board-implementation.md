# 幻想国度实体牌桌 Board 前端实现证据

> 日期：`2026-06-05`
>
> 范围：`src/games/fantasyrealms/Board.tsx`

## 本轮结论

- 已停止多风格换皮，前端实现固定为 **实体牌桌** 风格。
- 公共牌库按最大 `7` 张全量横排显示，不再折叠成小扇形或牌堆。
- 手牌按 `7 / 7` 全量横排显示，保留当前选中牌高亮。
- 焦点牌与计分纸放在中区；抽牌来源和终局进度常驻但不遮挡公共牌。
- 使用真实 `fantasyrealms` atlas 与牌背资源渲染。

## 证据路径

- React Board：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\src\games\fantasyrealms\Board.tsx`
- 设计规范：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\design-system\games\fantasyrealms.md`
- 预览入口：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-board-preview.html`
- 预览打包：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-board-preview.js`
- 验收截图：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-board-tabletop-implementation-http.png`
- 同图副本：`D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\evidence\fantasyrealms\fantasyrealms-board-tabletop-implementation.png`

## 校验

- `npx eslint src/games/fantasyrealms/Board.tsx`：通过。
- `npx esbuild evidence/fantasyrealms/fantasyrealms-board-preview.tsx --bundle --format=iife --global-name=FantasyRealmsPreview --outfile=evidence/fantasyrealms/fantasyrealms-board-preview.js --jsx=automatic`：通过。
- 全量 `npx tsc --noEmit -p tsconfig.app.json --pretty false`：未通过，失败来自当前工作树既有跨模块类型错误；本轮新增 Board 未出现在错误列表中。

## 视觉判定

`fantasyrealms-board-tabletop-implementation-http.png` 中可见：

- 顶部公共牌区显示 `公开牌 7 / 7`，7 张牌全部露出且没有被终局进度遮挡。
- 底部手牌区显示 `7 / 7`，7 张手牌全部露出。
- 左侧抽牌源、右侧终局进度、中区焦点牌和计分纸均在同一实体牌桌构图内。
