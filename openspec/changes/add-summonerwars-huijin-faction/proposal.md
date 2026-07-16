# Change: Add Summoner Wars Huijin Faction

## Why
用户已提供召唤师战争灰烬派系素材，需要把该派系接入现有派系选择、牌组、图集、预加载、资源链和机制实现流程。

## What Changes
- 新增灰烬派系静态数据、派系目录、牌组生成和卡池注册。
- 接入灰烬 `hero/cards/tip` 资源到图集、关键图片预加载和派系选择。
- 建立灰烬卡牌录入合同、机制实现矩阵和审计证据。
- 分阶段实现灰烬能力与事件，并补必要单测/E2E。

## Impact
- Affected specs: `summonerwars-core`
- Affected code: `src/games/summonerwars/**`, `public/locales/*/game-summonerwars.json`, `public/assets/i18n/zh-CN/summonerwars/**`
