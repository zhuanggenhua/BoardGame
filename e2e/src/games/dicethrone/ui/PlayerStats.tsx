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
import {
    HitStopContainer,
    DamageFlash,
    type HitStopConfig,
} from '../../../components/common/animations';
import { ShakeContainer } from '../../../components/common/animations/ShakeContainer';

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
    cpRef,
    hitStopActive,
    hitStopConfig,
    isShaking,
    damageFlashActive,
    damageFlashDamage,
    overrideHp,
}: {
    player: HeroState;
    hpRef?: RefObject<HTMLDivElement | null>;
    cpRef?: RefObject<HTMLDivElement | null>;
    hitStopActive?: boolean;
    hitStopConfig?: HitStopConfig;
    /** 是否正在震动（自己受击） */
    isShaking?: boolean;
    /** 受击 DamageFlash 是否激活 */
    damageFlashActive?: boolean;
    /** 受击伤害值 */
    damageFlashDamage?: number;
    /** 视觉状态缓冲覆盖的 HP 值（飞行动画到达前冻结） */
    overrideHp?: number;
}) => {
    const { t } = useTranslation('game-dicethrone');

    // 构建 PlayerPanelData
    const health = overrideHp ?? (player.resources[RESOURCE_IDS.HP] ?? 0);
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
        <ShakeContainer isShaking={!!isShaking}>
            <HitStopContainer
                isActive={!!hitStopActive}
                {...(hitStopConfig ?? {})}
                className="w-full"
            >
                <div className="relative overflow-visible">
                    <PlayerPanelSkeleton
                        player={panelData}
                        className={`${defaultPlayerPanelClassName} z-20 hover:bg-slate-900/90 transition-all duration-300 overflow-visible bg-slate-950/95 border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] rounded-[1.2vw] p-[0.6vw]`}
                        renderResource={(key, value) => {
                            // 血量条特殊处理：添加护盾图标
                            if (key === 'health') {
                                const content = (
                                    <div className="flex items-center gap-[0.5vw] group/resource">
                                        <div className="flex-1 relative rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_1px_2px_rgba(255,255,255,0.1)]">
                                            {renderResource(key, value)}
                                            {/* 3D Highlights - Optimized for softness */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                <div className="absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-white/10 to-transparent" />
                                                <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black/20 to-transparent" />
                                            </div>
                                        </div>
                                        {shield > 0 && <ShieldIcon value={shield} />}
                                    </div>
                                );
                                return hpRef ? <div ref={hpRef}>{content}</div> : content;
                            }
                            return (
                                <div className="relative group/resource rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_1px_2px_rgba(255,255,255,0.1)]" ref={cpRef}>
                                    {renderResource(key, value)}
                                    {/* 3D Highlights - Optimized for softness */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute top-0 left-0 right-0 h-[45%] bg-gradient-to-b from-white/10 to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black/20 to-transparent" />
                                    </div>
                                </div>
                            );
                        }}
                    />
                    {/* 受击时空裂隙 + 红脉冲 overlay */}
                    <DamageFlash
                        active={!!damageFlashActive}
                        damage={damageFlashDamage ?? 1}
                        intensity={(damageFlashDamage ?? 0) >= 5 ? 'strong' : 'normal'}
                        showNumber={false}
                    />
                </div>
            </HitStopContainer>
        </ShakeContainer>
    );
};
