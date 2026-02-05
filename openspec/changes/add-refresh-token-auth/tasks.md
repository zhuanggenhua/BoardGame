## 1. 实现与验证
- [x] 1.1 设计并新增 Refresh Token 数据结构（存储/索引/TTL）
- [x] 1.2 登录/注册接口签发 Access Token + 设置 Refresh Cookie
- [x] 1.3 新增 `/auth/refresh` 接口，支持轮换与复用检测
- [x] 1.4 Logout 撤销 Refresh Token（并保留 Access 黑名单）
- [ ] 1.5 前端封装 401 自动刷新与请求重试（单飞刷新）
- [ ] 1.6 更新跨服务 JWT_SECRET 校验与开发环境配置
- [ ] 1.7 补充后端/前端测试用例
- [ ] 1.8 更新文档与迁移说明
