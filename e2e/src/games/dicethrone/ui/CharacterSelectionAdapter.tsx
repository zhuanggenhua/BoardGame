/**
 * DiceThrone 角色选择适配器
 * 使用游戏层专属的 DiceThroneHeroSelection 组件
 */

import React from 'react';
import { DiceThroneHeroSelection } from './DiceThroneHeroSelection';
import type { PlayerId } from '../../../engine/types';
import type { CharacterId, PendingSeatSwapRequest, SeatControllerKind, SelectableCharacterId } from '../domain/types';

export interface DiceThroneCharacterSelectionProps {
    isOpen: boolean;
    currentPlayerId: PlayerId;
    hostPlayerId: PlayerId;
    selectedCharacters: Record<PlayerId, CharacterId>;
    readyPlayers: Record<PlayerId, boolean>;
    playerNames: Record<PlayerId, string>;
    seatingOrder?: PlayerId[];
    seatControllers?: Record<PlayerId, SeatControllerKind>;
    seatSwapRequest?: PendingSeatSwapRequest;
    onSelect: (characterId: SelectableCharacterId) => void;
    onReady: () => void;
    onUnready: () => void;
    onRequestSeatSwap: (targetPlayerId: PlayerId) => void;
    onRespondSeatSwap: (approve: boolean) => void;
    onCancelSeatSwap: () => void;
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
            seatControllers={props.seatControllers}
            seatSwapRequest={props.seatSwapRequest}
            onSelect={props.onSelect}
            onReady={props.onReady}
            onUnready={props.onUnready}
            onRequestSeatSwap={props.onRequestSeatSwap}
            onRespondSeatSwap={props.onRespondSeatSwap}
            onCancelSeatSwap={props.onCancelSeatSwap}
            onStart={props.onStart}
            locale={props.locale}
        />
    );
};
