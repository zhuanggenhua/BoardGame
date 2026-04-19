import type { GameManifestEntry } from './manifest.types';
import type { GameEngineConfig } from '../engine/transport/server';

export interface GameServerManifestEntry {
    manifest: GameManifestEntry;
    /** 引擎配置 */
    engineConfig: GameEngineConfig;
}
