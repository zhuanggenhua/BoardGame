# 冲突解决汇报：main 合并 origin/main

## 1. 背景

- 日期：2026-07-11
- 当前本地提交：`84075f4b34f5b1f05d10fc63f66a58cddfa6b048`（收口七大恨、山屋惊魂与移动发布链路）
- 远端目标提交：`32567865313406f08a7ea876e4b7a8b6b3968c88`（修复纸牌帮 OTA 横屏更新链路）
- 合并提交：`224ecb26e9c6bc794d42b92356efca555f15ca1c`
- 触发命令：`git merge --no-edit origin/main`
- 合并目标：把远端 `origin/main` 上的纸牌帮 OTA 横屏更新链路、SmashUp 美人鱼与希腊神话 POD 派系变更，合入当前本地收口提交后再推送。

## 2. 冲突文件

- Git 合并过程没有产生真实冲突文件。
- pre-push 门禁对 merge commit 做了双侧重叠改动审计，识别到 8 个双方都涉及的文件：
  - `.codex/skill/android-app-release/SKILL.md`
  - `.github/workflows/android-ota-publish.yml`
  - `docs/mobile-release.md`
  - `scripts/mobile/ota-publish-config.mjs`
  - `scripts/mobile/ota-publish-config.test.mjs`
  - `scripts/mobile/publish-android-ota.mjs`
  - `src/components/common/MobileOrientationGuard.tsx`
  - `src/components/common/__tests__/MobileOrientationGuard.test.tsx`

## 3. 解决策略

- 策略：接受 `ort` 自动合并结果，不手工改写冲突块。
- 原因：本次没有 `<<<<<<<`、`=======`、`>>>>>>>` 真实冲突标记；门禁审计的 8 个重叠文件均归类为“与两侧相同”，没有完全等于单边父提交、也没有需要手工裁决的混合结果。
- 对外发布链路相关文件：保留双方已经收敛一致的 Android OTA、真机验收、横屏更新与发布脚本规则。
- 移动横屏守卫相关文件：保留双方已经收敛一致的移动横屏提示组件和对应测试。

## 4. 风险与验证

### 已执行

- `git merge --no-edit origin/main`：通过，生成 merge commit `224ecb26e9c6bc794d42b92356efca555f15ca1c`。
- pre-push 门禁的 Merge conflict guard：完成 merge commit 审计，确认：
  - merge commits：1
  - 双侧重叠改动文件数：8
  - 完全等于父1：0
  - 完全等于父2：0
  - 混合结果：0
  - 与两侧相同：8

### 待执行

- 补记本审计文档后重新提交并执行 `git push`，由 pre-push 门禁重新校验 merge evidence。

## 5. 结果

- 本次合并没有真实冲突；补记文档用于满足 merge commit evidence 门禁。
- 业务风险集中在 Android OTA 发布链路与移动横屏验收说明，但自动合并结果没有单边覆盖，当前无需额外手工裁决。
