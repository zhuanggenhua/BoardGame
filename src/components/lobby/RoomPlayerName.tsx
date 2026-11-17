import { useTranslation } from 'react-i18next';

/** 房间列表中的玩家连接状态；AI 和未知状态不冒充离线玩家。 */
export function RoomPlayerName({ name, isConnected, isAi }: { name: string; isConnected?: boolean; isAi?: boolean }) {
    const { t } = useTranslation('lobby');
    const status = isAi ? 'ai' : isConnected === true ? 'online' : isConnected === false ? 'offline' : 'unknown';
    const labels = {
        ai: t('rooms.playerStatus.ai', { defaultValue: '电脑玩家' }),
        online: t('rooms.playerStatus.online', { defaultValue: '在线' }),
        offline: t('rooms.playerStatus.offline', { defaultValue: '离线' }),
        unknown: t('rooms.playerStatus.unknown', { defaultValue: '状态未知' }),
    };
    const color = status === 'online' ? 'text-[#226b40]' : status === 'offline' ? 'text-[#806e61]' : '';
    return <span className={color} title={`${name} · ${labels[status]}`} aria-label={`${name}，${labels[status]}`} data-player-status={status}>{name}</span>;
}
