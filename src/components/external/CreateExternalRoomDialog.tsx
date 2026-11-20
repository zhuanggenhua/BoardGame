import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createExternalRoom } from '../../api/external-games';
import { useAuth } from '../../contexts/AuthContext';
import { externalRoomPlayerLimits } from '../../shared/externalRoom';
import type { ExternalGame } from '../../shared/externalGames';
import { CreateRoomModal, type RoomConfig, type RoomCreationGame } from '../lobby/CreateRoomModal';
import { getExternalRoomGuestKey } from './nativeRoomGuestKey';
import { externalRoomPath } from './externalRoomPath';

export function CreateExternalRoomDialog({ game, onClose }: { game: ExternalGame; onClose: () => void }) {
    const { token, user, isLoading } = useAuth();
    const navigate = useNavigate();
    const query = useQueryClient();
    const roomGame = useMemo<RoomCreationGame>(() => {
        const { min } = externalRoomPlayerLimits(game.minPlayers, game.maxPlayers);
        return {
            id: game.gameId,
            playerOptions: game.roomSetup?.playerCounts ?? [min],
            setupOptions: Object.fromEntries((game.roomSetup?.fields ?? []).map(field => [field.id, {
                type: 'select',
                labelKey: field.label,
                default: field.defaultValue,
                options: field.options.map(option => ({ value: option.value, labelKey: option.label })),
            }])),
        };
    }, [game.gameId, game.minPlayers, game.maxPlayers, game.roomSetup]);
    const create = useMutation({
        mutationFn: ({ roomName, password, numPlayers, setupSelections }: RoomConfig) => createExternalRoom(
            { token, guestKey: token ? undefined : getExternalRoomGuestKey() },
            {
                gameId: game.gameId, expectedEntry: game.url, capacity: game.roomSetup ? numPlayers : undefined, roomName, password,
                settings: Object.fromEntries(Object.entries(setupSelections).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
            },
        ),
        onSuccess: view => {
            query.setQueryData(['external-room', view.room.roomId, user?.id], view);
            navigate(externalRoomPath(view.gameId, view.room.roomId));
        },
    });
    return <CreateRoomModal isOpen onClose={onClose} onConfirm={create.mutate} gameManifest={roomGame}
        isLoading={isLoading || create.isPending} error={create.error?.message} showRetention={false} literalSetupLabels />;
}
