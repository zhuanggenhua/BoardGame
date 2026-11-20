import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { getExternalRoomEntry } from '../api/external-games';
import { externalRoomPath } from '../components/external/externalRoomPath';

export default function LegacyExternalRoomRedirect() {
    const { roomId = '' } = useParams();
    const entry = useQuery({
        queryKey: ['external-room-entry', roomId],
        queryFn: () => getExternalRoomEntry(roomId),
        retry: false,
    });
    if (entry.isPending) return null;
    return <Navigate replace to={entry.data ? externalRoomPath(entry.data.gameId, roomId, entry.data.native) : '/'} />;
}
