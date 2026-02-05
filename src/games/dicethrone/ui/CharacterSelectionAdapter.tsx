/**
 * DiceThrone 角色选择适配器
 * 将游戏特化配置注入到框架层骨架组件
 */

import React from 'react';
import { CharacterSelectionSkeleton } from '../../../components/game/framework/CharacterSelectionSkeleton';
import { getPortraitStyle, ASSETS } from './assets';
import { DICETHRONE_CHARACTER_CATALOG, type SelectableCharacterId, type CharacterId } from '../domain/types';
import type { PlayerId } from '../../../engine/types';
import type {
    CharacterDef,
    CharacterSelectionCallbacks,
    CharacterAssets,
    CharacterSelectionStyleConfig,
} from '../../../core/ui/CharacterSelection.types';

// Gaming 风格配色（基于 UI Skill 设计系统）
const PLAYER_COLORS: CharacterSelectionStyleConfig['playerColors'] = {
    '0': { bg: '#F43F5E', text: 'white', glow: 'rgba(244,63,94,0.5)' },  // Rose - P1
    '1': { bg: '#3B82F6', text: 'white', glow: 'rgba(59,130,246,0.5)' }, // Blue - P2
    '2': { bg: '#10B981', text: 'white', glow: 'rgba(16,185,129,0.5)' }, // Emerald - P3
    '3': { bg: '#F59E0B', text: 'black', glow: 'rgba(245,158,11,0.5)' }, // Amber - P4
};

const PLAYER_LABELS: CharacterSelectionStyleConfig['playerLabels'] = {
    '0': 'P1',
    '1': 'P2',
    '2': 'P3',
    '3': 'P4',
};

export interface DiceThroneCharacterSelectionProps {
    isOpen: boolean;
    currentPlayerId: PlayerId;
    hostPlayerId: PlayerId;
    selectedCharacters: Record<PlayerId, CharacterId>;
    readyPlayers: Record<PlayerId, boolean>;
    playerNames: Record<PlayerId, string>;
    onSelect: (characterId: SelectableCharacterId) => void;
    onReady: () => void;
    onStart: () => void;
    locale: string;
}

export const DiceThroneCharacterSelection: React.FC<DiceThroneCharacterSelectionProps> = (props) => {
    // 转换角色定义格式
    const characters: CharacterDef[] = DICETHRONE_CHARACTER_CATALOG.map(char => ({
        id: char.id,
        nameKey: char.nameKey,
        // 仅显示目前已实现的英雄
        selectable: ['monk', 'barbarian'].includes(char.id),
    }));

    // 资源配置
    const assets: CharacterAssets = {
        getPortraitStyle: (characterId: string, locale: string) => 
            getPortraitStyle(characterId as CharacterId, locale),
        getPreviewAssets: (characterId: string) => ({
            playerBoard: ASSETS.PLAYER_BOARD(characterId as CharacterId),
            tipBoard: ASSETS.TIP_BOARD(characterId as CharacterId),
        }),
    };

    // 样式配置
    const styleConfig: CharacterSelectionStyleConfig = {
        playerColors: PLAYER_COLORS,
        playerLabels: PLAYER_LABELS,
        backgroundAsset: 'dicethrone/images/Common/background',
    };

    // 回调函数
    const callbacks: CharacterSelectionCallbacks = {
        onSelect: props.onSelect,
        onReady: props.onReady,
        onStart: props.onStart,
    };

    return (
        <CharacterSelectionSkeleton
            isOpen={props.isOpen}
            currentPlayerId={props.currentPlayerId}
            hostPlayerId={props.hostPlayerId}
            selectedCharacters={props.selectedCharacters}
            readyPlayers={props.readyPlayers}
            playerNames={props.playerNames}
            characters={characters}
            callbacks={callbacks}
            assets={assets}
            styleConfig={styleConfig}
            locale={props.locale}
            i18nNamespace="game-dicethrone"
        />
    );
};
