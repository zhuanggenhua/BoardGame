import { useState, useEffect } from 'react';
import { Zap, ZapOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AUTO_RESPONSE_KEY = 'dicethrone:autoResponse';

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
    const [enabled, setEnabled] = useState(() => {
        const stored = localStorage.getItem(AUTO_RESPONSE_KEY);
        // 默认开启（显示响应窗口）
        return stored === null ? true : stored === 'true';
    });

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
        height: '2.1vw',
        minHeight: '0',
        maxHeight: '2.1vw',
        paddingTop: '0',
        paddingBottom: '0',
        appearance: 'none',
        WebkitAppearance: 'none',
        lineHeight: 1,
    } as const;

    return (
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
    );
};

/** 获取当前响应窗口显示设置 */
export const getAutoResponseEnabled = (): boolean => {
    // 服务端环境没有 localStorage，默认开启（显示响应窗口）
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return true;
    }
    const stored = localStorage.getItem(AUTO_RESPONSE_KEY);
    // 默认开启（显示响应窗口）
    return stored === null ? true : stored === 'true';
};
