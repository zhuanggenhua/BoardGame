import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../../../lib/utils';

export interface Option {
    label: string;
    value: string;
    icon?: React.ReactNode;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    prefixIcon?: React.ReactNode;
    className?: string;
    disabled?: boolean;
    allOptionLabel?: string;
}

export default function CustomSelect({
    value,
    onChange,
    options,
    placeholder = "Select...",
    prefixIcon,
    className,
    disabled = false,
    allOptionLabel
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (!disabled) setIsOpen(!isOpen);
    };

    return (
        <div className={cn("relative min-w-[140px]", className)} ref={containerRef}>
            <button
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={cn(
                    "w-full flex items-center justify-between px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm transition-all duration-200",
                    "hover:border-indigo-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500",
                    isOpen && "border-indigo-500 ring-2 ring-indigo-500/10",
                    disabled && "opacity-60 cursor-not-allowed bg-zinc-50"
                )}
            >
                <div className="flex items-center gap-2 truncate">
                    {prefixIcon && <span className="text-zinc-400">{prefixIcon}</span>}
                    {selectedOption ? (
                        <span className="text-zinc-900 font-medium truncate">{selectedOption.label}</span>
                    ) : (
                        <span className="text-zinc-400 truncate">{placeholder}</span>
                    )}
                </div>
                <ChevronDown
                    size={16}
                    className={cn(
                        "text-zinc-400 transition-transform duration-200 flex-shrink-0 ml-2",
                        isOpen && "transform rotate-180"
                    )}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute z-50 w-full mt-1 bg-white border border-zinc-100 rounded-xl shadow-xl overflow-hidden py-1 min-w-[160px]"
                    >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            <button
                                type="button"
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left",
                                    "hover:bg-zinc-50",
                                    value === '' ? "bg-indigo-50 text-indigo-600 font-medium" : "text-zinc-500"
                                )}
                            >
                                <span>{allOptionLabel || "All"}</span>
                                {value === '' && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
                            </button>
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left",
                                        "hover:bg-zinc-50",
                                        value === option.value ? "bg-indigo-50 text-indigo-600 font-medium" : "text-zinc-700"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate w-full">
                                        {option.icon}
                                        <span className="truncate">{option.label}</span>
                                    </div>
                                    {value === option.value && (
                                        <Check size={14} className="text-indigo-600 flex-shrink-0 ml-2" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
