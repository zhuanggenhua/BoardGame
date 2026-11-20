import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { FateDominationCore } from '../domain/types';
import { fateVictoryTrackPosition } from './fateMapGeometry';
import { fateTokenAsset } from './identityArtwork';

type ScoreSeat = { playerId: string; seat: number; masterId: string; points: number; eliminated: boolean };

function printedMarkerPlacement(index: number, count: number) {
    if (count === 1) return { dx: 0, dy: 0, size: 56 };
    const crowded = count > 3;
    if (crowded && index === 0) return { dx: 0, dy: 0, size: 26 };
    const angle = crowded ? (index - 1) * 2 * Math.PI / (count - 1) : index * 2 * Math.PI / count;
    const radius = crowded ? 28 : 23;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, size: crowded ? 26 : 36 };
}

export function FateVictoryTrack({ players, playerIds }: Pick<FateDominationCore, 'players' | 'playerIds'>) {
    const { t } = useTranslation('game-fate-domination');
    const groups = new Map<number, ScoreSeat[]>();
    const below: ScoreSeat[] = [];
    const above: ScoreSeat[] = [];
    playerIds.forEach((playerId, index) => {
        const { masterId, eliminated, victoryPoints } = players[playerId];
        const seat = { playerId, seat: index + 1, masterId, points: victoryPoints, eliminated };
        if (!fateVictoryTrackPosition(victoryPoints)) {
            (victoryPoints < 0 ? below : above).push(seat);
            return;
        }
        const occupants = groups.get(victoryPoints) ?? [];
        occupants.push(seat);
        groups.set(victoryPoints, occupants);
    });

    const marker = (seat: ScoreSeat, x: number, y: number, size: number, outside = false) => (
        <span key={seat.playerId} role="img" className={`fd-victory-marker${outside ? ' fd-victory-marker-outside' : ''}`}
            aria-label={t('ui.map.victoryMarker', { seat: seat.seat, points: seat.points })}
            aria-description={seat.eliminated ? t('ui.playerRail.eliminated') : undefined}
            data-fate-victory-seat={seat.playerId} data-fate-victory-points={seat.points}
            data-eliminated={seat.eliminated || undefined} style={{ left: x, top: y, height: size, width: outside ? undefined : size }}>
            <span className="fd-victory-portrait"><OptimizedImage src={fateTokenAsset(seat.masterId)} alt="" draggable={false}/></span>
            {outside && <span aria-hidden="true">{seat.points}</span>}
        </span>
    );

    return <div role="group" aria-label={t('ui.map.victoryTrack')} className="fd-victory-track">
        {[...groups].flatMap(([points, occupants]) => {
            const center = fateVictoryTrackPosition(points)!;
            return occupants.map((seat, index) => {
                const { dx, dy, size } = printedMarkerPlacement(index, occupants.length);
                return marker(seat, center.x + dx, center.y + dy, size);
            });
        })}
        {below.map((seat, index) => marker(seat, 1484 + 59 * index, 1151, 29, true))}
        {above.map((seat, index) => marker(seat, 1484 + 59 * index, 20, 29, true))}
    </div>;
}
