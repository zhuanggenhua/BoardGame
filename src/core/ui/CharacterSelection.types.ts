/**
 * 角色选择系统 - 类型契约层
 * 定义跨游戏复用的角色选择接口
 */

import type { PlayerId } from '../../engine/types';

/**
 * 角色定义（通用）
 */
export interface CharacterDef {
    /** 角色唯一 ID */
    id: string;
    /** 角色名称 i18n key */
    nameKey: string;
    /** 角色描述 i18n key（可选） */
    descriptionKey?: string;
    /** 是否可选（用于禁用未实现的角色） */
    selectable?: boolean;
}

/**
 * 角色选择状态
 */
export interface CharacterSelectionState {
    /** 玩家选角状态（未选时为 'unselected'） */
    selectedCharacters: Record<PlayerId, string>;
    /** 玩家准备状态（选角后点击准备） */
    readyPlayers: Record<PlayerId, boolean>;
    /** 房主玩家 ID */
    hostPlayerId: PlayerId;
    /** 房主是否已点击开始 */
    hostStarted: boolean;
}

/**
 * 角色资源配置（游戏层注入）
 */
export interface CharacterAssets {
    /** 获取角色头像样式（背景图） */
    getPortraitStyle: (characterId: string, locale: string) => React.CSSProperties;
    /** 获取角色预览资源路径 */
    getPreviewAssets?: (characterId: string) => {
        /** 玩家面板图 */
        playerBoard: string;
        /** 提示板图 */
        tipBoard?: string;
    };
}

/**
 * 角色选择回调
 */
export interface CharacterSelectionCallbacks {
    /** 选择角色 */
    onSelect: (characterId: string) => void;
    /** 玩家准备 */
    onReady: () => void;
    /** 房主开始游戏 */
    onStart: () => void;
}

/**
 * 玩家颜色配置
 */
export interface PlayerColorScheme {
    bg: string;
    text: string;
    glow: string;
}

/**
 * 角色选择样式配置（游戏层注入）
 */
export interface CharacterSelectionStyleConfig {
    /** 玩家颜色方案 */
    playerColors: Record<string, PlayerColorScheme>;
    /** 玩家标签（P1/P2/...） */
    playerLabels: Record<string, string>;
    /** 背景资源路径 */
    backgroundAsset?: string;
}
