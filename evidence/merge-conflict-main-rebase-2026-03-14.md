# 冲突解决汇报：main rebase 2026-03-14

## 1. 背景
- base: `origin/main` @ `db70ff08`
- head: `main` @ `4401f88f`
- 触发命令: `git pull --rebase origin main`

## 2. 冲突文件
- `android/app/src/main/java/top/easyboardgame/app/MainActivity.java`
- `docs/deploy.md`

## 3. 解决策略

### `android/app/src/main/java/top/easyboardgame/app/MainActivity.java`
- 策略：保留两边改动
- 合并要点：
  - 保留远端已存在的 `bg-shell-app-hidden` / `bg-shell-app-visible` 生命周期事件派发逻辑
  - 保留本地新增的游戏页方向切换、状态栏隐藏、方向映射读取逻辑
- 原因：两边修改的关注点不同，分别解决前后台音频控制与 Android 壳横竖屏体验，不能二选一

### `docs/deploy.md`
- 策略：保留两边改动
- 合并要点：
  - 保留 Android `remote` 纯壳构建与方向控制说明
  - 保留 Android 壳进入后台后主动通知 H5 停止 BGM 的说明
- 原因：文档描述的是同一套 Android 壳行为，合并后信息才完整

## 4. 风险与验证
- 风险点：
  - `MainActivity` 同时引入生命周期事件和方向轮询后，可能出现原生层行为互相影响
  - 文档与实际壳行为可能再次漂移
- 验证命令：
  - `./gradlew.bat :app:compileDebugJavaWithJavac`
  - `npm run typecheck`
- 验证结果：
  - Android Java 编译通过
  - TypeScript 类型检查通过

## 5. 最终提交信息
- rebase 后提交: `c5390eb6`
- push 目标分支: `origin/main`
