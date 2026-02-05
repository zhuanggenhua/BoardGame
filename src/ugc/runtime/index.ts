/**
 * UGC 运行时模块导出
 */

// 宿主桥接
export { UGCHostBridge, createHostBridge } from './hostBridge';
export type { CommandHandler, HostBridgeConfig } from './hostBridge';

// 视图 SDK
export { UGCViewSdk, createViewSdk, getGlobalSdk, initGlobalSdk } from './viewSdk';
export type { ViewSdkConfig, InitCallback, StateUpdateCallback, CommandResultCallback, ErrorCallback } from './viewSdk';

// 预览 Host/View
export { UGCRuntimeHost } from './UGCRuntimeHost';
export { UGCRuntimeView } from './UGCRuntimeView';
export type { RuntimeViewMode } from './UGCRuntimeView';
export { BUILDER_PREVIEW_CONFIG_KEY, attachBuilderPreviewConfig, extractBuilderPreviewConfig } from './previewConfig';
export type { BuilderPreviewConfig } from './previewConfig';
