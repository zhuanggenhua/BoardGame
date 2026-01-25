import type { RefObject } from 'react';
import type { HeroState } from '../types';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import {
    PlayerPanelSkeleton,
    createResourceBarRender,
    defaultPlayerPanelClassName,
} from '../../../components/game/framework';
import type { PlayerPanelData } from '../../../core/ui';

export const PlayerStats = ({
    player,
    hpRef,
}: {
    player: HeroState;
    hpRef?: RefObject<HTMLDivElement | null>;
}) => {
    const { t } = useTranslation('game-dicethrone');

    // 构建 PlayerPanelData
    const panelData: PlayerPanelData = useMemo(() => ({
        playerId: player.id ?? '0',
        resources: {
            health: player.health,
            cp: player.cp,
        },
    }), [player.id, player.health, player.cp]);

    // 使用预设创建资源条渲染函数（带 i18n 标签）
    const renderResource = useMemo(() => createResourceBarRender({
        resources: {
            health: { max: 50, gradient: 'from-red-900 to-red-600', labelColor: 'text-red-200/80', label: t('hud.health') },
            cp: { max: 6, gradient: 'from-amber-800 to-amber-500', labelColor: 'text-amber-200/80', label: t('hud.energy') },
        },
    }), [t]);

    return (
        <PlayerPanelSkeleton
            player={panelData}
            className={`${defaultPlayerPanelClassName} z-20 hover:bg-slate-900 transition-[background-color] duration-200`}
            renderResource={(key, value) => {
                // 血量条需要 ref，特殊处理
                if (key === 'health' && hpRef) {
                    return (
                        <div ref={hpRef}>
                            {renderResource(key, value)}
                        </div>
                    );
                }
                return renderResource(key, value);
            }}
        />
    );
};
