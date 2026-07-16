# merge 冲突/混合审计记录（2026-07-16）

## 背景

- 目标分支：`main`
- 合并来源：`origin/main`
- 触发命令：`git merge origin/main`
- merge commit：`fb14b60583d0aa04bbdb545fdd221f3ac7259382`
- 父1（本地）：`c2662edb2f09a9aa285eda5b7f73d1b09755c903`
- 父2（远端）：`ace7b8a87acf5a188e681b1b6da78ff71ebd6ffa`
- 说明：本次真实文本冲突文件为 `package.json`；pre-push 的 merge audit 同时识别到 7 个双侧重叠改动文件，因此补充人工裁决说明。

## 命中文件

本次 merge audit 命中的双侧重叠文件共 7 个：

1. `android/app/src/main/java/top/easyboardgame/app/GamePackageForegroundRuntime.java`
2. `android/app/src/test/java/top/easyboardgame/app/GamePackageForegroundRuntimeTest.java`
3. `package.json`
4. `src/core/AssetLoader.ts`
5. `src/core/__tests__/AssetLoader.preload.test.ts`
6. `src/features/mobile-packages/packageManagerService.ts`
7. `src/lib/__tests__/packageManagerServiceSharedAudio.test.ts`

## 实际裁决

### `package.json`

- 审计结果：`混合结果`
- 裁决：以远端 `origin/main` 为底，保留远端发布版本号，同时补回本地新增审计脚本。
- 合并要点：
  - 保留远端 `version: 0.6.8`。
  - 保留远端 `androidVersionCode: 571`。
  - 保留本地 `audit:evidence:selfcheck`，继续指向 `node scripts/verify/audit-evidence-completeness.mjs`。
- 风险点：
  - 如果丢掉远端版本号，会回退已经发布的 Android 版本标识。
  - 如果丢掉本地脚本，会让审计 evidence 自检入口从项目脚本里消失。

### 其余 6 个重叠文件

- 审计结果：`与两侧相同`
- 裁决：无需人工二选一；merge 结果与父1、父2在这些文件上的最终内容一致。
- 文件范围：
  - Android 前台游戏包运行时与测试。
  - `AssetLoader` 预加载链路与测试。
  - 移动包管理服务与共享音频测试。

## 验证

- `node scripts/verify/merge-conflict-audit.mjs fb14b60583d0aa04bbdb545fdd221f3ac7259382 --fail-on-single-side`
  - 结果：命中 7 个双侧重叠文件，`package.json` 为混合结果，其余 6 个与两侧相同。
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log('json ok')"`
  - 结果：`package.json` 与 `package-lock.json` 解析通过。
- `git diff --cached --check`
  - 结果：合并提交前暂存区格式检查通过。
- `git commit -m "合并 origin/main 并保留审计脚本"`
  - 结果：pre-commit hook 中 `lint-staged` 与 `npm run typecheck` 通过。

## 结果

- merge commit：`fb14b60583d0aa04bbdb545fdd221f3ac7259382`
- 冲突汇报补记：本文档
- 推送目标：`origin/main`
