import { cn } from '../../../lib/utils';
import { useTranslation } from 'react-i18next';

export interface RoomPresencePlayer {
    id: number | string;
    name?: string;
    isConnected?: boolean;
}

interface RoomPlayerStatusListProps {
    players: RoomPresencePlayer[];
    compact?: boolean;
    emptyLabel?: string;
    className?: string;
}

const resolvePlayerLabel = (
    t: (key: string, options?: Record<string, unknown>) => string,
    player: RoomPresencePlayer
) => {
    if (player.name?.trim()) {
        return player.name.trim();
    }
    if (typeof player.id === 'number' && Number.isFinite(player.id)) {
        return t('admin.roomsPage.player_labels.seat_number', { seat: player.id + 1 });
    }
    return t('admin.roomsPage.player_labels.seat_id', { seat: player.id });
};

export default function RoomPlayerStatusList({
    players,
    compact = false,
    emptyLabel,
    className,
}: RoomPlayerStatusListProps) {
    const { t } = useTranslation('lobby');
    if (players.length === 0) {
        return (
            <div className={cn('text-xs text-zinc-400', className)}>
                {emptyLabel ?? t('admin.roomsPage.players.empty')}
            </div>
        );
    }

    return (
        <div className={cn('flex flex-wrap gap-2', className)}>
            {players.map((player) => {
                const isConnected = Boolean(player.isConnected);
                return (
                    <span
                        key={`${player.id}-${player.name ?? 'empty'}`}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                            isConnected
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-zinc-200 bg-zinc-50 text-zinc-500',
                            compact ? 'px-2 py-0.5 text-[11px]' : null,
                        )}
                    >
                        <span
                            className={cn(
                                'h-2 w-2 rounded-full',
                                isConnected ? 'bg-emerald-500' : 'bg-zinc-400',
                            )}
                            aria-hidden="true"
                        />
                        <span className="max-w-[120px] truncate">{resolvePlayerLabel(t, player)}</span>
                        <span className="text-[10px] uppercase tracking-[0.08em] opacity-70">
                            {isConnected ? t('admin.roomsPage.online.online') : t('admin.roomsPage.online.offline')}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}
