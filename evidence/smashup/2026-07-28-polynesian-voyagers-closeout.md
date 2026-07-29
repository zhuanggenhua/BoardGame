# Smash Up 波利尼西亚航海者 Closeout

## 本地交付

- 卡牌图集：`public/assets/i18n/zh-CN/smashup/cards/polynesian_voyagers.png`
- 运行时 WebP：`public/assets/i18n/zh-CN/smashup/cards/compressed/polynesian_voyagers.webp`
- 源 PNG：`11247201` bytes，SHA-256 `97299d31a0a98eba7e00411e75a612ad8cf3611fb1c25fec3349a73901b677d8`
- 运行时 WebP：`1765534` bytes，SHA-256 `989403c1366435feb89daf70bfd1618e7b5df4b79f1a0774feeced06882c5389`

## 验证

- `npx tsc --noEmit --pretty false`：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/polynesianVoyagersIntake.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts --configLoader native`：通过，19 tests
- `npm run i18n:check`：通过，无 missing keys
- `openspec validate add-smashup-polynesian-voyagers-faction --strict --no-interactive`：通过
- `node scripts/assets/upload-to-server.js --check --asset-prefix i18n/zh-CN/smashup/cards/compressed/polynesian_voyagers.webp`：通过，识别 1 个待发布对象

## 远端资源状态

- 公开 URL：`https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/polynesian_voyagers.webp`
- `HEAD`：`404 Not Found`
- 定向上传命令：`node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/smashup/cards/compressed/polynesian_voyagers.webp`
- 上传结果：失败，`admin@8.148.71.102: Permission denied (publickey,gssapi-keyex,gssapi-with-mic)`

## 残余风险

PR 已包含本地运行所需的图集、WebP、manifest、代码、locale 和测试；服务器素材主源尚未发布成功。默认线上资源基址仍会对新 WebP 返回 404，需由具备服务器 SSH 发布权限的人补发该对象后再做 `HEAD 200` 回查。
