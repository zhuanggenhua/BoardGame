# Change: Refactor Audio into Common Layer

## Why
- 未来将新增大量游戏，当前“每游戏自带音效”会导致重复资源、命名冲突、维护成本飙升。
- 需要一个可扩展、可复用、可治理的音频层，确保一致的交互体验。

## What Changes
- 新增 **audio-system** 能力：统一的通用音频注册表（SFX/BGM）。
- 全部音频资源统一收敛至 `public/assets/common/audio/`，游戏目录不再包含音频资产。
- 事件通过 **音频元数据**（audioKey / audioCategory）驱动播放，避免每游戏配置文件。
- 增加校验：发现游戏层音频资产或音频配置时直接阻止启动（强约束）。

## Impact
- **Affected specs**: audio-system (new)
- **Affected code**: src/lib/audio/*, public/assets/common/audio, 游戏事件定义与触发
- **Related changes**: add-ugc-runtime-and-audio-pipeline（音频运行时）
