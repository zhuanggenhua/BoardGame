# Home V2 UI Scene 首轮落地 E2E 证据

## 范围

- worktree：`D:\gongzuo\webgame\BoardGame-wt-home-v2`
- 分支：`feat/home-v2`
- 入口：`/?homeV2Draft=1`
- 本轮目标：确认首页 v2 已迁到首个 `UI Scene` 运行时，书本壳、书签槽位、翻页热点、左右页内容区都由命名 artboard 区域驱动，且横屏草稿画面可稳定渲染。

## 本轮约束

- 页面层不再直接写：
  - 书本壳体缩放经验值
  - 书签裁切百分比
  - 左右页内容区百分比
- 当前首页 v2 的书本壳与内容层已开始统一吃 `artboard + prefab + scene nodes`。
- 额外提供了调试入口：`/?homeV2Draft=1&homeV2Debug=1`
  - 可直接在页面上查看 `safeZones / slots / hitAreas / guides`

## 验证命令

### 类型检查

```bash
npm run typecheck
```

### UGC Runtime 单测

```bash
node scripts/infra/vitest-cli-safe.mjs run src/ugc/__tests__/runtime.test.ts --configLoader native
```

### E2E

```bash
npm run test:e2e:ci:file -- e2e/_shared/lobby.e2e.ts "Home v2 草稿在移动横屏下显示全屏背景与逐帧书本壳"
```

## 证据截图

### 1. 壳体基线

- 绝对路径：`D:\gongzuo\webgame\BoardGame-wt-home-v2\test-results\evidence-screenshots\_shared\lobby.e2e\Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳\lobby-home-v2-draft-shell-mobile.png`
- 人工观察：
  - 背景已经铺满整个横屏视口，书本壳仍居中，没有横向溢出。
  - 左页“继续对局/游戏分类”内容保持在左页安全区内，没有再靠页面百分比单独写一套位置。
  - 右页游戏卡片和标题整体落在右页安全区里，说明内容区已经开始跟随 artboard 命名区域走。
  - 5 个书签按钮的点击区域已切到 artboard 命名槽位；且书签上的中文竖排文案方向已修正（去除了导致文字倒立的 180度旋转），但当前竖排文案仍然偏外缘，后续还需要继续微调字面与书签露出比例。
  - 右下角齿轮悬浮按钮和底部 `X/PRO` 浮层仍出现在画面外缘，暂时没有压住书本主体，但正式验收前仍需确认它们是否属于产品预期。
  - **最新验证**：通过本地 E2E 测试(`Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳`)再次确认，图片资源的加载阻塞和超时策略已被正确应用，在移动端横屏测试中能稳定呈现带有书本壳及全屏背景的视觉效果。

## 当前结论

- 首页 v2 已完成第一轮 `UI Scene` 底座接入，`artboard / prefab / scene node` 三层已经进入实际页面运行路径。
- 页内内容层已经开始消费命名区域：
  - 左/右页内容区 -> `safeZones`
  - 5 个书签按钮 -> `slots`
  - 左右翻页点击区 -> `hitAreas`
- 通用可复用底座已存在：
  - `src/ugc/runtime/ui-scene/types.ts`
  - `src/ugc/runtime/ui-scene/prefabs.tsx`
  - `src/ugc/runtime/ui-scene/UISceneRenderer.tsx`
  - `src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts`
- 当前剩余工作已经明确收敛到下一阶段：
  - 把书签文案和视觉态也一起收进 scene/prefab，而不是继续留在页面 JSX 中
  - 把左右页翻页交互正式接到 `hitAreas`
  - 为左右页内容块提供更通用的 scene region 容器，减少页面层自行绝对定位
  - 为 Builder 增加参考底图 UI scene 编辑模式
