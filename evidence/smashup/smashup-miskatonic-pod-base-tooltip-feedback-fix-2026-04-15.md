# 大杀四方反馈修复：POD 版米斯卡塔尼克大学基地悬浮文案与卡图文本对齐（2026-04-15）

- 反馈 ID：`69dbb6ebe92e3f88b78cec3a`
- 结论：**已修复。基地战场卡面悬浮文案与放大预览，都会跟随 POD 版 `base_miskatonic_university_base_pod` 文本，不再错误显示原版基地说明。**

## 反馈要点

用户反馈：`POD版的米斯卡塔尼克大学这个基地的中文悬浮的翻译和他这个图的文本没对应上。`

问题本质不是图片资源丢失，而是 **UI 仍用原始基地 defId `base_miskatonic_university_base` 取文案/预览**，没有在显示层切到 POD 变体 defId。

## 本轮修复

修改文件：

- `src/games/smashup/ui/BaseZone.tsx`
- `src/games/smashup/ui/CardMagnifyOverlay.tsx`

修复方式：

- 基地战场卡面显示时，先根据 `selectedFactions` 解析 `resolvedBaseDefId`
- 若当前选中的派系为 POD 版米斯卡塔尼克，则 UI 改为使用 `base_miskatonic_university_base_pod`
- 放大预览同样使用解析后的 POD defId 取 `CardPreview / 名称 / abilityText`

## 执行命令

```bash
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "POD 版米斯卡塔尼克大学：基地悬浮文案和放大预览都应跟随 POD 版本文本"
```

结果：通过。

## 关键截图与结论

### 1）战场基地悬浮文案

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\POD-版米斯卡塔尼克大学：基地悬浮文案和放大预览都应跟随-POD-版本文本\smashup-miskatonic-pod-base-hover.png`
- 我实际看到：基地卡面上悬浮出来的中文正文是 **“每回合一次，在你于此打出一个随从后，你可以抽两张疯狂卡，或从你的手牌弃置一张疯狂卡来额外打出一张战术。”**，对应 POD 版米斯卡塔尼克大学；不是旧版“在这个基地计分后...”那段原版基地说明。
- 判定：达到“战场悬浮文案与 POD 卡图文本一致”的验收标准。

### 2）放大预览

- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-base-minion-selection.e2e\POD-版米斯卡塔尼克大学：基地悬浮文案和放大预览都应跟随-POD-版本文本\smashup-miskatonic-pod-base-magnify.png`
- 我实际看到：放大预览中的基地卡同样显示 POD 版中文正文，而不是原版基地说明；说明放大层不再和战场层各用一套 defId。
- 判定：达到“放大预览与战场卡面使用同一 POD 版本文本”的验收标准。

## 断言补充

同一条 E2E 中同时断言了：

- POD 文本 **可见**
- 原版旧文本 **不存在**

具体对照：

- 正确 POD 文本：`每回合一次，在你于此打出一个随从后，你可以抽两张疯狂卡，或从你的手牌弃置一张疯狂卡来额外打出一张战术。`
- 被排除的旧文本：`在这个基地计分后，冠军可以搜寻他的手牌和弃牌堆中任意数量的疯狂卡，然后返回到疯狂卡牌库。`

## 收口说明

这条反馈现在可以按“已修复并验证”收口：

- 战场基地 hover 文案已切到 POD 版 defId
- 放大预览也已切到 POD 版 defId
- 同一条 E2E 同时覆盖了战场层与放大层两处用户可见入口
