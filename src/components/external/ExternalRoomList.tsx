import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { joinExternalRoom, listExternalRooms } from '../../api/external-games';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordEntryModal } from '../common/overlays/PasswordEntryModal';
import { RoomList } from '../lobby/RoomList';
import type { RoomItem } from '../lobby/roomActions';
import { getExternalRoomGuestKey } from './nativeRoomGuestKey';

export function ExternalRoomList({ gameId }: { gameId: string }) {
    const { t } = useTranslation('lobby');
    const navigate = useNavigate();
    const { token, user, isLoading } = useAuth();
    const client = useQueryClient();
    const [lockedRoomId, setLockedRoomId] = useState<string>();
    const joinLocked = useMutation({
        mutationFn: ({ roomId, password }: { roomId: string; password: string }) => joinExternalRoom(
            { token, guestKey: token ? undefined : getExternalRoomGuestKey() }, roomId, password,
        ),
        onSuccess: view => {
            client.setQueryData(['external-room', view.room.roomId, user?.id], view);
            navigate(`/external/rooms/${view.room.roomId}`);
        },
    });
    const query = useQuery({
        queryKey: ['external-room-list', gameId],
        queryFn: () => listExternalRooms(gameId),
        refetchInterval: 1500,
    });
    const rooms = query.data?.rooms ?? [];
    const items: RoomItem[] = rooms.map(room => ({
        matchID: room.roomId,
        roomName: room.roomName || t('platform.externalRoom.roomBy', { name: room.hostName }),
        isLocked: room.isLocked,
        players: (room.playerNames ?? [room.hostName]).map((name, id) => ({ id, name })),
        playerCount: room.occupied,
        totalSeats: room.capacity,
        isFull: room.occupied >= room.capacity,
        isEmptyRoom: false,
        isMyRoom: false,
        isOwnerRoom: false,
        canReconnect: false,
        myPlayerID: null,
        myCredentials: null,
        isHost: false,
        gameKey: gameId,
    }));
    return <section aria-label={t('platform.externalRoom.list')}>
        <RoomList showPrimaryActions={false} roomItems={items}
            isLobbyLoading={query.isPending} connectionError={query.isError} onRetryConnection={() => void query.refetch()}
            onJoinRequest={roomId => {
                const room = rooms.find(item => item.roomId === roomId);
                if (!room) return;
                if (room.isLocked) {
                    joinLocked.reset();
                    setLockedRoomId(roomId);
                } else {
                    navigate(room.native ? `/external/native-room/${roomId}` : `/external/rooms/${roomId}?join=1`);
                }
            }} />
        {lockedRoomId && createPortal(<PasswordEntryModal open isLoading={isLoading || joinLocked.isPending}
            error={joinLocked.error?.message} onClose={() => setLockedRoomId(undefined)}
            onConfirm={password => joinLocked.mutate({ roomId: lockedRoomId, password })} />, document.body)}
    </section>;
}
