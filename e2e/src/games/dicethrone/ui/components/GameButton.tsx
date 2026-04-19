import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { playSound } from '../../../../lib/audio/useGameAudio';

// Dice Throne 风格按钮
// High contrast, bold, distinct shapes

interface GameButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    children?: ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
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

    const baseEffects = "relative overflow-hidden transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 disabled:grayscale";
    const typography = "font-black uppercase tracking-wider text-center leading-none select-none flex items-center justify-center gap-2";

    // 视觉风格 - 参考 Dice Throne
    // Primary: Amber/Gold gradient (Main Action)
    // Danger: Red gradient (Attack/Cancel)
    // Secondary: Blue/Slate (Info/Neutral)

    const variants = {
        primary: "bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300 shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-1 text-white hover:brightness-110",
        danger: "bg-gradient-to-b from-red-500 to-red-700 border border-red-400 shadow-[0_4px_0_#991b1b] active:shadow-none active:translate-y-1 text-white hover:brightness-110",
        secondary: "bg-slate-700 border border-slate-500 shadow-[0_4px_0_#334155] active:shadow-none active:translate-y-1 text-slate-100 hover:bg-slate-600",
        glass: "bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white shadow-sm active:bg-white/5 shadow-black/20",
        ghost: "bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
    };

    const sizes = {
        sm: "text-xs py-2 px-3 rounded-lg min-h-[32px]",
        md: "text-sm py-3 px-6 rounded-xl min-h-[44px]",
        lg: "text-base py-4 px-8 rounded-xl min-h-[56px]"
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
                scale: disabled ? 1 : 1.01,
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
