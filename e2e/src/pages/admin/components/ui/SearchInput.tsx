import { Search, X } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useState, useEffect, useRef } from 'react';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value?: string;
    onChange?: (value: string) => void;
    onSearch?: (value: string) => void;
    debounceMs?: number;
    className?: string;
}

export default function SearchInput({
    className,
    value: propValue,
    onChange,
    onSearch,
    debounceMs = 500,
    ...props
}: SearchInputProps) {
    const [localValue, setLocalValue] = useState<string>(propValue || '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debounceTimerRef = useRef<any>(null);

    useEffect(() => {
        if (propValue !== undefined) {
            setLocalValue(propValue);
        }
    }, [propValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        if (onChange) onChange(newValue);

        if (onSearch) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                onSearch(newValue);
            }, debounceMs);
        }
    };

    const handleClear = () => {
        setLocalValue('');
        if (onChange) onChange('');
        if (onSearch) {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            onSearch('');
        }
    };

    return (
        <div className={cn("relative group w-full max-w-sm", className)}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none">
                <Search size={16} />
            </div>
            <input
                {...props}
                value={localValue}
                onChange={handleChange}
                className={cn(
                    "w-full bg-white border border-zinc-200 text-zinc-900 text-sm rounded-xl pl-9 pr-8 py-2 transition-all duration-200",
                    "placeholder:text-zinc-400/80",
                    "focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-indigo-300 shadow-sm",
                    className
                )}
            />
            {localValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full p-0.5 transition-colors"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
