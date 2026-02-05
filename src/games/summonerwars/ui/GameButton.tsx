import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

/**
 * 召唤师战争 - 游戏按钮组件
 * 
 * 风格：参考 DiceThrone，使用渐变 + 3D 阴影效果
 * - primary: 琥珀色渐变（主要操作）
 * - secondary: 深灰色（次要操作）
 * - danger: 红色渐变（危险操作）
 */

interface GameButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    children?: ReactNode;
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    icon?: ReactNode;
}

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(({
    children,
    className,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    icon,
    disabled,
    ...props
}, ref) => {

    const baseEffects = "relative overflow-hidden transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 disabled:grayscale cursor-pointer";
    const typography = "font-bold uppercase tracking-wide text-center leading-none select-none flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300 shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-1 text-white hover:brightness-110",
        secondary: "bg-slate-700 border border-slate-500 shadow-[0_4px_0_#334155] active:shadow-none active:translate-y-1 text-slate-100 hover:bg-slate-600",
        danger: "bg-gradient-to-b from-red-500 to-red-700 border border-red-400 shadow-[0_4px_0_#991b1b] active:shadow-none active:translate-y-1 text-white hover:brightness-110",
    };

    const sizes = {
        sm: "text-xs py-2 px-3 rounded-lg min-h-[32px]",
        md: "text-sm py-2.5 px-5 rounded-xl min-h-[40px]",
        lg: "text-base py-3 px-6 rounded-xl min-h-[48px]"
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
            {...props}
        >
            {icon && <span className="text-[1.2em]">{icon}</span>}
            {children}
        </motion.button>
    );
});

GameButton.displayName = 'GameButton';
