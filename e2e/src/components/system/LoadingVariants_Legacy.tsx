import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';

// ----------------------------------------------------------------------
// [备选方案区域] - 归档之前尝试过的版本
// ----------------------------------------------------------------------

export const LoadingArcaneCircle = ({ className, size = 'md' }: { className?: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
    const sizeMap = { sm: 'w-8 h-8', md: 'w-16 h-16', lg: 'w-24 h-24', xl: 'w-48 h-48' };
    return (
        <div className={clsx("relative flex items-center justify-center", sizeMap[size], className)}>
            <motion.div className="absolute w-full h-full bg-amber-500/5 rounded-full blur-[20px]" animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 3, repeat: Infinity }} />
            <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }}>
                <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-amber-500/60 stroke-[0.5] overflow-visible">
                    <circle cx="50" cy="50" r="48" strokeDasharray="2 4" strokeOpacity="0.5" />
                    <path d="M50 2 A48 48 0 0 1 98 50" strokeWidth="1" strokeLinecap="round" />
                    <path d="M50 98 A48 48 0 0 1 2 50" strokeWidth="1" strokeLinecap="round" />
                </svg>
            </motion.div>
        </div>
    );
};

export const LoadingCelestialOrrery = ({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg', className?: string }) => {
    const scale = { sm: 0.5, md: 1, lg: 1.5 }[size];
    return (
        <div className={clsx("relative flex items-center justify-center", className)} style={{ width: 100 * scale, height: 100 * scale }}>
            <motion.div className="absolute w-full h-full border border-amber-500/20 rounded-full" style={{ rotateX: 65, rotateY: 25 }} animate={{ rotateZ: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
                <div className="absolute -top-1 left-1/2 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
            </motion.div>
            <motion.div className="absolute w-[70%] h-[70%] border border-amber-400/30 rounded-full" style={{ rotateX: -45, rotateY: 35 }} animate={{ rotateZ: -360 }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }}>
                <div className="absolute -bottom-1 left-1/2 w-1.5 h-1.5 bg-amber-200 rounded-full" />
            </motion.div>
            <motion.div className="w-4 h-4 bg-amber-500 rounded-full shadow-[0_0_20px_#f59e0b]" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} />
        </div>
    );
};

export const LoadingEtherealSwarm = ({ count = 16, className }: { count?: number, className?: string }) => {
    return (
        <div className={clsx("relative w-24 h-24 flex items-center justify-center", className)}>
            <AnimatePresence>
                {[...Array(count)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-amber-400 rounded-full"
                        animate={{
                            opacity: [0, 1, 0],
                            x: [0, Math.cos(i * 22.5) * (30 + Math.random() * 20), 0],
                            y: [0, Math.sin(i * 22.5) * (30 + Math.random() * 20), 0],
                            scale: [0.5, 1.5, 0.5]
                        }}
                        transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: i * 0.1 }}
                        style={{ filter: 'blur(0.5px)', boxShadow: '0 0 5px #f59e0b' }}
                    />
                ))}
            </AnimatePresence>
            <div className="w-2 h-2 bg-amber-600 rounded-full blur-[2px]" />
        </div>
    );
};

export const LoadingVolumetricVortex = ({ className }: { className?: string }) => {
    return (
        <div className={clsx("relative w-48 h-48 flex items-center justify-center perspective-[1200px]", className)}>
            <div className="relative w-full h-full transform-style-3d rotate-x-[60deg]">
                {[...Array(4)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute inset-0 border-[2px] rounded-full border-amber-500/20"
                        style={{ translateZ: i * -20, scale: 1 - i * 0.1 }}
                        animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
                        transition={{ duration: 10 + i * 2, repeat: Infinity, ease: "linear" }}
                    />
                ))}
            </div>
        </div>
    );
};

export const LoadingTrue3DDice = ({ className }: { className?: string }) => {
    const faces = [
        { rot: 'rotateY(0deg)', offset: 'translateZ(20px)' },
        { rot: 'rotateY(180deg)', offset: 'translateZ(20px)' },
        { rot: 'rotateY(90deg)', offset: 'translateZ(20px)' },
        { rot: 'rotateY(-90deg)', offset: 'translateZ(20px)' },
        { rot: 'rotateX(90deg)', offset: 'translateZ(20px)' },
        { rot: 'rotateX(-90deg)', offset: 'translateZ(20px)' },
    ];
    return (
        <div className={clsx("w-20 h-20 flex items-center justify-center perspective-[600px]", className)}>
            <motion.div
                className="relative w-10 h-10 transform-style-3d"
                animate={{ rotateX: [0, 360], rotateY: [0, 360] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
                {faces.map((f, i) => (
                    <div
                        key={i}
                        className="absolute inset-0 bg-amber-900 border border-amber-500 flex items-center justify-center"
                        style={{ transform: `${f.rot} ${f.offset}`, backfaceVisibility: 'visible' }}
                    >
                        <span className="text-amber-400 text-[10px]">{i + 1}</span>
                    </div>
                ))}
            </motion.div>
        </div>
    );
};

export const LoadingCardHelix = ({ className }: { className?: string }) => {
    return (
        <div className={clsx("relative w-48 h-48 flex items-center justify-center perspective-[800px]", className)}>
            {[...Array(4)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-8 h-12 bg-[#e5e0d0] border border-amber-600/30 rounded-sm"
                    animate={{
                        y: [-40, 40],
                        rotateY: [0, 360],
                        rotateZ: [i * 90, i * 90 + 360],
                    }}
                    transition={{ duration: 4, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
                />
            ))}
        </div>
    );
};
