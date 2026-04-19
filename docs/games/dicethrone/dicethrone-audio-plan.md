# DiceThrone 音效替换记录（已实施）

## 已完成
1. 音效配置映射更新（`audio.config.ts`）。
2. 事件驱动音效：基于 `sys.log` 触发，并支持 `sfxKey` 优先级规则。
3. 能力/卡牌/效果新增 `sfxKey` 配置并透传事件。
4. 资源已拷贝到 `public/assets/dicethrone/audio/`（dice/card/fight/ui/status/token）。

## 待处理
1. 本地缺少 `ffmpeg`，`npm run compress:audio` 失败；需安装或配置 `FFMPEG_PATH` 后重试。
   - 可用路径：`d:\gongzuo\web\BordGame\BordGameAsset\工具\ffmpeg-7.1.1-essentials_build`（请指向其中的 `bin\ffmpeg.exe`）
2. 压缩完成后再执行 `npm run assets:manifest`（如需要）。

## 可选清理
- 如需删除旧的 `SFX_*.wav` 原文件，请确认后再执行清理，以避免误删历史资产。
