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
    seatingOrder?: PlayerId[];
    onSelect: (characterId: SelectableCharacterId) => void;
    onReady: () => void;
    onUnready: () => void;
    onMoveSeat: (playerId: PlayerId, targetSeatIndex: number) => void;
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
            seatingOrder={props.seatingOrder}
            onSelect={props.onSelect}
            onReady={props.onReady}
            onUnready={props.onUnready}
            onMoveSeat={props.onMoveSeat}
            onStart={props.onStart}
            locale={props.locale}
        />
    );
};
