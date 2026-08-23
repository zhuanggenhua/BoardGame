# 认证排障快速入口

认证 401、`Invalid token`、登录态恢复和 refresh 相关问题统一看 [`../troubleshooting/token-expiration.md`](../troubleshooting/token-expiration.md)。

常用命令：

```bash
node scripts/debug-token.mjs <token>
npm run check:jwt
node scripts/diagnose-auth.mjs <token>
```

历史诊断证据保留在 [`../../evidence/_shared/token-expiration-diagnosis.md`](../../evidence/_shared/token-expiration-diagnosis.md)；它不是当前排障规范。
