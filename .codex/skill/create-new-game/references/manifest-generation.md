# 清单生成说明

## 为什么需要生成
`src/games/manifest*.generated.ts(x)` 是自动生成文件，项目会从 `src/games/*/manifest.ts` 扫描生成。

## 如何生成
- 命令：`npm run generate:manifests`
- 生成脚本：`scripts/game/generate_game_manifests.js`

## 常见问题
- `manifest.id` 必须与目录名一致，否则脚本会报错。
- 游戏类型为 `game` 时必须有 `game.ts` 和 `Board.tsx`。
- 不要手改 `manifest.*.generated`。
