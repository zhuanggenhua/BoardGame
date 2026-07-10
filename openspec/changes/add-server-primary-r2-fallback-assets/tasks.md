## 1. 安全基线与回滚快照
- [x] 1.1 导出当前 Cloudflare DNS、R2 自定义域名、Tunnel、Worker Route 和相关脚本配置
- [x] 1.2 记录当前素材域名代表性 GET/HEAD/Range/ETag/CORS 响应作为兼容基线
- [ ] 1.3 新建 R2 密钥，更新 CI、本机和服务器并验证上传/读取
- [x] 1.4 撤销旧 R2 密钥并验证旧凭据失效
- [x] 1.4a 将 `.env.example` 中真实配置替换为空占位符
- [ ] 1.5 清理 root npm 缓存和历史 coredump，并记录清理前后磁盘用量
- [ ] 1.6 为 Docker JSON 日志、应用文件日志和 systemd coredump 配置容量上限
- [ ] 1.7 默认关闭生产训练数据采集；如确认保留，则迁出容器可写层并配置压缩、保留期和总容量上限
- [x] 1.8 训练决策改为 pending 暂存，只有完整合格对局才原子提交
- [x] 1.9 增加游戏级优先、全局兜底的最低完成时长配置
- [x] 1.10 每游戏正式训练数据达到 300MiB 后整局停止录入
- [x] 1.11 为 game-server 配置独立训练数据持久化卷
- [x] 1.12 补齐完整性、时长、容量、并发和持久化目录定向测试
- [x] 1.13 旧版 raw 数据与新 completed 正式配额隔离
- [x] 1.14 未完成 pending 超过 24 小时自动清理

## 2. 服务器运行时镜像
- [x] 2.1 创建独立素材 release/current 目录，不复用业务镜像目录或失效的空备份目录
- [x] 2.2 配置独立 Nginx 静态端口、源站密钥校验、GET/HEAD 白名单和缓存头
- [x] 2.3 配置全局/单客户端连接上限、单响应限速及 Nginx CPU/IO 保护
- [ ] 2.4 实现 manifest 驱动的 rclone staging 同步，永久排除三类大型发布路径
- [x] 2.5 实现同步后路径/大小/哈希校验和 `current` 原子切换
- [ ] 2.6 建立 systemd service/timer、低优先级和可查询日志，替换失效 cron
- [ ] 2.7 验证同步失败时旧 release 继续可用，且可切回上一个已验证 release

## 3. Cloudflare 同域回退
- [x] 3.1 新增隐藏 Tunnel hostname，回源服务器独立静态端口且不影响现有 API hostname
- [x] 3.2 实现只读 Worker：服务器优先、超时/404/408/429/5xx 回退 R2 Binding
- [x] 3.3 实现 R2 GET/HEAD/Range/条件请求、HTTP metadata、ETag 和 CORS 兼容
- [ ] 3.4 增加 `X-Asset-Source` 诊断头和不包含凭据/对象内容的结构化日志
- [x] 3.5 为 app-updates、mobile-packages、native-app-updates 配置更具体的 R2 bypass route
- [x] 3.6 部署 canary Worker，验证服务器命中、强制 R2 回退和隐藏源鉴权
- [x] 3.7 低流量窗口绑定现有 `assets.easyboardgame.top/*`，保留一键移除 Route 的回滚命令

## 4. 业务保护与观测
- [ ] 4.1 建立素材请求量、服务器命中率、R2 回退率、源站超时和 5xx 观测
- [ ] 4.2 在固定连接/速率上限下压测普通素材，验证游戏/API 健康和容器稳定
- [x] 4.3 验证大型包下载不进入服务器，且不会挤占游戏服务带宽
- [ ] 4.4 记录首版固定限流结果；只有证据证明仍需动态熔断时再建立后续变更

## 5. R2 可回滚清理
- [x] 5.1 生成递归引用、最近版本、fallback、OTA 桥接版本和发布时间窗保留集合
- [x] 5.2 生成第一批删除候选清单，逐项记录 key、size、hash/etag、时间和删除理由
- [x] 5.3 将候选对象归档到服务器隔离目录并完成数量、总大小和哈希校验
- [ ] 5.4 演练按原 key/metadata 回传一个隔离对象并验证远端哈希
- [ ] 5.5 删除第一批已隔离 R2 对象，保留 14 天恢复窗口并监控 404
- [ ] 5.6 隔离期结束后再次确认无引用和无回滚请求，再清理隔离副本
- [ ] 5.7 将首次清理后的 R2 用量降到 8GiB 以下
- [x] 5.8 为现有上传入口增加 9GiB 预检门禁，超限时在写入第一个对象前失败
- [ ] 5.9 验证容量不足时不会出现“服务器已发布但 R2 fallback 缺对象”的半发布状态

## 6. 文档与最终验证
- [x] 6.1 更新 `docs/deploy.md`，记录素材源站、限流、监控和回滚入口
- [x] 6.2 更新 `docs/ai-rules/asset-pipeline.md`，明确 R2 真相源与服务器派生镜像边界
- [ ] 6.3 验证现有协作者上传命令和移动/OTA 发布命令无需改变
- [x] 6.4 执行正式 Route 上线、源站停机回退、Route 移除回滚三组端到端验证
- [x] 6.5 运行 `openspec validate add-server-primary-r2-fallback-assets --strict --no-interactive`
