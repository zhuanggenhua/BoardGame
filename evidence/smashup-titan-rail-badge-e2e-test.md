# SmashUp 泰坦轨道可用标签 E2E 证据

## 范围

- 页面：大杀四方牌库/弃牌区左下角泰坦轨道
- 场景：克苏鲁泰坦处于可通过轨道进场的可用状态
- 目标：移除卡顶横条，改为与基地可用态一致的底部标签提示，并准确表达“当前可进场/可打出”

## 执行方式

- 测试文件：`e2e/smashup-alien-terraform.e2e.ts`
- 用例名：`可视作行动打出的泰坦可通过牌库右侧泰坦栏按常规行动进场`
- 命令：

```bash
npm run test:e2e:ci:file -- e2e/smashup-alien-terraform.e2e.ts "可视作行动打出的泰坦可通过牌库右侧泰坦栏按常规行动进场"
```

## 关键截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-titan-rail\cthulhu-titan-rail-badge-ready.png`

## 肉眼观察

- 我实际看到卡面底部中央出现了一个琥珀色 `可打出` 标签，表达的是这张 set-aside 泰坦当前可以通过轨道进场，而不是能力可发动。
- 我实际看到卡面顶部没有再压一条横向色带，卡图上边缘保持完整，左下角只剩素材原本自带的 Titan 印刷元素。
- 轨道下方独立的 `泰坦` 区域标题仍在，说明这次只改了可用态提示，没有把轨道结构或标签区一起破坏。

## 验收结论

- 已达到本轮验收标准：左下角泰坦轨道的可用提示不再使用卡顶横条，改为底部 `可打出` 标签展示，且真实 E2E 场景下表现稳定。
