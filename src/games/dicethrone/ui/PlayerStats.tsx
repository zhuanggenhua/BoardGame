import type { RefObject } from 'react';
import type { HeroState } from '../types';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { RESOURCE_IDS } from '../domain/resources';
import {
    PlayerPanelSkeleton,
    createResourceBarRender,
    defaultPlayerPanelClassName,
} from '../../../components/game/framework';
import type { PlayerPanelData } from '../../../core/ui';

/** 护盾图标组件 */
const ShieldIcon = ({ value }: { value: number }) => (
    <div className="relative w-[1.8vw] h-[1.8vw] flex-shrink-0">
        <svg
            className="w-full h-full text-cyan-500"
            viewBox="0 1 24 25"
            fill="currentColor"
        >
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[0.8vw] font-bold text-white drop-shadow-md">
            {value}
        </span>
    </div>
);

export const PlayerStats = ({
    player,
    hpRef,
}: {
    player: HeroState;
    hpRef?: RefObject<HTMLDivElement | null>;
}) => {
    const { t } = useTranslation('game-dicethrone');

    // 构建 PlayerPanelData
    const health = player.resources[RESOURCE_IDS.HP] ?? 0;
    const cp = player.resources[RESOURCE_IDS.CP] ?? 0;
    // 计算总护盾值
    const shield = player.damageShields?.reduce((sum, s) => sum + s.value, 0) ?? 0;
    
    // 护盾不再作为独立资源条，改为图标显示
    const panelData: PlayerPanelData = useMemo(() => ({
        playerId: player.id ?? '0',
        resources: {
            health,
            cp,
        },
    }), [player.id, health, cp]);

    // 使用预设创建资源条渲染函数
    const renderResource = useMemo(() => createResourceBarRender({
        resources: {
            health: { max: 50, gradient: 'from-red-900 to-red-600', labelColor: 'text-red-200/80', label: t('hud.health') },
            cp: { max: 15, gradient: 'from-amber-800 to-amber-500', labelColor: 'text-amber-200/80', label: 'CP' },
        },
    }), [t]);

    return (
        <PlayerPanelSkeleton
            player={panelData}
            className={`${defaultPlayerPanelClassName} z-20 hover:bg-slate-900 transition-[background-color] duration-200 overflow-visible`}
            renderResource={(key, value) => {
                // 血量条特殊处理：添加护盾图标
                if (key === 'health') {
                    const content = (
                        <div className="flex items-center gap-[0.5vw]">
                            <div className="flex-1">
                                {renderResource(key, value)}
                            </div>
                            {shield > 0 && <ShieldIcon value={shield} />}
                        </div>
                    );
                    return hpRef ? <div ref={hpRef}>{content}</div> : content;
                }
                return renderResource(key, value);
            }}
        />
    );
};
