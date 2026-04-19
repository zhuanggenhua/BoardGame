// 权威游戏清单：仅允许纯数据，禁止引入 React/DOM 依赖。
// 服务端与前端均从此清单派生注册与展示配置。
export type {
    GameManifestEntry,
    GameManifestType,
    GameCategory,
    GameMobileProfile,
    GameOrientationPreference,
    GameMobileLayoutPreset,
    GameShellTarget,
} from './manifest.types';
export { GAME_MANIFEST, GAME_MANIFEST_BY_ID } from './manifest.generated';
