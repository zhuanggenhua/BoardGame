import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DieFace } from '../types';
import {
    SpotlightSkeleton,
    defaultSpotlightBackdrop,
    defaultSpotlightContainer,
} from '../../../components/game/framework';
import { Dice3D } from './Dice3D';

interface BonusDieOverlayProps {
    /** 骰子值 (1-6) */
    value: number | undefined;
    /** 骰面符号 */
    face?: DieFace;
    /** 是否显示 */
    isVisible: boolean;
    /** 关闭回调 */
    onClose: () => void;
    /** 语言 */
    locale?: string;
}

/** 骰面效果描述 */
const FACE_EFFECT_KEYS: Record<DieFace, string> = {
    fist: 'bonusDie.effect.fist',
    palm: 'bonusDie.effect.palm',
    taiji: 'bonusDie.effect.taiji',
    lotus: 'bonusDie.effect.lotus',
};

/** 骰面颜色 */
const FACE_COLORS: Record<DieFace, string> = {
    fist: 'text-red-400',
    palm: 'text-blue-400',
    taiji: 'text-purple-400',
    lotus: 'text-emerald-400',
};

/** 骰面映射回退逻辑（为了兼容未提供 face 的情况） */
const getFallbackFace = (value: number): DieFace => {
    if (value === 1 || value === 2) return 'fist';
    if (value === 3) return 'palm';
    if (value === 4 || value === 5) return 'taiji';
    return 'lotus';
};

export const BonusDieOverlay: React.FC<BonusDieOverlayProps> = ({
    value,
    face: propFace,
    isVisible,
    onClose,
    locale,
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [isRolling, setIsRolling] = React.useState(true);
    const [showResult, setShowResult] = React.useState(false);

    // 优先使用传入的 face，回退到硬编码映射
    const face = propFace || (value ? getFallbackFace(value) : 'fist');

    // 投掷动画序列（骰子翻滚 -> 显示结果）
    React.useEffect(() => {
        if (!isVisible || value === undefined) {
            setIsRolling(true);
            setShowResult(false);
            return;
        }

        // 开始投掷动画
        setIsRolling(true);
        setShowResult(false);

        // 800ms 后停止投掷
        const stopRolling = setTimeout(() => {
            setIsRolling(false);
        }, 800);

        // 1200ms 后显示结果文字
        const showResultTimer = setTimeout(() => {
            setShowResult(true);
        }, 1200);

        return () => {
            clearTimeout(stopRolling);
            clearTimeout(showResultTimer);
        };
    }, [isVisible, value]);

    if (value === undefined) return null;

    return (
        <SpotlightSkeleton
            isVisible={isVisible}
            onClose={onClose}
            autoCloseDelay={3500}
            backdropClassName={defaultSpotlightBackdrop}
            containerClassName={`${defaultSpotlightContainer} pointer-events-none`}
            enterAnimation={{ duration: 300 }}
            exitAnimation={{ duration: 500 }}
            title={
                <div className="text-[1.5vw] font-bold text-amber-400 uppercase tracking-wider animate-pulse">
                    {t('bonusDie.title')}
                </div>
            }
            description={
                <div
                    className={`flex flex-col items-center gap-[0.8vw] transition-all duration-500 ${showResult ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[1vw]'}`}
                >
                    {/* 骰面名称 */}
                    <div className={`text-[2vw] font-black ${FACE_COLORS[face]}`}>
                        {t(`dice.face.${face}`)}
                    </div>
                    {/* 效果描述 */}
                    <div className="text-[1.2vw] text-slate-300 bg-black/50 px-[1.5vw] py-[0.5vw] rounded-[0.5vw] border border-slate-600/50">
                        {t(FACE_EFFECT_KEYS[face])}
                    </div>
                </div>
            }
        >
            {/* 骰子 */}
            <div className="relative">
                <Dice3D
                    value={value}
                    isRolling={isRolling}
                    size="10vw"
                    locale={locale}
                    variant="spotlight"
                />
                {/* 发光效果 */}
                {!isRolling && (
                    <div
                        className="absolute inset-[-1vw] rounded-[1.5vw] animate-pulse pointer-events-none"
                        style={{
                            boxShadow: `0 0 3vw 1vw ${face === 'fist' ? 'rgba(248,113,113,0.5)' : face === 'palm' ? 'rgba(96,165,250,0.5)' : face === 'taiji' ? 'rgba(192,132,252,0.5)' : 'rgba(52,211,153,0.5)'}`,
                        }}
                    />
                )}
            </div>
        </SpotlightSkeleton>
    );
};

export default BonusDieOverlay;
