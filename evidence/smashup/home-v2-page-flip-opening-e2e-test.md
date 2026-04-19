# Home V2 翻页方向与打开动画 E2E 证据

## 范围

- 首页 V2 书本壳翻页方向反转
- 首页 V2 冷进入时打开动画重播
- 首页 V2 从后台回前台时，只要仍在主页而非游戏界面，就重播打开动画
- 首页 V2 从概览进入详情、再返回目录的稳态确认
- 逐帧动画首帧闪烁修复回归确认

## 自动化验证

- 单测：`node scripts/infra/vitest-cli-safe.mjs run src/ugc/__tests__/runtime.test.ts --configLoader native`
- E2E：`npm run test:e2e:ci:file -- lobby.e2e.ts "Home v2 草稿在移动横屏下显示全屏背景与逐帧书本壳"`

结果：

- `src/ugc/__tests__/runtime.test.ts` 14/14 通过
- `e2e/_shared/lobby.e2e.ts` 指定用例通过，包含：
  - 首次进入首页 V2 后等待打开动画结束
  - `page.reload()` 后再次确认打开动画重播
  - 从目录进入 `smashup` 详情页
  - 从详情页模拟 `visibilitychange` 的后台 -> 前台切换
  - 前台恢复后确认打开动画重新出现，并最终回到目录页

## 截图证据

### 1. 首页稳态

截图：`test-results/evidence-screenshots/_shared/lobby.e2e/Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳/lobby-home-v2-draft-shell-mobile.png`

人工观察：

- 书本壳完整铺在横屏视口中央，没有横向溢出或被裁掉。
- 右侧书签列完整可见，说明打开动画结束后已经进入正常首页态，不是停在中间帧。
- 左页目录卡片重新出现，证明刷新后二次进入首页时，动画播完后能回到目录页稳态。
- 测试环境下部分缩略图资源未渲染成正式封面，显示为占位/损坏图标；但卡片位置、行列密度、标题排布仍可正常判断。

### 2. 详情页稳态

截图：`test-results/evidence-screenshots/_shared/lobby.e2e/Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳/lobby-home-v2-draft-detail-mobile.png`

人工观察：

- 左页已经切到 `大杀四方` 详情，顶部有“返回目录”按钮，说明目录 -> 详情链路成功落到最终页。
- 右页显示“游戏房间”和“创建房间”，说明详情态的左右页内容都已落位，不是翻页过渡中间态。
- 右侧书签仍保持可见，没有因为翻页动画出现遮挡或错层。

### 3. 返回目录稳态

截图：`test-results/evidence-screenshots/_shared/lobby.e2e/Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳/lobby-home-v2-draft-catalog-mobile.png`

人工观察：

- 返回后目录卡片再次出现，页面不是空白书页，说明详情 -> 目录链路已经完成并恢复稳态。
- 左页卡片数量与初始目录页一致，说明返回过程没有把首页内容丢失。
- 右侧书签列保持完整，未出现闪退、遮挡或跳帧后残留。

### 4. 后台回前台时的重新开书

截图：`test-results/evidence-screenshots/_shared/lobby.e2e/Home-v2-草稿在移动横屏下显示全屏背景与逐帧书本壳/lobby-home-v2-draft-resume-opening-mobile.png`

人工观察：

- 画面回到了书本刚打开时的窄书脊帧，说明不是简单保留详情页，而是真的重新播放打开动画。
- 背景桌面和右下角设置入口仍在，说明这是主页场景内的重播，而不是路由重载到别的页面。
- 这张图拍摄时测试刚从详情页触发后台 -> 前台恢复，因此可证明“不是只有概览页才会重播”，详情页也会被拉回重新开书。

## 结论

- 翻页前后两端页面都能稳定落到正确内容态。
- 首页刷新后二次进入时，打开动画会再次出现并完成。
- 首页从后台回前台时，只要当前仍在主页而不是游戏界面，打开动画也会重新出现，并最终回到目录页稳态。
- 本次“闪一下”问题的直接修复点是逐帧播放器首帧初始化与回调依赖稳定化；从 E2E 稳态结果看，修复后未再出现动画结束后丢内容或卡在空白页的问题。
- 翻页“方向已反过来”的代码证据来自 `src/ugc/runtime/ui-scene/scenes/homeV2BookScene.ts` 的资源绑定交换，并由 `src/ugc/__tests__/runtime.test.ts` 新增断言覆盖。
