import { useState, type ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type'> {
    wrapperClassName?: string;
    toggleButtonClassName?: string;
    toggleButtonTestId?: string;
    showLabel?: string;
    hideLabel?: string;
    iconSize?: number;
}

export const PasswordField = ({
    wrapperClassName,
    toggleButtonClassName,
    toggleButtonTestId,
    showLabel = '显示密码',
    hideLabel = '隐藏密码',
    iconSize = 18,
    className,
    ...inputProps
}: PasswordFieldProps) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className={clsx('relative', wrapperClassName)}>
            <input
                {...inputProps}
                type={isVisible ? 'text' : 'password'}
                className={clsx(className, 'pr-11')}
            />
            <button
                type="button"
                aria-label={isVisible ? hideLabel : showLabel}
                aria-pressed={isVisible}
                data-testid={toggleButtonTestId}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setIsVisible((current) => !current)}
                className={clsx(
                    'absolute inset-y-0 right-0 flex items-center justify-center px-3 text-[#8c7b64] transition-colors hover:text-[#433422] focus:outline-none cursor-pointer',
                    toggleButtonClassName,
                )}
            >
                {isVisible ? <EyeOff size={iconSize} /> : <Eye size={iconSize} />}
            </button>
        </div>
    );
};
