import React from 'react';
import type { InteractionDescriptor, HeroState } from '../domain/types';
import type { TokenDef } from '../domain/tokenTypes';
import type { PlayerId } from '../../../engine/types';
import { InteractionOverlay } from './InteractionOverlay';
import type { ChoiceOption } from './ChoiceModal';
import type { StatusAtlases } from './statusEffects';

type ObjectChoiceKind = 'card' | 'player' | 'status';

interface ChoiceObjectSelectionProps {
    choiceId: string;
    playerId: PlayerId;
    sourceAbilityId?: string;
    title: string;
    options: ChoiceOption[];
    canResolve: boolean;
    players: Record<PlayerId, HeroState>;
    tokenDefinitions?: TokenDef[];
    playerNames?: Record<PlayerId, string>;
    seatingOrder?: PlayerId[];
    teamIdByPlayerId?: Record<PlayerId, string>;
    currentPlayerId: PlayerId;
    statusIconAtlas?: StatusAtlases | null;
    locale?: string;
    onResolve: (optionId: string) => void;
}

/**
 * Adapts a rule-owned ChoiceRequest to Dice Throne's existing full object selector.
 * Selection stays local until confirmation, then resolves the original option ID.
 */
export const ChoiceObjectSelection: React.FC<ChoiceObjectSelectionProps> = ({
    choiceId,
    playerId,
    sourceAbilityId,
    title,
    options,
    canResolve,
    players,
    tokenDefinitions,
    playerNames,
    seatingOrder,
    teamIdByPlayerId,
    currentPlayerId,
    statusIconAtlas,
    locale,
    onResolve,
}) => {
    const [selectedPlayerId, setSelectedPlayerId] = React.useState<PlayerId | undefined>();
    const [selectedCardId, setSelectedCardId] = React.useState<string | undefined>();
    const [selectedStatus, setSelectedStatus] = React.useState<{ playerId: PlayerId; statusId: string } | undefined>();

    const objectOptions = options.filter((option): option is ChoiceOption & { choiceKind: ObjectChoiceKind } => (
        option.choiceKind === 'card' || option.choiceKind === 'player' || option.choiceKind === 'status'
    ));
    const kind = objectOptions[0]?.choiceKind;
    const skipOption = options.find(option => option.choiceKind === 'skip');
    const candidateOptions = objectOptions.filter(option => option.choiceKind === kind);
    const selectedValue = kind === 'player' ? selectedPlayerId
        : kind === 'card' ? selectedCardId
            : selectedStatus?.statusId;
    const selectedOption = kind === 'player'
        ? candidateOptions.find(option => option.targetPlayerId === selectedPlayerId)
        : kind === 'card'
            ? candidateOptions.find(option => option.cardId === selectedCardId)
            : candidateOptions.find(option => option.targetPlayerId === selectedStatus?.playerId
                && option.candidateStatusId === selectedStatus?.statusId);

    const interaction = React.useMemo<InteractionDescriptor>(() => {
        const base: InteractionDescriptor = {
            id: choiceId,
            playerId,
            sourceCardId: sourceAbilityId ?? 'doctor-strange-choice',
            type: kind === 'player' ? 'selectPlayer' : kind === 'status' ? 'selectStatus' : 'selectCard',
            titleKey: title,
            selectCount: 1,
            minSelectCount: skipOption ? 0 : 1,
            selected: kind === 'player' && selectedPlayerId ? [selectedPlayerId]
                : kind === 'card' && selectedCardId ? [selectedCardId]
                    : kind === 'status' && selectedStatus ? [selectedStatus.statusId]
                        : [],
        };
        if (kind === 'player') {
            base.targetPlayerIds = candidateOptions.flatMap(option => option.targetPlayerId ? [option.targetPlayerId] : []);
        } else if (kind === 'card') {
            base.cardSourceZone = candidateOptions[0]?.cardSourceZone;
            base.candidateCardIds = candidateOptions.flatMap(option => option.cardId ? [option.cardId] : []);
        } else if (kind === 'status') {
            base.targetPlayerIds = [...new Set(candidateOptions.flatMap(option => option.targetPlayerId ? [option.targetPlayerId] : []))];
            base.candidateStatusOptions = candidateOptions.flatMap(option => (
                option.targetPlayerId && option.candidateStatusId
                    ? [{ playerId: option.targetPlayerId, statusId: option.candidateStatusId, collection: 'statusEffects' as const }]
                    : []
            ));
            base.selectedStatusPlayerId = selectedStatus?.playerId;
        }
        return base;
    }, [candidateOptions, choiceId, kind, playerId, selectedCardId, selectedPlayerId, selectedStatus, skipOption, sourceAbilityId, title]);

    const hasValidSelection = !selectedValue || Boolean(selectedOption && (
        kind === 'player'
            ? Boolean(selectedOption.targetPlayerId && players[selectedOption.targetPlayerId])
            : kind === 'card'
                ? Boolean(selectedOption.cardId && selectedOption.cardSourceZone
                    && players[playerId]?.[selectedOption.cardSourceZone]?.some(card => card.id === selectedOption.cardId))
                : Boolean(selectedOption.targetPlayerId && selectedOption.candidateStatusId
                    && (players[selectedOption.targetPlayerId]?.statusEffects[selectedOption.candidateStatusId] ?? 0) > 0)
    ));

    const selectPlayer = (targetId: PlayerId) => setSelectedPlayerId(current => current === targetId ? undefined : targetId);
    const selectCard = (cardId: string) => setSelectedCardId(current => current === cardId ? undefined : cardId);
    const selectStatus = (targetId: PlayerId, statusId: string) => setSelectedStatus(current => (
        current?.playerId === targetId && current.statusId === statusId ? undefined : { playerId: targetId, statusId }
    ));
    const confirm = () => {
        if (selectedOption && hasValidSelection) {
            onResolve(selectedOption.id);
            return;
        }
        if (!selectedValue && skipOption) onResolve(skipOption.id);
    };

    return (
        <InteractionOverlay
            interaction={interaction}
            players={players}
            tokenDefinitions={tokenDefinitions}
            currentPlayerId={currentPlayerId}
            playerNames={playerNames}
            seatingOrder={seatingOrder}
            teamIdByPlayerId={teamIdByPlayerId}
            onSelectStatus={selectStatus}
            onSelectPlayer={selectPlayer}
            onSelectHandCard={selectCard}
            onConfirm={confirm}
            statusIconAtlas={statusIconAtlas}
            locale={locale}
            canResolve={canResolve && hasValidSelection}
            canCancel={false}
            allowBackgroundInteraction
            onCancel={() => undefined}
            confirmLabelKey={!selectedValue && skipOption ? skipOption.label : 'common.confirm'}
        />
    );
};
