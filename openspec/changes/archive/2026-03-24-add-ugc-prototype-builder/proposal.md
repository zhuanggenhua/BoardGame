# Change: Add UGC Prototype Builder and Sandbox Runtime

## Why
UGC 需要允许用户编写规则与视图代码以获得足够自由度，但必须与官方游戏彻底隔离，避免安全与稳定性风险。同时需要面向“三国杀原型”快速落地的基础卡牌/阶段/目标选择/伤害/抽弃牌能力，以及配套的资源压缩上传与教程标注展示能力。

## What Changes
- 引入 UGC 运行时沙箱：服务端规则沙箱 + 客户端 iframe 视图沙箱，提供受限 SDK 通信边界。
- 提供 UGC 原型制作器：默认“原型”标签、卡牌/阶段/目标选择/抽弃牌/伤害的基础组件与数据模板，支持提示词与代码模板一键复制。
- 新增 UGC 资产处理流程：图片/音频自动压缩并保留原格式，已是压缩格式则跳过，上传到可扩展的对象存储。
- 扩展教程引擎：支持“标注展示模式”，通过右键标注组件并在教程模式显示描述。

## Impact
- Affected specs:
  - New: `ugc-runtime`
  - New: `ugc-prototype-builder`
  - New: `ugc-asset-processing`
  - Modified: `tutorial-engine`
- Affected code (implementation stage):
  - UGC 运行时与 SDK（服务端沙箱、前端 iframe 宿主）
  - UGC 原型制作器 UI（卡牌/阶段/目标选择/抽弃牌/提示词模板）
  - 资产处理与存储服务（压缩与对象存储兼容）
  - 教程标注展示 UI 与数据结构
