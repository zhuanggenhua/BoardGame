# Change: Add Fate/Domination Foundation Board

## Why
项目已有 React/Vite 多桌游运行时，但尚未接入 Fate/Domination。用户提供了中文基础规则书、冬木市地图、事件牌、攻击/技能牌、御主与从者素材，希望先得到一条可展示、可交互、可扩展的第一版牌桌流程，而不是停留在方案层。

## What Changes
- 新增 `fate-domination` 游戏主 spec 增量，定义 3-7 人、11 回合、四阶段回合骨架和第一版玩家可见信息层级。
- 新增 `src/games/fate-domination/` 游戏包：manifest、领域状态/命令/事件、基础 setup、Board、缩略图、关键图片解析和最小测试。
- 接入真实本地素材：冬木市地图、已核验事件牌、攻击/技能牌、御主与从者素材；运行时资源按项目图片资源链语义命名、压缩并生成 manifest。
- 提供一条可演示的开发验证流程：选择/确认本方身份、按回合显示局势与事件区域、部署地点、选择两张攻击牌、推进到战斗结算，并可查看牌面详情。
- 主牌桌包含地图/战场、玩家/御主状态、手牌与攻击区、事件区、局势区、牌堆/弃牌、回合/阶段状态、当前可用动作和卡牌检视层；使用已补齐的真实局势牌图，但未逐张核验的效果不冒充已实现。
- 采用桌面基线优先、移动端同源降级的响应式布局；验证开发入口 `/dev/fate-domination` 的桌面与移动视口。正式产品入口走在线匹配 `/play/fate-domination/match/:matchId`。
- 附加能力矩阵明确记录：action-log、undo-system、audio-feedback、game-ai-system、tutorial-engine、debug-config 的本轮状态与后续 change 边界。

## Impact
- Affected specs: `fate-domination`（新增）、`game-registry`、`domain-core`、`mobile-adaptive`、`ui-engine-framework`、`action-log`、`undo-system`。
- Affected code: `src/games/fate-domination/**`、生成的 game manifest、`public/assets/i18n/zh-CN/fate-domination/**`、对应 locale 与测试/evidence 文件。
- External impact: 不改共享引擎协议；不上传服务器素材，不宣称线上或移动包资源已闭环，除非后续明确授权并完成远端回查。
- Approval gate: 本 change 获得明确批准前，不进入产品代码、正式资源目录或实现 E2E；当前仅交付提案、设计/录入合同和 tasks 清单。
