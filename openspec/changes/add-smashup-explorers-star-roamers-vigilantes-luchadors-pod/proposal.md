# Change: Smash Up 探险家/星际旅者/侠义义警/摔角手 POD 接入

## Why

用户提供了四张 4×5 POD 卡图，要求将对应大杀四方种族的 Print-on-Demand 版本按项目规范实装到当前仓库，并明确不向作者主仓库提交 PR。

## What Changes

- 新增探险家 explorers_pod、星际旅者 star_roamers_pod、侠义义警 vigilantes_pod 和摔角手 luchadors_pod 四个 POD faction。
- 将四张用户提供图片接入正式 Smash Up card atlas 目录，生成 runtime WebP 并刷新 asset manifest。
- 为四套 POD 牌组新增完整 card definitions、atlas IDs、faction IDs、UI metadata、locale keys 与 card registry 注册。
- 为 POD 变体补充 variant binding profiles；义警 POD 中与基础版不一致的卡牌使用 separate/显式覆盖，避免误继承基础版规则。
- 增加 intake 测试，覆盖牌数/张数、atlas index、可选状态、i18n key 与代表能力注册。

## Impact

- Scope: Smash Up faction registry, POD card data, POD atlas resources, locale text, ability variant binding, targeted intake tests.
- Non-goals: 不发布 PR、不推送远端、不改作者主仓库；不重排已有基础版派系和既有 POD 批次。

