## 1. Schema 与契约
- [ ] 1.1 为 feedback 增加 reporterType/source/autoReportKind/incidentKey 字段与索引
- [ ] 1.2 DTO/validation 扩展来源字段（仅受信请求可写 system）
- [ ] 1.3 服务端补来源派生兼容（旧数据按旁路字段推断）

## 2. API 与服务
- [ ] 2.1 管理端查询支持 reporterType/source 过滤
- [ ] 2.2 管理端批量删除支持 reporterType/source 过滤（如需）

## 3. 自动反馈投递
- [ ] 3.1 game-server 写入 reporterType/source/autoReportKind/incidentKey
- [ ] 3.2 生产 docker-compose 为 game-server 配置 FEEDBACK_API_URL
- [ ] 3.3 记录 endpoint 解析日志与失败原因（可选）

## 4. Admin UI
- [ ] 4.1 列表新增来源筛选 + 来源 badge/列
- [ ] 4.2 详情面板新增来源信息区块
- [ ] 4.3 同步 i18n 文案与前端类型

## 5. 历史回填
- [ ] 5.1 新增 dry-run 默认的回填脚本（识别 watchdog 旧数据）
- [ ] 5.2 输出回填报告（命中数、样例、按 incidentKind 分组）

## 6. 测试与校验
- [ ] 6.1 更新/补充 server 端自动反馈相关测试
- [ ] 6.2 关键文件 ESLint 校验
