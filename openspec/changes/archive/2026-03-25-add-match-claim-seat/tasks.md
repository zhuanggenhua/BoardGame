## 1. Implementation
- [x] 1.1 服务端新增 `claim-seat` 路由，完成 JWT 校验、`ownerKey` 授权和 credentials 重新签发
- [x] 1.2 游客 `ownerKey` 创建房间时，如存在占用房间则删除旧房间
- [x] 1.3 前端创建房间失败并返回 `ACTIVE_MATCH_EXISTS` 时，自动走 `claim-seat` 回归流程
- [x] 1.4 Home/大厅在无本地凭据时，支持自动 `claim-seat` 回归
- [x] 1.5 补充单元测试：`claim-seat` 授权/拒绝、游客覆盖旧房间
- [x] 1.6 更新相关注释、日志与说明

## 2. Validation
- [ ] 2.1 运行后端测试（含新增用例）
- [ ] 2.2 手动验证：登录用户清缓存后仍可回归；游客清缓存可新建并清理旧房
