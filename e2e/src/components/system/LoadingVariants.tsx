import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Wand2, Star, Settings } from 'lucide-react';

// ----------------------------------------------------------------------
// [内部基准] - 仅作为基础逻辑支撑
// ----------------------------------------------------------------------

const BaseArcaneCircle = ({ className, size = 'md' }: { className?: string, size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
    const sizeMap = { sm: 'w-10 h-10', md: 'w-24 h-24', lg: 'w-32 h-32', xl: 'w-56 h-56' };
    return (
        <div className={clsx("relative flex items-center justify-center", sizeMap[size], className)}>
            <motion.div className="absolute w-full h-full bg-amber-500/5 rounded-full blur-[40px]" animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.8, 1.1, 0.8] }} transition={{ duration: 4, repeat: Infinity }} />
            <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}>
                <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-amber-500/40 stroke-[0.4] overflow-visible">
                    <circle cx="50" cy="50" r="48" strokeDasharray="4 8" />
                    <path d="M50 2 A48 48 0 0 1 98 50" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M50 98 A48 48 0 0 1 2 50" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </motion.div>
            <motion.div className="absolute inset-[15%]" animate={{ rotate: -360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }}>
                <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-amber-400/60 stroke-[0.8]"><rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" /><rect x="25" y="25" width="50" height="50" /></svg>
            </motion.div>
        </div>
    );
};

// ----------------------------------------------------------------------
// [生产资产区] - 严禁乱动，当前正式版本
// ----------------------------------------------------------------------

// 1. LoadingArcaneAether (合格法阵 - 复合叠加版)
export const LoadingArcaneAether = ({ className }: { className?: string }) => {
    return (
        <div className={clsx("relative w-64 h-64 flex items-center justify-center", className)}>
            {[...Array(16)].map((_, i) => (
                <motion.div key={i} className="absolute w-1 h-1 bg-amber-300 rounded-full blur-[0.5px]" animate={{ x: [0, Math.cos(i * 22.5) * 80, 0], y: [0, Math.sin(i * 22.5) * 80, 0], opacity: [0, 0.8, 0], scale: [0.5, 1.2, 0.5] }} transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: i * 0.1 }} />
            ))}
            <BaseArcaneCircle />
            <div className="absolute w-4 h-4 bg-amber-600 rounded-full blur-[2px] shadow-[0_0_20px_#f59e0b] animate-pulse" />
        </div>
    );
};

// 默认导出作为全局加载动画
export default LoadingArcaneAether;

// 2. LoadingArcaneGrandmaster (究极法阵 - 仪式感加强)
export const LoadingArcaneGrandmaster = ({ className }: { className?: string }) => {
    return (
        <div className={clsx("relative w-80 h-80 flex items-center justify-center", className)}>
            <motion.div className="absolute inset-[-10%] opacity-10" animate={{ rotate: 360, scale: [0.9, 1.1, 0.9] }} transition={{ duration: 40, repeat: Infinity }}>
                <svg viewBox="0 0 200 200" className="w-full h-full stroke-amber-500 stroke-[0.5] fill-none">
                    <circle cx="100" cy="100" r="95" strokeDasharray="2 10" />
                    {[...Array(12)].map((_, i) => (
                        <text key={i} x="100" y="20" fontSize="12" className="fill-amber-500 font-mono" transform={`rotate(${i * 30} 100 100)`}>
                            {['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚻ', 'ᛁ', 'ᛃ'][i]}
                        </text>
                    ))}
                </svg>
            </motion.div>
            <LoadingArcaneAether className="scale-110" />
            <motion.div className="absolute inset-0 border border-amber-500/10 rounded-full" animate={{ scale: [1, 1.4], opacity: [0.5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }} />
        </div>
    );
};

// 3. LoadingMagicTrickCards (魔术飞牌)
export const LoadingMagicTrickCards = ({ className }: { className?: string }) => {
    return (
        <div className={clsx("relative w-80 h-80 flex items-center justify-center perspective-[1200px]", className)}>
            <motion.div className="absolute z-20 text-amber-500/20" animate={{ scale: [0.9, 1.1, 0.9], rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}><Wand2 className="w-16 h-16" /></motion.div>
            {[...Array(12)].map((_, i) => (
                <motion.div key={i} className="absolute w-14 h-20 bg-white border border-amber-700/10 rounded shadow-2xl flex items-center justify-center" initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1, 1, 0.8], x: [0, (Math.random() - 0.5) * 350], y: [0, (Math.random() - 0.5) * 350], rotateX: [0, 720], rotateY: [0, 1080] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.25, ease: "easeOut" }} style={{ transformStyle: 'preserve-3d' }}>
                    <Star className="w-6 h-6 text-amber-500/10" />
                </motion.div>
            ))}
        </div>
    );
};

// 4. LoadingCelestialOrrery (太阳系模拟 - 写实 Pro Max Master)
export const LoadingCelestialOrrery = ({ className }: { className?: string }) => {
    const planets = [
        { name: 'Mercury', r: 40, speed: 2.1, size: 3, color: '#94a3b8', tilt: 7 },
        { name: 'Venus', r: 65, speed: 4.8, size: 5, color: '#fcd34d', tilt: 3.4 },
        { name: 'Earth', r: 95, speed: 7.5, size: 6, color: '#3b82f6', tilt: 0 },
        { name: 'Mars', r: 125, speed: 14, size: 4, color: '#ef4444', tilt: 1.8 },
        { name: 'Jupiter', r: 180, speed: 40, size: 18, color: '#fdba74', tilt: 1.3 },
        { name: 'Saturn', r: 240, speed: 100, size: 15, color: '#fef3c7', tilt: 2.5, hasRing: true },
        { name: 'Uranus', r: 290, speed: 280, size: 9, color: '#a5f3fc', tilt: 0.8 },
        { name: 'Neptune', r: 340, speed: 500, size: 9, color: '#3b82f6', tilt: 1.8 },
    ];

    return (
        <div className={clsx("relative w-full h-full min-h-[600px] flex items-center justify-center overflow-hidden bg-[#02020a] scale-[0.85] translate-y-4", className)}>
            {/* 动态星空 */}
            {[...Array(100)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-0.5 h-0.5 bg-white rounded-full"
                    style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
                    animate={{ opacity: [0.1, 0.4, 0.1] }}
                    transition={{ duration: 2 + Math.random() * 3, repeat: Infinity }}
                />
            ))}

            {/* 太阳核心 */}
            <div className="absolute w-20 h-20 bg-amber-500 rounded-full shadow-[0_0_150px_#f59e0b] z-20">
                <motion.div className="w-full h-full bg-orange-400 rounded-full blur-[10px]" animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.9, 0.3] }} transition={{ duration: 4, repeat: Infinity }} />
            </div>

            {/* 轨道与行星 */}
            {planets.map((p, i) => (
                <div
                    key={i}
                    className="absolute border border-white/[0.04] rounded-full"
                    style={{
                        width: p.r * 2.5,
                        height: p.r * 2.5,
                        transform: `rotateX(82deg) rotateY(${p.tilt}deg)`
                    }}
                >
                    <motion.div
                        className="absolute inset-0"
                        animate={{ rotate: 360 }}
                        transition={{ duration: p.speed, repeat: Infinity, ease: "linear" }}
                    >
                        <div
                            className="absolute top-0 left-1/2 flex items-center justify-center"
                            style={{
                                marginTop: -p.size / 2,
                                marginLeft: -p.size / 2,
                            }}
                        >
                            {/* 行星本体 */}
                            <div
                                className="rounded-full shadow-2xl relative"
                                style={{
                                    width: p.size, height: p.size, background: p.color,
                                    boxShadow: `0 0 ${p.size * 1.5}px ${p.color}aa, inset -${p.size / 4}px -${p.size / 4}px ${p.size / 2}px rgba(0,0,0,0.5)`
                                }}
                            >
                                {/* 土星环 */}
                                {p.hasRing && (
                                    <div className="absolute top-1/2 left-1/2 w-[240%] h-[30%] border-[3px] border-white/20 rounded-full -translate-x-1/2 -translate-y-1/2 rotate-[25deg]" />
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            ))}
        </div>
    );
};

// 5. LoadingSteampunkClock (机械朋克 - 镂空大师版 V2)
// 极致机械朋克风格：深邃骨架，多层差速联动，无齿轮刻度
export const LoadingSteampunkClock = ({ className }: { className?: string }) => {
    return (
        <div className={clsx("relative w-[450px] h-[450px] flex items-center justify-center scale-90", className)}>
            {/* 1. 外部机械表壳 (Cyberpunk 重金属质感) */}
            <div className="absolute inset-0 rounded-full bg-slate-950 border-[16px] border-zinc-900 shadow-[inset_0_0_50px_black,20px_20px_60px_rgba(0,0,0,0.8)]">
                {/* 线条装饰环 */}
                <div className="absolute inset-[-4px] border-[2px] border-amber-600/30 rounded-full" />
                <div className="absolute inset-[8%] border-[1px] border-zinc-700/40 rounded-full" />
                {/* 刻度槽位 */}
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="absolute w-1.5 h-6 bg-amber-600/40 top-0 left-1/2 -translate-x-1/2 origin-[0_209px]" style={{ transform: `rotate(${i * 30}deg)` }} />
                ))}
            </div>

            {/* 2. 底层动态骨架 (差速齿轮联动) */}
            <div className="absolute inset-[15%] rounded-full opacity-40 mix-blend-screen">
                <motion.div className="absolute top-[-10%] left-[-10%] text-zinc-900" animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }}>
                    <Settings className="w-56 h-56 stroke-[0.5]" />
                </motion.div>
                <motion.div className="absolute bottom-0 right-0 text-zinc-800" animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}>
                    <Settings className="w-40 h-40 stroke-[0.8]" />
                </motion.div>
                <motion.div className="absolute top-[20%] right-[-10%] text-zinc-700" animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }}>
                    <Settings className="w-24 h-24 stroke-[1.5]" />
                </motion.div>
                {/* 额外的微型联动齿轮 */}
                <motion.div className="absolute top-[50%] left-[20%] text-amber-900/40" animate={{ rotate: -360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                    <Settings className="w-16 h-16 stroke-[1]" />
                </motion.div>
            </div>

            {/* 3. 镂空表盘与高级刻度 (哈希线 + 罗马数字) */}
            <div className="absolute inset-[10%] pointer-events-none flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                    {/* 精细分秒线 */}
                    {[...Array(60)].map((_, i) => (
                        <line
                            key={i}
                            x1="100" y1="5" x2="100" y2={i % 5 === 0 ? "18" : "12"}
                            stroke={i % 5 === 0 ? "#f59e0b" : "#4b5563"}
                            strokeWidth={i % 5 === 0 ? "1.5" : "0.5"}
                            transform={`rotate(${i * 6} 100 100)`}
                        />
                    ))}
                    {/* 品牌标识/中心环 */}
                    <circle cx="100" cy="100" r="25" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 4" className="opacity-30" />
                    {/* 指引数字 */}
                    {[12, 3, 6, 9].map((n, i) => (
                        <text key={i} x="100" y="42" fontSize="14" fill="#f59e0b" textAnchor="middle" transform={`rotate(${i * 90} 100 100)`} className="font-serif italic font-black shadow-lg">
                            {['XII', 'III', 'VI', 'IX'][i]}
                        </text>
                    ))}
                </svg>
            </div>

            {/* 4. 核心微型反应堆 (中心发光) */}
            <div className="absolute w-40 h-40 flex items-center justify-center pointer-events-none">
                <div className="absolute w-24 h-24 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
                <motion.div
                    className="absolute text-amber-500/10"
                    animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                >
                    <Settings className="w-48 h-48 stroke-[0.3]" />
                </motion.div>
            </div>

            {/* 5. 朋克大师指针组件 (极致细节) */}
            <div className="absolute w-full h-full pointer-events-none z-10">
                {/* 时针 (宽体镂空) */}
                <motion.div
                    className="absolute top-1/2 left-1/2 w-8 h-32 origin-bottom -translate-x-1/2 -translate-y-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3600 * 12, repeat: Infinity, ease: "linear" }}
                >
                    <div className="w-full h-full border-[3px] border-zinc-400 rounded-full relative overflow-hidden flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
                        <div className="w-1 h-[70%] bg-zinc-600 rounded-full" />
                        <div className="absolute top-2 w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_10px_#f59e0b]" />
                    </div>
                </motion.div>
                {/* 分针 (锐利双层) */}
                <motion.div
                    className="absolute top-1/2 left-1/2 w-4 h-[180px] origin-bottom -translate-x-1/2 -translate-y-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3600, repeat: Infinity, ease: "linear" }}
                >
                    <div className="w-full h-full bg-gradient-to-t from-zinc-800 via-zinc-400 to-zinc-100 rounded-full shadow-2xl relative">
                        <div className="absolute inset-[25%] bg-black/40 rounded-full" />
                    </div>
                </motion.div>
                {/* 秒针 (琥珀激光线 + 平衡舵) */}
                <motion.div
                    className="absolute top-1/2 left-1/2 w-[2px] h-[210px] bg-amber-500 origin-bottom -translate-x-1/2 -translate-y-full shadow-[0_0_15px_#f59e0b]"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                >
                    <div className="w-4 h-4 bg-amber-500 rounded-full border-[3px] border-black absolute -top-2 left-1/2 -translate-x-1/2 shadow-lg" />
                    <div className="w-3 h-16 bg-amber-900/60 absolute bottom-[-15px] left-1/2 -translate-x-1/2 rounded-full border border-amber-500/20" />
                </motion.div>
            </div>

            {/* 6. 中心轴承盖 */}
            <div className="absolute w-12 h-12 bg-zinc-950 rounded-full border-[6px] border-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.5)] z-20 flex items-center justify-center">
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse blur-[1px]" />
                <div className="absolute inset-1 border border-white/10 rounded-full" />
            </div>
        </div>
    );
};
