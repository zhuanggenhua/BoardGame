# 关于弹窗赞助二维码 E2E 证据

## 本轮目标

修复 app / Web 共用的关于弹窗里，微信和支付宝赞助二维码不显示的问题，并确认二维码改为从 `public/logos` 静态文件加载后可以正常渲染。

## 修复点

- `src/components/system/AboutModal.tsx`
  - 将二维码资源从错误的 `common/logos/*.jpg` 改为 `versionedPublicFileUrl('/logos/*.jpg')`
  - 取消对这两张二维码使用 `OptimizedImage`，改为普通 `<img>`，避免被 `/assets` 游戏资源管线错误重写

## 验证方式

执行命令：

```powershell
$env:PW_USE_DEV_SERVERS='true'
$env:PW_TEST_MATCH='lobby.e2e.ts'
$env:PW_PORT='4175'
npx playwright test --grep "关于弹窗赞助二维码会显示 public logos 静态图"
```

说明：

- 先重新执行了 `npm run build`
- 再用 `npm run preview -- --host 127.0.0.1 --port 4175` 提供本地预览服务
- 未走默认 `test:e2e:ci:file` 包装，是因为当时被全局 `android-compat-smoke` 重任务预算阻塞，无法正常起隔离 E2E runtime

## 截图证据

截图路径：

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\lobby.e2e\关于弹窗赞助二维码会显示-public-logos-静态图\lobby-about-modal-support-qr-visible.png`

## 肉眼观察结论

- 关于弹窗中部的两张二维码都已显示为真实黑白二维码图像，不再是空白块、灰色占位或断图图标。
- 左侧二维码下方标签为“微信”，右侧二维码下方标签为“支付宝”，图片与标签一一对应，没有左右错位。
- 二维码都完整落在各自的浅色圆角容器内，没有被裁切、拉伸或溢出。
- 赞助名单区域在本次预览环境里显示“赞助名单加载失败”，这是因为预览静态服务未提供 `/sponsors` API；该现象不影响二维码图片加载验证。

## 结果

本轮修复已验证通过：关于弹窗赞助二维码现在从 `public/logos` 成功加载，E2E 用例通过，截图可见结果符合预期。
