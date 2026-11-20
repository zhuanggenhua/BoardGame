import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { joinExternalRoom, joinNativeExternalRoom, listExternalRooms } from '../../api/external-games';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordEntryModal } from '../common/overlays/PasswordEntryModal';
import { RoomList } from '../lobby/RoomList';
import type { RoomItem } from '../lobby/roomActions';
import { getExternalRoomGuestKey } from './nativeRoomGuestKey';
import { externalRoomPath } from './externalRoomPath';

export function ExternalRoomList({ gameId }: { gameId: string }) {
    const { t } = useTranslation('lobby');
    const navigate = useNavigate();
    const { token, user, isLoading } = useAuth();
    const client = useQueryClient();
    const [lockedRoomId, setLockedRoomId] = useState<string>();
    const join = useMutation({
        mutationFn: ({ roomId, password, native }: { roomId: string; password?: string; native?: boolean }) => {
            const identity = { token, guestKey: token ? undefined : getExternalRoomGuestKey() };
            return native ? joinNativeExternalRoom(identity, roomId) : joinExternalRoom(identity, roomId, password);
        },
        onSuccess: view => {
            if (view.native) {
                client.setQueryData(['native-external-room-join', view.room.roomId, user?.id ?? getExternalRoomGuestKey()], view);
            } else {
                client.setQueryData(['external-room', view.room.roomId, user?.id], view);
            }
            navigate(externalRoomPath(view.gameId, view.room.roomId, view.native));
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
        {!lockedRoomId && join.error && <p role="alert">{join.error.message}</p>}
        <RoomList showPrimaryActions={false} roomItems={items}
            isLobbyLoading={query.isPending} connectionError={query.isError} onRetryConnection={() => void query.refetch()}
            onJoinRequest={roomId => {
                const room = rooms.find(item => item.roomId === roomId);
                if (!room || isLoading || join.isPending) return;
                if (room.isLocked) {
                    join.reset();
                    setLockedRoomId(roomId);
                } else {
                    join.mutate({ roomId, native: room.native });
                }
            }} />
        {lockedRoomId && createPortal(<PasswordEntryModal open isLoading={isLoading || join.isPending}
            error={join.error?.message} onClose={() => { join.reset(); setLockedRoomId(undefined); }}
            onConfirm={password => join.mutate({ roomId: lockedRoomId, password })} />, document.body)}
    </section>;
}
