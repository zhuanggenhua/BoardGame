export type GameManifestType = 'game' | 'tool';

export type GameCategory = 'card' | 'dice' | 'abstract' | 'wargame' | 'casual' | 'tools';

export interface GameManifestEntry {
    id: string;
    type: GameManifestType;
    enabled: boolean;
    titleKey: string;
    descriptionKey: string;
    category: GameCategory;
    playersKey: string;
    icon: string;
    /** 缩略图资源路径（不含扩展名，可指向 compressed 目录） */
    thumbnailPath?: string;
    /** 是否允许本地同屏模式，默认 true */
    allowLocalMode?: boolean;
    /** 可选的玩家人数列表，默认 [2] */
    playerOptions?: number[];
    /** 游戏标签，用于替代单一分类显示 */
    tags?: string[];
    /** 最佳游玩人数配置 */
    bestPlayers?: number[];
    /** 关键图片路径列表（相对于 /assets/），进入对局前必须加载完成 */
    criticalImages?: string[];
    /** 暖加载图片路径列表（相对于 /assets/），进入对局后后台预取 */
    warmImages?: string[];
}
