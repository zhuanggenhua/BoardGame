# Android 游戏包下载反馈 69d8869f70d52ddbd0c190ae 排查记录（2026-04-11）

## 反馈

- ID：`69d8869f70d52ddbd0c190ae`
- 标题：`APP无法下载预载包`
- 诊断包：`temp/feedback-closeout/2026-04-10T16-45-00-000Z/69d8869f70d52ddbd0c190ae.md`
- 路由：`/`

## 已知事实

- 这条诊断包没有附带截图、错误码、堆栈或具体游戏 ID，只有一句“APP 无法下载预载包”。
- 当前代码中的 Android 游戏包下载主链路已经不是早期 mock：
  - `src/features/mobile-packages/manifestClient.ts` 会先读取远端 manifest；
  - `src/features/mobile-packages/packageManagerService.ts` / `nativeGamePackagePlugin.ts` 会把 `assetPackUrl` 交给原生下载器；
  - `src/components/lobby/GameDetailsModal.tsx` 会在详情页展示下载入口与状态卡片。

## 当前生产可用性复核

我直接检查了当前线上发布源：

1. `https://assets.easyboardgame.top/official/mobile-packages/android/stable/games/smashup.json`
   - 返回 `200`
   - manifest 中存在 `assetPack.url`
2. `https://assets.easyboardgame.top/official/mobile-packages/android/stable/games/dicethrone.json`
   - 返回 `200`
   - manifest 中存在 `assetPack.url`
3. 对上述 manifest 里实际返回的 zip 地址再做 `HEAD` 检查：
   - SmashUp zip：`200`
   - Dice Throne zip：`200`

这说明：**至少当前线上发布源已经存在可下载的游戏包 manifest 和真实 zip 对象**。

## 本轮验证

1. `npx eslint src/components/lobby/GameDetailsModal.tsx src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts src/features/mobile-packages/useGamePackageState.ts src/features/mobile-packages/packageManagerService.ts src/features/mobile-packages/manifestClient.ts src/features/mobile-packages/nativeGamePackagePlugin.ts --quiet`
   - 结果：通过
2. `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts --configLoader native -t "打开详情后会预取远端素材包大小，并显示在下载卡片上"`
   - 结果：通过
   - 证明详情页会预取远端素材包 manifest，并把包大小/下载信息带入卡片状态
3. `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts --configLoader native -t "确认下载进行中时重复点击只触发一次 re-resolve"`
   - 结果：通过
   - 证明确认下载时会重新补齐缺失的 `assetPackUrl`，且不会重复创建下载
4. `node scripts/infra/vitest-cli-safe.mjs run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts --configLoader native -t "下载完成后，package-managed 游戏允许创建房间"`
   - 结果：通过
   - 证明下载完成态能够正确进入“已安装/允许继续”的后续链路
5. 线上对象检查：
   - SmashUp manifest `200`
   - SmashUp zip `HEAD 200`
   - DiceThrone manifest `200`
   - DiceThrone zip `HEAD 200`

## 结论

- **结论：resolved**。
- 当前代码与当前线上发布源都已具备可用的 Android 游戏包下载链路，未再观察到“没有可下载包”或“包地址不存在”的现象。
- **推断**：这条反馈更像是当时某次发布源未就绪、对象尚未上传完成、或旧版本 App 在下载链路上的瞬时问题；截至 `2026-04-11` 的复核结果，当前生产态已不再满足该故障现象。
