import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { listExternalRooms } from '../../api/external-games';

export function ExternalRoomList({ gameId }: { gameId: string }) {
    const { t } = useTranslation('lobby');
    const query = useQuery({
        queryKey: ['external-room-list', gameId],
        queryFn: () => listExternalRooms(gameId),
        refetchInterval: 1500,
    });
    const rooms = query.data?.rooms ?? [];
    return <section aria-label={t('platform.externalRoom.list')} className="platform-external-room-list">
        <h3>{t('platform.externalRoom.list')}</h3>
        {query.isError ? <p role="alert">{query.error.message}</p> : rooms.length === 0
            ? <p>{t(query.isPending ? 'platform.externalGamePage.loading' : 'platform.externalRoom.noRooms')}</p>
            : <ul>{rooms.map(room => <li key={room.roomId}>
                <span>{t('platform.externalRoom.roomBy', { name: room.hostName })} · {room.occupied}/{room.capacity}</span>
                {room.occupied < room.capacity
                    ? <Link to={room.native ? `/external/native-room/${room.roomId}` : `/external/rooms/${room.roomId}?join=1`}>{t('platform.externalRoom.join')}</Link>
                    : <span>{t('platform.externalRoom.full')}</span>}
            </li>)}</ul>}
    </section>;
}
