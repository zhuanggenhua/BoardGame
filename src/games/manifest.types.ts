export type GameManifestType = 'game' | 'tool';

export type GameCategory = 'strategy' | 'casual' | 'party' | 'abstract' | 'tools';

export interface GameManifestEntry {
    id: string;
    type: GameManifestType;
    enabled: boolean;
    titleKey: string;
    descriptionKey: string;
    category: GameCategory;
    playersKey: string;
    icon: string;
    /** 是否允许本地同屏模式，默认 true */
    allowLocalMode?: boolean;
    /** 可选的玩家人数列表，默认 [2] */
    playerOptions?: number[];
}
