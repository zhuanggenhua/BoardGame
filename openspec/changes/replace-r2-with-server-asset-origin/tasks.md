## 1. Implementation
- [x] 1.1 Remove R2 fallback reads from the Cloudflare asset router.
- [x] 1.2 Remove R2 bucket binding from Worker configuration.
- [x] 1.3 Remove R2 backup queue generation from server asset publishing.
- [x] 1.4 Switch package asset scripts from R2 upload/download names to server publish/download compatibility entries.
- [x] 1.5 Remove `backupToR2` from OTA/native/mobile package publishing.
- [x] 1.6 Deploy server control scripts and disabled legacy systemd units.
- [x] 1.7 Deploy Worker config without R2 binding and remove bypass routes.
- [ ] 1.8 Configure `assets.easyboardgame.top` as grey-cloud direct A record to the server.
- [ ] 1.9 Serve `/official/**` directly from server 443 with public TLS and download limits.
- [ ] 1.10 Verify public URLs remain available through current domain without R2 and without Worker.

## 2. Validation
- [x] 2.1 Run asset publish unit tests.
- [x] 2.2 Run asset router unit tests.
- [x] 2.3 Run server upload check mode.
- [x] 2.4 Run OpenSpec strict validation.
- [x] 2.5 Verify production server and Cloudflare routing state.

