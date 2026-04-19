/**
 * UGC 模块主入口
 * 
 * 提供 UGC 运行时、SDK 通信、数据模板、资产处理等能力
 */

// SDK 通信
export * from './sdk';

// 资产处理
export * from './assets';

// 运行时（宿主桥接 + 视图 SDK）
export * from './runtime';

// 原型制作器
export * from './builder';

// 服务端（沙箱执行器 + 资源压缩）- 使用命名空间避免冲突
export { SandboxExecutor, createSandboxExecutor } from './server';
export type { SandboxConfig, SandboxResult, UGCDomainCore, SandboxCommand } from './server';
export { ImageCompressor, createImageCompressor, AudioCompressor, createAudioCompressor } from './server';
export type { ImageCompressionInput, ImageCompressionOutput, AudioCompressionInput, AudioCompressionOutput } from './server';
