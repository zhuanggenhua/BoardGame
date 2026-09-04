---
name: deploy-after-ci
description: "BoardGame 生产更新最短路径。用于更新部署、发生产、更新线上；默认 CI 构建后直传镜像到服务器并 update-local + Android stable OTA，提 CI 时先查 Actions/Docker。"
---

# BoardGame CI 后部署

## 目标

把生产更新固定成两条命令路径，避免每次重新展开部署文档、手工拼 GitHub CLI、SSH 和 OTA 发布命令。

## 路径选择

- 用户只说“更新部署 / 部署生产 / 更新线上”：直接执行“CI 构建后直传镜像到服务器并 `update-local` + Android stable OTA”，不再让本机先拉 GHCR。
- 用户说“检查修改没问题就更新部署 / 看下改动没问题再发生产 / 检查后部署”：先按 [`git-operations`](../git-operations/SKILL.md) 审查当前改动范围，再决定是否能进入部署；不能把本地未提交改动、未推送提交或未归属脏改默认当成已经会被生产部署包含。
- 用户明确说“看 CI / CI 好了 / 查 CI / 等 CI”：先查远端 `origin/main` 对应的 Docker 镜像 CI；只有成功才执行服务器更新与 OTA。
- 用户明确说“只更新服务器 / 不发 OTA”：显式加 `-SkipOta`。
- 用户指定 tag：默认只建议用于服务器镜像更新；若同时要发 OTA，必须确认 OTA 的 git ref 与本次要发的代码一致。

## 检查后部署

“检查修改没问题就更新部署”是审查与部署的组合授权，不等于跳过改动归属判断。

1. 先审查当前仓库状态、改动统计和目标相关 diff，区分已提交、未提交、未跟踪、生成物、证据和无关在途改动。
2. 若用户要部署的是本地改动，必须先确认这些改动已经提交、推送到部署目标 ref，并且对应 CI / 镜像可回查；否则停止在部署前，说明生产仍会使用哪个远端版本。
3. 若本地存在无关或无法归属的脏改，不能为了部署把它们吞进提交、测试或发布；只能排除并说明，或等用户确认归属。
4. 静态审查、自动 hook 或必要校验发现真实问题时，先按对应 workflow 做最小修复和复验；不得用“只是要部署”绕过会影响生产结果的失败。

## 直接部署

使用本 skill 的包装脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .spec\skills\deploy-after-ci\scripts\deploy-prod.ps1
```

只更新服务器，不发 OTA：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .spec\skills\deploy-after-ci\scripts\deploy-prod.ps1 -SkipOta
```

指定 tag 且只更新服务器：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .spec\skills\deploy-after-ci\scripts\deploy-prod.ps1 -Tag v1.2.3 -SkipOta
```

脚本默认会触发 Docker workflow，CI 构建完成后直接把镜像 tar 输送到服务器并执行 `update-local`，再在本地发布 Android `stable` OTA：

```powershell
node scripts/release/deploy-and-ota.mjs --skip-wait --ota-channel stable
```

服务器部署版本以 git ref、CI run 和镜像为准，不要求修改商业产品版本。OTA 包版本在上传时决定：默认自动生成内部游标和显示发布号；需要显式商业产品版本时，通过 `-OtaExtra "--product-version <version>"` 或底层 `--ota-extra "--product-version <version>"` 传入。

其中服务器步骤默认等价于手动触发：

```powershell
gh workflow run docker-publish.yml --ref main -f stream_to_server=true -f deploy_after_stream=true -f deploy_tag=latest -f deploy_host=admin@8.148.71.102 -f remote_dir=/home/admin/BoardGame
```

只有用户明确要求“本机输送 / 不触发 CI 直传”时，才传 `-DeployMode stream`，让底层改用 `stream-images-to-server.mjs` 本机 fallback。只有用户明确要求“服务器直接拉镜像 / 不走镜像输送”时，才传 `-DeployMode remote`，让底层改用 `deploy-image.sh update` 旧链路。

## 查 CI 后部署

使用一条包装命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .spec\skills\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi
```

指定 tag：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .spec\skills\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi -Tag v1.2.3 -SkipOta
```

验证流程但不执行生产更新：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .spec\skills\deploy-after-ci\scripts\deploy-after-ci.ps1 -CheckCi -DryRun
```

CI 检查口径：

- 远端分支：`origin/main`
- GitHub 仓库：`zhuanggenhua/BoardGame`
- 必须成功的 workflow：`Build & Push Docker Images`
- 必须匹配远端 `main` 当前 SHA

若 Docker 镜像 CI 仍在运行、缺失或失败，停止，不执行部署。

## 只查 CI

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .spec\skills\deploy-after-ci\scripts\check-remote-ci.ps1
```

## 强制边界

- 不要因为本地工作区有未提交改动而阻塞 `push` 后的生产更新；生产更新只基于远端镜像。
- 不要在生产机直接运行 `docker compose up -d`。
- 不要默认让生产机或本机从 GHCR 拉镜像；默认必须走 CI 构建后直传到服务器并 `update-local`。
- “更新部署”默认包含 Android OTA；如果用户只要服务器更新，必须显式 `-SkipOta` 或口头说明“只更新服务器”。
- 指定 tag 时，不要在未确认 OTA git ref 与该 tag 对齐的情况下顺手发 OTA。
- 不要把服务器热更新绑到 `package.json.version` 自增；商业产品版本、OTA 包版本和原生壳版本是三类不同版本。
- 不要默认执行本地测试、lint、构建或额外审计。
- 部署失败时只报告：执行了哪个脚本、远端脚本失败位置、下一步最小补救。
