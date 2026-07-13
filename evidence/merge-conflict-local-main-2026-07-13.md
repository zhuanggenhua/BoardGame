# 本地提交并入 origin/main 冲突裁决记录（2026-07-13）

## 1. 合并对象

- merge commit：`0039237e0931641765bb9584cc5fef6abd868b38`
- 父 1：`13805382a8f22ed16d9341b5c4a6926b11dd8a32`（本地“收口多游戏体验与 OTA 发布保护”提交）
- 父 2：`ca7ccd15ee5fa5a1100c9c109f28c92a3957a45d`（远端 Smash Up POD 更新）
- 合并目的：在推送本地全部改动前，把远端 `origin/main` 已有的 Smash Up POD 提交并入当前 `main`。

## 2. 真实冲突文件

| 文件 | 冲突内容 | 裁决 |
| --- | --- | --- |
| `src/games/summonerwars/ui/StatusBanners.tsx` | 双方都把能力提示兜底文案抽到 `statusBannerText.ts`，冲突只发生在 `getAbilityModeBannerFallbackText` 导入位置：父 1 已在模式类型导入前导入一次，父 2 在模式类型导入后也插入同一个导入。 | 保留父 1 结果，删除冲突标记和重复导入。 |

## 3. 为什么可以等于父 1

- 这是重复导入位置冲突，不是业务逻辑冲突。
- 父 1 和父 2 对 `StatusBanners.tsx` 的现实意图一致：删除本文件内的 `getAbilityModeBannerFallbackText` 实现，改为从 `./statusBannerText` 读取。
- 父 1 结果已经包含唯一有效导入：`import { getAbilityModeBannerFallbackText } from './statusBannerText';`。
- 父 2 在该文件里的独有差异只是把同一个导入放到另一处；保留父 1 不会丢失能力提示文案、按钮逻辑或任一状态横幅分支。

## 4. 双边保留结果

- 远端 Smash Up POD 的新增资源、卡牌数据、能力、测试、本地化与审计文档全部随 merge commit 保留。
- 远端召唤师战争 `boardGridGeometry.ts`、`statusBannerText.ts` 等拆分结果也随 merge commit 保留。
- 本地召唤师战争骰子揭示完成后启动攻击动画、特效预算降级、OTA 发布保护、山屋惊魂审计证据等改动继续保留。

## 5. 验证

- 合并后执行 `npm run typecheck -- --pretty false` 通过。
- merge commit 提交钩子中的 lint-staged 与 typecheck 均通过。
