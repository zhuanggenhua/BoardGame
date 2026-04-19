/**
 * 传输层统一导出
 */

// 存储接口
export type {
    MatchStorage,
    MatchMetadata,
    PlayerMetadata,
    StoredMatchState,
    CreateMatchData,
    FetchOpts,
    FetchResult,
    ListMatchesOpts,
} from './storage';

// 协议类型
export type {
    MatchPlayerInfo,
    ClientToServerEvents,
    ServerToClientEvents,
    GameBoardProps,
} from './protocol';

// 服务端
export { GameTransportServer } from './server';
export type { GameEngineConfig, GameTransportServerConfig } from './server';

// 客户端
export { GameTransportClient } from './client';
export type { GameTransportClientConfig, ClientConnectionState } from './client';

// React 封装
export {
    useGameClient,
    useBoardProps,
    GameProvider,
    LocalGameProvider,
} from './react';
export type { GameProviderProps, LocalGameProviderProps } from './react';
