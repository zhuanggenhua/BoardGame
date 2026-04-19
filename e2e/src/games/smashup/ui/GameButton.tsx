import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { playSound } from '../../../lib/audio/useGameAudio';

/**
 * 大杀四方 - 游戏按钮组件
 * 
 * 风格：参考 DiceThrone，使用渐变 + 3D 阴影效果
 * - primary: 深灰色渐变（主要操作）
 * - secondary: 浅灰色（次要操作）
 * - danger: 红色渐变（危险操作）
 */

interface GameButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    children?: ReactNode;
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    icon?: ReactNode;
    /** 默认播放点击音效，传 null 关闭 */
    clickSoundKey?: string | null;
}

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(({
    children,
    className,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    icon,
    disabled,
    clickSoundKey,
    onClick,
    ...props
}, ref) => {

    const baseEffects = "relative overflow-hidden transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 disabled:grayscale cursor-pointer";
    const typography = "font-black uppercase tracking-tighter text-center leading-none select-none flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-slate-900 border border-slate-700 shadow-[0_4px_0_#334155] active:shadow-none active:translate-y-1 text-white hover:bg-black",
        secondary: "bg-slate-200 border border-slate-300 shadow-[0_4px_0_#94a3b8] active:shadow-none active:translate-y-1 text-slate-800 hover:bg-slate-300",
        danger: "bg-gradient-to-b from-red-500 to-red-700 border border-red-400 shadow-[0_4px_0_#991b1b] active:shadow-none active:translate-y-1 text-white hover:brightness-110",
    };

    const sizes = {
        sm: "text-xs py-2 px-3 rounded min-h-[32px]",
        md: "text-sm py-2.5 px-5 rounded min-h-[40px]",
        lg: "text-xl py-4 px-6 rounded min-h-[48px]"
    };

    const resolvedClickSoundKey = clickSoundKey === undefined
        ? 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none'
        : clickSoundKey;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled && resolvedClickSoundKey) {
            playSound(resolvedClickSoundKey);
        }
        onClick?.(event);
    };

    return (
        <motion.button
            ref={ref}
            className={clsx(
                baseEffects,
                typography,
                variants[variant],
                sizes[size],
                fullWidth && "w-full",
                className
            )}
            whileHover={{
                scale: disabled ? 1 : 1.02,
                filter: "brightness(1.05)"
            }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            disabled={disabled}
            onClick={handleClick}
            {...props}
        >
            {icon && <span className="text-[1.2em]">{icon}</span>}
            {children}
        </motion.button>
    );
});

GameButton.displayName = 'GameButton';
