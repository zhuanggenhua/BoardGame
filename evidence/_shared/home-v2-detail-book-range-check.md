# Home V2 详情页书本范围校准

日期：2026-04-06

## 本轮目标

- 先把首页 V2 的书本内容范围定准
- 优先确保详情页内容全部落在书页米色纸面内
- 不再靠组件内大 `padding` 猜位置，而是直接按书本壳素材回填 scene zone

## 关键依据

书本壳素材：

- `D:\gongzuo\webgame\BoardGame-wt-home-v2\public\assets\common\images\home-v2\book-idle\1.png`

对素材做像素测量后，得到：

- 整体非透明 bbox：`(118, 181) -> (778, 596)`
- 左页纸面主填充区约为：`x=149..428, y=202..556`
- 右页纸面主填充区约为：`x=468..758, y=202..556`

因此本轮把 scene 区域回填为：

- `left_page`: `x=149, y=202, width=280, height=355`
- `right_page`: `x=468, y=202, width=280, height=355`
- `detail_left_inner`: `x=160, y=218, width=244, height=318`
- `detail_right_inner`: `x=489, y=218, width=244, height=318`

## 修改文件

- `src/ui-scenes/home-v2/home-v2.ui.yaml`
- `src/ui-scenes/home-v2/home-v2.compiled.json`
- `src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts`
- `src/components/home-v2/GameDetails.tsx`
- `src/ugc/runtime/ui-scene/UISceneRenderer.tsx`

## 验证命令

```bash
npm run typecheck
npm run test:e2e:ci:file -- e2e/_shared/lobby.e2e.ts "Home v2 草稿在移动横屏下显示全屏背景与逐帧书本壳"
```

## 截图证据

详情页：

- `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\evidence-screenshots\_shared\lobby.e2e\Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳\lobby-home-v2-draft-detail-mobile.png`

总览页：

- `D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\evidence-screenshots\_shared\lobby.e2e\Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳\lobby-home-v2-draft-shell-mobile.png`

## 肉眼观察

- 详情页左侧“返回目录 / 游戏图鉴 / 书页条目 / 标题 / 概览正文”已经全部收进左页纸面内，没有再顶到书页上沿。
- 详情页右侧“对局入口 / 游戏房间 / 创建房间 / 房间告示板”已经落在右页纸面内，没有再压住右页外边框和书签。
- 左右页内容都已经离开书脊线，视觉上重新回到“纸面上的文字和入口”，不再像悬浮在书本外面的层。
- 总览页左页图标阵列也被一起拉回纸面内，顶部不再顶到书页上沿；当前主要剩余问题是内容密度和缩略图质量，不是书本范围错误。

## 本轮结论

- “先定书本范围”这一步已经完成，详情页内容范围不再建立在错误的黑边透明区上。
- 后续 detail 再做风格微调时，应只在 `detail_left_inner / detail_right_inner` 内做排版，不要再回头改整页 zone。
