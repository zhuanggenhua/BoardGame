# 大杀四方模仿者下半部叠图 E2E 验证

日期：2026-06-06

## 范围

- 目标：模仿者（`shapeshifters_copycat`）复制目标后，不再整张换成目标卡面。
- 验证点：
  1. 场上卡面仍保留模仿者自己的上半部与本体标题。
  2. 目标卡图只叠加到模仿者卡面的下半部。
  3. 放大查看时也保持同样的“上半部自己 + 下半部目标”表现。

## 执行命令

```powershell
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
npm run test:e2e:ci:file -- e2e/smashup/smashup-copycat-bottom-overlay.e2e.ts "在线对局：模仿者复制后应保留自己本体并叠加目标卡图下半部"
```

结果：`1 passed`

## 截图证据

### 1. 真实页面主截图

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-copycat-bottom-overlay.e2e\在线对局：模仿者复制后应保留自己本体并叠加目标卡图下半部\smashup-copycat-board-fullpage.png`

肉眼观察：

- 这是在线对局真实棋盘页，不是临时预览页；能看到回合条、基地、计分板、结束回合按钮和场上随从。
- 左侧基地下方有两张随从并排：左边是模仿者，右边是 Furious George 参考卡。
- 左侧模仿者卡面顶部仍然写着 `Copycat / 模仿者`，人物也还是模仿者自己的本体图，没有整张变成目标卡。
- 模仿者卡面下半部与右侧 Furious George 的下半部一致，都是同一套黄色香蕉区域和同一段持续文本，说明只把目标卡图下半部叠到了模仿者下面。

验收结论：

- 达到“真实页面链路截图”的要求。
- 达到“场上卡面保留自己本体，只叠目标下半部”的要求。

### 2. 场上模仿者近景

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-copycat-bottom-overlay.e2e\在线对局：模仿者复制后应保留自己本体并叠加目标卡图下半部\smashup-copycat-board-closeup.png`

肉眼观察：

- 近景里左上角标题仍是 `Copycat / 模仿者`，顶部人物图也仍是模仿者自己。
- 从卡面中线以下开始，已经换成目标卡的黄色香蕉下半区和目标文本。
- 这说明换图边界只发生在下半部，没有把目标整张盖上来。

验收结论：

- 达到“自己本体保留在上半部”的要求。
- 达到“目标卡图只叠在下半部”的要求。

### 3. 目标卡参考近景

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-copycat-bottom-overlay.e2e\在线对局：模仿者复制后应保留自己本体并叠加目标卡图下半部\smashup-george-reference-closeup.png`

肉眼观察：

- 参考卡标题是 `Furious George`，整张是目标卡本体。
- 它的下半部黄色香蕉区域和文本排版，与模仿者近景中的下半部一致。
- 这张图用于对照证明：模仿者吃到的是目标卡的下半区，而不是随便一张新贴图。

验收结论：

- 达到“可与真实目标卡对照”的要求。

### 4. 放大查看主截图

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-copycat-bottom-overlay.e2e\在线对局：模仿者复制后应保留自己本体并叠加目标卡图下半部\smashup-copycat-magnify-page.png`

肉眼观察：

- 真实页面中间打开了放大查看层，背景仍是同一个在线对局棋盘。
- 放大卡面顶部仍是 `Copycat / 模仿者` 的标题和本体人物。
- 放大卡面底部依旧是目标卡的黄色香蕉下半区，没有回退成整张目标卡。

验收结论：

- 达到“放大查看也保持同一视觉语义”的要求。

### 5. 放大查看近景

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup\smashup-copycat-bottom-overlay.e2e\在线对局：模仿者复制后应保留自己本体并叠加目标卡图下半部\smashup-copycat-magnify-closeup.png`

肉眼观察：

- 上半部清楚可见 `Copycat / 模仿者` 和模仿者角色本体。
- 下半部清楚可见目标卡的黄色香蕉区和目标文本。
- 上下拼接边界稳定，没有出现整张换图、下半部缺失或放大后又恢复旧行为的问题。

验收结论：

- 达到“放大态清晰可辨认”的要求。
- 达到“同一实现同时覆盖场上卡面和放大查看”的要求。

## 代码与测试落点

- 代码：
  - `src/games/smashup/ui/SmashUpCardRenderer.tsx`
  - `src/games/smashup/ui/BaseZone.tsx`
  - `src/games/smashup/ui/CardMagnifyOverlay.tsx`
  - `src/games/smashup/Board.tsx`
- 测试：
  - `src/games/smashup/__tests__/ui-interaction-manual.test.ts`
  - `e2e/smashup/smashup-copycat-bottom-overlay.e2e.ts`
