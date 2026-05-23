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
   - `design-system/styles/*.md`
   - `design-system/games/<gameId>.md`
3. 若是 AI 设计稿落地，补读 `docs/ai-rules/generated-design-implementation.md`
4. 若是新游戏或棋盘 UI 生图，改走 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
5. 若是游戏移动端适配，改走 `.windsurf/skills/adapt-game-mobile/SKILL.md`

## 本项目补充规则

- 本项目默认是 **双端并行**，不是纯桌面站点
- 游戏页、共享壳层、App WebView、手机横屏不能套用通用“mobile-first 小网页”思路
- 固定构图游戏界面默认 `PC 权威 + 移动端条件覆盖`
- 生成稿落地时，目标稿是语义和比例真相源；断言通过不能替代看图
- 只要改动进入共享层或游戏主界面，就必须按项目 E2E 截图规则验收

## 不该放在这里的内容

- 通用配色库、通用字体库、通用组件样例正文
- 与本仓库无关的 SaaS / 电商 / 落地页套路
- 整份复制全局 `ui-ux-pro-max` 正文

## 命令与资料

若需要全局设计系统检索或脚本示例，回到全局 `ui-ux-pro-max` 读取其原始说明与脚本入口，不在本项目重复抄一份。
