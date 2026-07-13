## 0. Approval

- [x] 0.1 用户当轮已要求按流程实装本批漫威反派四派系

## 1. Intake Contract

- [x] 1.1 锁定原图来源、尺寸、hash、正式资源落点与临时裁图目录
- [x] 1.2 锁定 `9 x 6` 网格、前 49 格卡牌、后 5 格空白 / 尾格
- [x] 1.3 锁定九头蛇、克里、邪恶大师、邪恶六人组四派系唯一卡数量与实体牌数量
- [x] 1.4 建立 evidence intake 合同，标明中文效果文本仍待逐字图面复核

## 2. Static Registry And Assets

- [x] 2.1 将原始 atlas 接入正式 `public/assets/i18n/zh-CN/smashup/cards/marvel_villains.png`
- [x] 2.2 生成压缩 WebP 并更新游戏级与根级 manifest
- [x] 2.3 注册新的 `9 x 6` atlas ID 和四个 faction ID
- [x] 2.4 新增四个 faction 数据文件并在 `cards.ts` 增量注册
- [x] 2.5 补齐 faction metadata、双语 locale 和结构合同测试

## 3. Hydra / 九头蛇

- [x] 3.1 完成 11 张唯一卡面的静态定义与 20 张实体牌数量
- [x] 3.2 实现九头蛇摧毁己方角色、抽牌、额外打出低力量角色、弃牌堆回收与持续力量修正
- [x] 3.3 补九头蛇 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 4. Kree / 克里

- [x] 4.1 完成 12 张唯一卡面的静态定义与 20 张实体牌数量
- [x] 4.2 实现克里额外行动、抽牌、行动回收、行动打出计数与力量修正
- [x] 4.3 补克里 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 5. Masters Of Evil / 邪恶大师

- [x] 5.1 完成 12 张唯一卡面的静态定义与 20 张实体牌数量
- [x] 5.2 实现邪恶大师 VP 阈值、计分后 VP、摧毁保护、移动后得 VP 与基地修正
- [x] 5.3 补邪恶大师 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 6. Sinister Six / 邪恶六人组

- [x] 6.1 完成 14 张唯一卡面的静态定义与 20 张实体牌数量
- [x] 6.2 实现邪恶六人组临界点降低、基地神器移动、低临界点分支、特殊窗口与基地能力取消
- [x] 6.3 补邪恶六人组 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 7. Closeout

- [x] 7.1 运行 OpenSpec 严格校验
- [x] 7.2 运行定向资源 / 注册 / i18n Vitest
- [ ] 7.3 记录资源上传或 PR handoff 状态；远端发布后补代表 URL `HEAD 200`
- [x] 7.4 回写 L0-L4 批次矩阵、剩余风险与下一阶段派系玩法清单
