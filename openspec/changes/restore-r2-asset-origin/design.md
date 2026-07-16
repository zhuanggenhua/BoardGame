## Context
当前生产机同时承载 Web/API、游戏服务、数据库、Redis、训练数据和服务器素材源。排查中已看到游戏服务 CPU 尖峰、根分区高水位以及大量 Docker 历史 volume；素材域名虽经 Cloudflare，但公开响应仍标识为服务器素材源。

R2 回切不是单纯改一个环境变量：现有文档、脚本和审计在多处把“服务器素材主源”当成完成态，并且曾显式移除 R2 运行时入口。因此本 change 先定义回切目标和验收口径，待审批后再实施。

## Goals / Non-Goals
- Goals:
  - 玩家访问 `https://assets.easyboardgame.top/official/**` 时默认命中 R2/Cloudflare，不再命中生产服务器素材源。
  - 发布脚本能够把普通素材、manifest、file-index、OTA 包、原生更新包和移动素材包写入 R2，并用公开 URL 校验本次对象。
  - 清理 R2 与服务器上的历史冗余对象前，先生成可审计的保留集合与删除候选清单。
- Non-Goals:
  - 不迁移 MongoDB、Redis、游戏服务或认证服务。
  - 不在仓库内保存 R2 密钥、Cloudflare token 或生产 SSH 私钥。
  - 不把临时限流、跳过下载或吞错当作素材链路修复。

## Decisions
- Decision: 保持公开 URL 不变，只切换 `assets.easyboardgame.top/official` 背后的主源。
  - Rationale: Web、Android、iOS、manifest 和已有缓存键都依赖该公开基址，换域名会扩大客户端升级风险。
- Decision: R2 主源验收必须从真实公开域名发起，不用服务器本机 curl 或旧对象可读替代。
  - Rationale: 用户实际体验由公开链路决定，服务器本地可读不能证明 Cloudflare/R2 已接管。
- Decision: 清理采用“保留集合先行”的方式。
  - Rationale: R2 回切的历史事故风险在于误删仍被 latest manifest、移动包 file-index 或客户端版本引用的对象。

## Risks / Trade-offs
- R2 历史对象可能混入旧版本、源图、未压缩资源或废弃包；必须先 dry-run 输出差异，再删除。
- Cloudflare Worker 和 R2 自定义域两种接法的诊断头能力不同；如果选择直连 R2 自定义域，验收需结合 DNS/Cloudflare 配置与服务器访问日志证明没有回源服务器。
- 回切期间可能存在 CDN 缓存；发布验证需要 cache-bust 查询和代表性对象 hash/size 校验。

## Migration Plan
1. 从当前 manifest、latest 指针和移动包 file-index 生成官方保留集合。
2. 将保留集合上传或补齐到 R2，并校验大小和 SHA-256。
3. 切换 Cloudflare 路由，使公开资源基址默认从 R2 返回。
4. 验证代表性普通素材、manifest、OTA、原生更新包和移动素材包均不再命中服务器素材源。
5. 服务器清理只删除已证明不被容器、数据库、Redis、训练数据或当前素材保留集合引用的对象。

## Open Questions
- 最终采用 Cloudflare Worker 读 R2 还是 R2 自定义域直接服务 `assets.easyboardgame.top`？
- 服务器是否保留一份最近 release 的只读应急镜像，还是完全退出素材链路？
- R2 历史对象保留窗口按客户端版本、天数还是 latest 指针闭包定义？
