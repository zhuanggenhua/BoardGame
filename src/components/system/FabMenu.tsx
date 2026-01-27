import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Settings } from 'lucide-react';

interface FabMenuProps {
    children: ReactNode;
    icon?: ReactNode;
    activeColor?: string; // e.g. 'text-white' or 'text-indigo-400'
    expanded?: boolean;
    onToggle?: (expanded: boolean) => void;
    className?: string; // Positioning
    titleExpand?: string;
    titleCollapse?: string;
    isDark?: boolean;
}

export const FabMenu = ({
    children,
    icon,
    activeColor,
    expanded: controlledExpanded,
    onToggle,
    className = "fixed bottom-8 right-8 z-[10000] flex flex-col items-end gap-2 font-sans",
    titleExpand = "Expand",
    titleCollapse = "Collapse",
    isDark = true
}: FabMenuProps) => {
    const [internalExpanded, setInternalExpanded] = useState(false);
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : internalExpanded;

    const setExpanded = (value: boolean) => {
        if (!isControlled) {
            setInternalExpanded(value);
        }
        if (onToggle) {
            onToggle(value);
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                if (expanded) setExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [expanded]);

    const panelBase = isDark
        ? "bg-black/90 backdrop-blur-xl border border-white/15 text-white"
        : "bg-[#fcfbf9]/95 backdrop-blur-xl border border-[#d3ccba] text-[#433422] shadow-[0_8px_32px_rgba(67,52,34,0.15)]";

    const btnBase = isDark
        ? expanded
            ? 'bg-white/20 border-white/30 text-white ring-2 ring-white/10'
            : 'bg-black/60 border-white/10 text-white/80 hover:bg-black/80 hover:border-white/30 hover:shadow-neon-blue/20'
        : expanded
            ? 'bg-black/10 border-black/20 text-[#433422] ring-2 ring-black/5'
            : 'bg-white/90 border-[#d3ccba] text-[#433422] hover:bg-white hover:border-[#8c7b64] hover:shadow-lg';

    return (
        <motion.div
            ref={containerRef}
            drag
            dragMomentum={false}
            className={className}
        >
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className={`${panelBase} rounded-2xl p-4 shadow-2xl w-[85vw] max-w-[320px] md:min-w-[260px] flex flex-col gap-4 mb-2 cursor-default`}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Trigger Button */}
            <motion.button
                layout
                onClick={() => setExpanded(!expanded)}
                className={`
                    shadow-2xl flex items-center justify-center rounded-full 
                    border backdrop-blur-md transition-all active:scale-95
                    ${btnBase}
                    cursor-grab active:cursor-grabbing w-12 h-12
                `}
                whileHover={{ scale: 1.1 }}
                title={expanded ? titleCollapse : titleExpand}
            >
                <AnimatePresence mode="wait">
                    {expanded ? (
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, rotate: -90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 90 }}
                        >
                            <ChevronRight size={20} className="rotate-90" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="collapsed"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className={`flex items-center justify-center ${activeColor}`}
                        >
                            {icon || <Settings size={20} />}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </motion.div>
    );
};
