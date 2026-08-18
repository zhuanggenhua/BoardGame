import type { RefObject } from 'react';
import type { HeroState } from '../types';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { RESOURCE_IDS } from '../domain/resources';
import { PlayerPanelSkeleton } from '../../../components/game/framework';
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
    isHpShaking,
    isCpShaking,
    damageFlashActive,
    damageFlashDamage,
    overrideHp,
}: {
    player: HeroState;
    hpRef?: RefObject<HTMLDivElement | null>;
    cpRef?: RefObject<HTMLDivElement | null>;
    hitStopActive?: boolean;
    hitStopConfig?: HitStopConfig;
    /** HP 条是否正在震动（受击） */
    isHpShaking?: boolean;
    /** CP 条是否正在震动（获得/失去 CP） */
    isCpShaking?: boolean;
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

    const resourceConfig = useMemo(() => ({
        health: {
            max: 50,
            label: t('hud.health'),
            labelClassName: 'text-red-100/85',
            borderClassName: 'border-red-500/90',
            fillClassName: 'from-red-950 via-red-800 to-red-500',
            glowClassName: 'shadow-[0_0_14px_rgba(239,68,68,0.28)]',
        },
        cp: {
            max: 15,
            label: 'CP',
            labelClassName: 'text-amber-100/85',
            borderClassName: 'border-amber-400/90',
            fillClassName: 'from-yellow-900 via-amber-700 to-yellow-400',
            glowClassName: 'shadow-[0_0_14px_rgba(245,158,11,0.24)]',
        },
    }), [t]);

    const renderResourceBar = (key: string, value: number) => {
        const config = resourceConfig[key as keyof typeof resourceConfig];
        if (!config) return null;

        const percentage = Math.min(100, Math.max(0, (value / config.max) * 100));

        return (
            <div
                data-dicethrone-resource={key}
                className={[
                    'relative h-[1.85vw] w-full overflow-hidden box-border bg-black/60',
                    'border-[0.18vw]',
                    config.borderClassName,
                    config.glowClassName,
                ].join(' ')}
            >
                <div
                    data-dicethrone-resource-fill={key}
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${config.fillClassName} transition-[width] duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-x-0 top-0 h-[38%] bg-white/12" />
                    <div className="absolute inset-x-0 bottom-0 h-[42%] bg-black/24" />
                </div>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[0.72vw]">
                    <span className={`text-[0.78vw] font-black uppercase tracking-[0.08em] ${config.labelClassName}`}>
                        {config.label}
                    </span>
                    <span className="text-[1.08vw] font-black text-white drop-shadow-md">{value}</span>
                </div>
            </div>
        );
    };

    return (
        <PlayerPanelSkeleton
            player={panelData}
            className="relative z-20 flex w-full flex-col gap-[0.5vw] overflow-visible bg-transparent p-0 shadow-none"
            renderResource={(key, value) => {
                if (key === 'health') {
                    return (
                        <div className="flex w-full items-center gap-[0.5vw]">
                            <div ref={hpRef} className="min-w-0 flex-1">
                                <ShakeContainer isShaking={!!isHpShaking} className="w-full">
                                    <HitStopContainer
                                        isActive={!!hitStopActive}
                                        {...(hitStopConfig ?? {})}
                                        className="w-full"
                                    >
                                        {renderResourceBar(key, value)}
                                        <DamageFlash
                                            active={!!damageFlashActive}
                                            damage={damageFlashDamage ?? 1}
                                            intensity={(damageFlashDamage ?? 0) >= 5 ? 'strong' : 'normal'}
                                            showNumber={false}
                                        />
                                    </HitStopContainer>
                                </ShakeContainer>
                            </div>
                            {shield > 0 && <ShieldIcon value={shield} />}
                        </div>
                    );
                }

                return (
                    <div ref={cpRef} className="w-full">
                        <ShakeContainer isShaking={!!isCpShaking} className="w-full">
                            {renderResourceBar(key, value)}
                        </ShakeContainer>
                    </div>
                );
            }}
        />
    );
};
