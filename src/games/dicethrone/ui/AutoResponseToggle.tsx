import { useState, useEffect } from 'react';
import { Zap, ZapOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    AUTO_RESPONSE_KEY,
    getAutoResponseEnabled,
} from './responsePreferences';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

/**
 * 响应窗口显示开关组件
 * - 持久化到 localStorage
 * - 显示在左侧边栏血量下方
 * - 绿色（开启）= 手动响应，显示响应窗口，需要手动确认
 * - 灰色（关闭）= 自动跳过，自动跳过响应窗口，不拦截游戏流程
 */
export const AutoResponseToggle = ({
    onToggle,
}: {
    onToggle?: (enabled: boolean) => void;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [enabled, setEnabled] = useState(() => getAutoResponseEnabled());

    useEffect(() => {
        localStorage.setItem(AUTO_RESPONSE_KEY, String(enabled));
        if (onToggle) {
            onToggle(enabled);
        }
    }, [enabled, onToggle]);

    const handleToggle = () => {
        setEnabled(!enabled);
    };

    const buttonStyle = {
        height: buildBoardShellInlineUnitValue(2.1),
        minHeight: '0',
        maxHeight: buildBoardShellInlineUnitValue(2.1),
        paddingTop: '0',
        paddingBottom: '0',
        appearance: 'none',
        WebkitAppearance: 'none',
        lineHeight: 1,
    } as const;

    return (
        <div className="flex items-center justify-center" style={{ gap: buildBoardShellInlineUnitValue(0.35) }} data-testid="response-toggle-group">
            <button
                onClick={handleToggle}
                className={`
                    group relative flex min-h-0 items-center py-0
                    border transition-all duration-300 shadow-lg whitespace-nowrap
                    ${enabled
                        ? 'bg-emerald-900/80 border-emerald-500/50 hover:bg-emerald-800/90 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'bg-slate-900/80 border-slate-600/50 hover:bg-slate-800/90 shadow-[0_0_8px_rgba(0,0,0,0.2)]'
                    }
                `}
                title={enabled ? t('hud.autoResponseEnabled') : t('hud.autoResponseDisabled')}
                data-testid="auto-response-toggle"
                aria-pressed={enabled}
                style={{
                    ...buttonStyle,
                    gap: buildBoardShellInlineUnitValue(0.22),
                    paddingInline: buildBoardShellInlineUnitValue(0.55),
                    borderRadius: buildBoardShellInlineUnitValue(0.45),
                }}
            >
                {enabled ? (
                    <Zap className="shrink-0 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]" style={{ width: buildBoardShellInlineUnitValue(0.78), height: buildBoardShellInlineUnitValue(0.78) }} />
                ) : (
                    <ZapOff className="shrink-0 text-slate-400" style={{ width: buildBoardShellInlineUnitValue(0.78), height: buildBoardShellInlineUnitValue(0.78) }} />
                )}
                <span
                    className={`leading-none font-bold ${enabled ? 'text-emerald-300' : 'text-slate-400'}`}
                    style={{ fontSize: buildBoardShellInlineUnitValue(0.56) }}
                >
                    {enabled ? t('hud.manualResponse') : t('hud.autoResponse')}
                </span>
            </button>
        </div>
    );
};
