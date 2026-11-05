# Change: 将已确认的平台首页设计完整落到正式应用

## Why
用户已确认当前 Open Design 的桌面布局，并明确它尚未实施。当前正式入口仍是旧首页与书本模式；仅继续修设计稿不能交付产品。

## What Changes
- 按 artifacts/home-platform-v3-neo-brutalist 当前稿实施发现、收藏库、详情、个人与上传入口；保持已确认桌面视觉语言。
- 移动端保留游戏与主动作优先，次级信息进入展开区或抽屉，处理触控、滚动、返回位置和安全区。
- 复用真实注册表、房间操作、认证、社交、配置与教程入口，不复制设计稿里的示例房间、好友、时长或版本记录作为线上数据。
- 页面组合、内容展示和数据行为按职责拆分；已有房间/认证行为保持单一入口。

## Approval
2026-10-17 用户明确批准完整实施，原话：“我说的是设计稿没问题哦，不是已经实施了的意思，现在是让你彻底重构，完成实施”。不再先走新一轮设计稿审批。

## Impact
- Affected specs: home-platform
- Affected code: src/pages/HomeEntry.tsx、src/pages/Home.tsx、src/components/home/、src/components/lobby/，及确有缺口的数据接口。
- 不以静态设计稿测试替代正式页面验证，不影响小黑屋采集中的游戏页面。
