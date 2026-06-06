# Change: 优先采集真人决策训练数据

## Why
当前在线训练数据会在命令成功后统一记录，但样本里没有显式 actor/controller 元数据，真人 vs AI 对局里也无法干净区分“真人决策”与“AI 自己的决策”。这会污染后续用真人样本训练或评估跨游戏回合制 AI 的数据集。

## What Changes
- 为训练决策样本补充执行座位的 controller / actor 元数据
- 服务端训练数据采集默认优先记录真人座位，跳过本地/远程 AI seat 的自动命令
- 保留按游戏 manifest 显式放开“采集全部座位”的能力，兼容需要同时分析 AI 样本的场景

## Impact
- Affected specs: ai-training-data, game-registry
- Affected code: src/engine/transport/trainingData.ts, src/engine/transport/server.ts, src/games/manifest.types.ts, tests
