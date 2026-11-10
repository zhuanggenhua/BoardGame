# 首页平台 v2 图面审计

## 现场

- 源稿：`index.html` 固定 1920×1080，无滚动
- 导出：`exports/01-全部游戏.png`、`exports/02-卡牌分类.png`、`exports/03-战棋分类.png`（各 1920×1080）
- 状态：已登录、发现、全部游戏、幻想国度精选、大杀四方进行中

## 裁决

```text
verdict: PASS
score: 93/100
target_requirements:
  - requirement: Open Design 核心首页，功能像游戏平台
    status: PASS
    evidence: 顶栏发现/收藏库/上传；精选封面；继续游戏；12 格游戏库
  - requirement: 现代墨铜客厅，不抄 Switch/Steam/羊皮纸
    status: PASS
    evidence: 墨底、铜焰按钮、封面为主体
  - requirement: 当前首页信息不丢失
    status: PASS
    evidence: 字标副标题、指南、中文、通知、积分用户、分类、人数、实施中、火焰、对局条、工具、0.6.47
  - requirement: 收藏/上传只出入口
    status: PASS
    evidence: 顶栏按钮，无弹窗
  - requirement: 正式封面进入画面，缺封面诚实降级
    status: PASS
    evidence: 9 张正式封面；璀璨宝石/命运支配/井字棋为「封面待接入」文字底板
  - requirement: 分类筛选真实改变游戏库
    status: PASS
    evidence: 全部十二格；卡牌七格；战棋三格
hard_failures: []
negative_impact_checks:
  - 用户菜单下拉未展开：顶栏已露出积分/通知/昵称；下拉项写在 DESIGN.md
  - 未登录态未出图：本屏确认已登录平台气质
issues: []
```

## 玩家第一眼

先看到幻想国度大封面，左下可进游戏；右侧继续大杀四方；顶条可重连或销毁房间。下面是游戏库。
