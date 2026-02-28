/**
 * DiceThrone 角色选择适配器
 * 使用游戏层专属的 DiceThroneHeroSelection 组件
 */

import React from 'react';
import { DiceThroneHeroSelection } from './DiceThroneHeroSelection';
import type { PlayerId } from '../../../engine/types';
import type { CharacterId, SelectableCharacterId } from '../domain/types';

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
    return (
        <DiceThroneHeroSelection
            isOpen={props.isOpen}
            currentPlayerId={props.currentPlayerId}
            hostPlayerId={props.hostPlayerId}
            selectedCharacters={props.selectedCharacters}
            readyPlayers={props.readyPlayers}
            playerNames={props.playerNames}
            onSelect={props.onSelect}
            onReady={props.onReady}
            onStart={props.onStart}
            locale={props.locale}
        />
    );
};
