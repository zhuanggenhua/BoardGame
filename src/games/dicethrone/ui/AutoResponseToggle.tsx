import { useState, useEffect } from 'react';
import { Dices, Zap, ZapOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    AUTO_RESPONSE_KEY,
    BONUS_DICE_RESPONSE_KEY,
    getAutoResponseEnabled,
    getBonusDiceResponseEnabled,
} from './responsePreferences';

/**
 * 响应窗口显示开关组件
 * - 持久化到 localStorage
 * - 显示在左侧边栏血量下方
 * - 绿色（开启）= 手动响应，显示响应窗口，需要手动确认
 * - 灰色（关闭）= 自动跳过，自动跳过响应窗口，不拦截游戏流程
 */
export const AutoResponseToggle = ({
    onToggle,
    onBonusDiceToggle,
}: {
    onToggle?: (enabled: boolean) => void;
    onBonusDiceToggle?: (enabled: boolean) => void;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [enabled, setEnabled] = useState(() => getAutoResponseEnabled());
    const [bonusDiceEnabled, setBonusDiceEnabled] = useState(() => getBonusDiceResponseEnabled(enabled));

    useEffect(() => {
        localStorage.setItem(AUTO_RESPONSE_KEY, String(enabled));
        if (onToggle) {
            onToggle(enabled);
        }
    }, [enabled, onToggle]);

    useEffect(() => {
        const effectiveBonusDiceEnabled = enabled && bonusDiceEnabled;
        localStorage.setItem(BONUS_DICE_RESPONSE_KEY, String(effectiveBonusDiceEnabled));
        if (onBonusDiceToggle) {
            onBonusDiceToggle(effectiveBonusDiceEnabled);
        }
    }, [enabled, bonusDiceEnabled, onBonusDiceToggle]);

    const handleToggle = () => {
        const nextEnabled = !enabled;
        setEnabled(nextEnabled);
        if (!nextEnabled) {
            setBonusDiceEnabled(false);
        }
    };

    const handleBonusDiceToggle = () => {
        if (!enabled) return;
        setBonusDiceEnabled(!bonusDiceEnabled);
    };

    const buttonStyle = {
        height: '2.1vw',
        minHeight: '0',
        maxHeight: '2.1vw',
        paddingTop: '0',
        paddingBottom: '0',
        appearance: 'none',
        WebkitAppearance: 'none',
        lineHeight: 1,
    } as const;

    const effectiveBonusDiceEnabled = enabled && bonusDiceEnabled;

    return (
        <div className="flex items-center justify-center gap-[0.35vw]" data-testid="response-toggle-group">
            <button
                onClick={handleToggle}
                className={`
                    group relative flex h-[2.1vw] min-h-0 items-center gap-[0.22vw] px-[0.55vw] py-0 rounded-[0.45vw]
                    border transition-all duration-300 shadow-lg whitespace-nowrap
                    ${enabled
                        ? 'bg-emerald-900/80 border-emerald-500/50 hover:bg-emerald-800/90 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'bg-slate-900/80 border-slate-600/50 hover:bg-slate-800/90 shadow-[0_0_8px_rgba(0,0,0,0.2)]'
                    }
                `}
                title={enabled ? t('hud.autoResponseEnabled') : t('hud.autoResponseDisabled')}
                data-testid="auto-response-toggle"
                aria-pressed={enabled}
                style={buttonStyle}
            >
                {enabled ? (
                    <Zap className="w-[0.78vw] h-[0.78vw] shrink-0 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                ) : (
                    <ZapOff className="w-[0.78vw] h-[0.78vw] shrink-0 text-slate-400" />
                )}
                <span className={`text-[0.56vw] leading-none font-bold ${enabled ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {enabled ? t('hud.manualResponse') : t('hud.autoResponse')}
                </span>
            </button>
            <button
                onClick={handleBonusDiceToggle}
                disabled={!enabled}
                className={`
                    group relative flex h-[2.1vw] min-h-0 items-center gap-[0.22vw] px-[0.55vw] py-0 rounded-[0.45vw]
                    border transition-all duration-300 shadow-lg whitespace-nowrap disabled:cursor-not-allowed
                    ${effectiveBonusDiceEnabled
                        ? 'bg-amber-900/80 border-amber-400/60 hover:bg-amber-800/90 shadow-[0_0_12px_rgba(251,191,36,0.28)]'
                        : enabled
                            ? 'bg-slate-900/80 border-slate-600/50 hover:bg-slate-800/90 shadow-[0_0_8px_rgba(0,0,0,0.2)]'
                            : 'bg-slate-950/70 border-slate-700/40 opacity-55 shadow-[0_0_6px_rgba(0,0,0,0.15)]'
                    }
                `}
                title={enabled
                    ? (effectiveBonusDiceEnabled ? t('hud.bonusDiceResponseEnabled') : t('hud.bonusDiceResponseDisabled'))
                    : t('hud.bonusDiceResponseRequiresManual')
                }
                data-testid="bonus-dice-response-toggle"
                aria-pressed={effectiveBonusDiceEnabled}
                style={buttonStyle}
            >
                <Dices className={`w-[0.78vw] h-[0.78vw] shrink-0 ${effectiveBonusDiceEnabled ? 'text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.55)]' : 'text-slate-400'}`} />
                <span className={`text-[0.56vw] leading-none font-bold ${effectiveBonusDiceEnabled ? 'text-amber-200' : 'text-slate-400'}`}>
                    {t('hud.bonusDiceResponse')}
                </span>
            </button>
        </div>
    );
};
