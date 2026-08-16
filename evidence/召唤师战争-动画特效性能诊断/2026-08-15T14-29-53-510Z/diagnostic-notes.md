# 召唤师战争动画/特效性能诊断记录

## 本轮目标

- 问题对象：召唤师战争游戏过程中的动画、特效卡顿，重点是召唤、远程攻击、伤害反馈、销毁碎裂和整屏震动。
- 真相来源：用户描述、项目性能规范、现有动画/FX 源码、E2E runtime 状态、临时性能探针。
- 目标入口/环境：本地 Playwright/E2E runtime 创建召唤师战争在线对局；探针尽量关闭 Playwright webdriver 降级，以采集完整特效。
- 验收口径：同一操作窗口内采集 Chrome trace、RAF 帧间隔、Long Task、DOM/CSS inventory；修复后必须用同入口复测。

## 本轮没有形成有效 trace 的原因

- 第一次标准 runner 误附着到 shared runtime，但前端端口 `6174` 拒绝连接，页面未打开，未产生性能数据。
- 第二次 isolated runner 超过 5 分钟未返回；doctor 随后显示其它游戏 runtime 占用，不能判定为召唤师战争 trace 完成。
- 第三次尝试复用现有服务时，前端曾可访问，但游戏服端口在采样期间拒绝连接，阵营选择停在 P2 未选择，未进入游戏内动画窗口。
- 第四次在 E2E 窗口短暂空闲后重跑 isolated，启动前又有其它游戏 runtime 切入；随后附着 shared 服务时，前端加载 `src/App.tsx` 发生 `ERR_CONNECTION_RESET`，跳转召唤师战争 match route 时端口 `6174` 拒绝连接。
- 当前 doctor 证据显示其它游戏 E2E 任务占用全局预算，且 runtime 曾进入 `active-unhealthy`；继续启动新浏览器/服务会增加机器负载并污染性能结果。
- 结论：当前只完成了采样探针准备和源码热点定位，不能称为根因定位或修复验收。

## 候选热点

1. 棋盘格子高亮会在每个格子上反复计算多组可选位置，并使用 `transition-colors` 改颜色/边框；如果 Performance 红色角标集中在 `border-color` / 样式重算，这里是第一候选。
2. 棋子和建筑卡本体使用 Framer Motion `layout="position"`，同时叠加 `box-shadow`、ring、hover shadow 与 `transition-[background-color,box-shadow]`；攻击、移动、销毁同帧时可能放大重排/绘制成本。
3. 召唤特效是 WebGL shader + Canvas 粒子 + fixed 暗角遮罩三层组合；召唤窗口应重点看 `FireAnimationFrame`、GPU/Canvas 绘制和长帧。
4. 远程攻击 `ConeBlast` 每帧 Canvas 绘制飞行头部、尾迹粒子、命中粒子和扩散环；远程击杀窗口应重点看 Canvas RAF 成本。
5. 销毁碎裂 `ShatterEffect` 会加载/绘制卡图到离屏 canvas，再切片飞散；击杀窗口应重点看图片加载/解码、canvas drawImage 和长任务。
6. FX 预算现在按“同时活跃高成本特效数量”降级；它不能覆盖短时间连续触发的召唤、气浪、伤害闪光、碎裂和震动叠加。

## 下一次 trace 验证点

- 召唤窗口：如果召唤是主因，`summon-full-fx` trace 会出现较高 `FireAnimationFrame` / canvas / shader 相关成本，RAF p95 和最大帧间隔明显抬高。
- 远程击杀窗口：如果气浪/伤害/碎裂叠加是主因，`ranged-kill-full-fx` trace 会在气浪到达和销毁启动附近出现长帧。
- CSS 高亮窗口：如果 `border-color`/阴影是主因，trace 文本命中和耗时会集中在 `UpdateLayoutTree`、`Paint`、`border-*color`、`box-shadow`。
- 预算验证：A/B 关闭或降低单个候选特效后，只有对应窗口的长帧下降，才能把它升级为根因。

## 临时探针

- 探针副本：`summonerwars-fx-performance-probe.e2e.ts`
- 该探针是诊断工具，不应长期放在 `e2e/` 正式测试目录。
