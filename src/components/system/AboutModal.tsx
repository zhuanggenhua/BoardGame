import { useRef, useEffect, useState } from 'react';
import { X, Github, Heart, MessageCircle, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createParticle, parseColorToRgb, type Particle } from '../common/animations/canvasParticleEngine';

interface AboutModalProps {
    onClose: () => void;
}

// Mock Sponsor Data
const SPONSORS = [
    { name: "BoardGameFan", amount: 50 },
    { name: "Supporter001", amount: 100 },
    { name: "GamingLife", amount: 200 },
    { name: "RetroPlayer", amount: 66 },
    { name: "DiceKing", amount: 88 },
    { name: "MeepleMaster", amount: 50 },
    { name: "CardShark", amount: 120 },
    { name: "TableTopHero", amount: 500 },
    { name: "Anonymous", amount: 10 },
    { name: "DevSupporter", amount: 1024 },
    { name: "OpenSourceLover", amount: 666 },
    { name: "CoffeeBuyer", amount: 25 },
    { name: "ServerFund", amount: 300 },
    { name: "MaintenanceCrew", amount: 50 },
    { name: "BugHunter", amount: 10 },
    { name: "FeatureRequester", amount: 100 }
];

export const AboutModal = ({ onClose }: AboutModalProps) => {
    const backdropRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const particleCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // 金色背景粒子（Canvas 2D 替代 tsParticles）
    useEffect(() => {
        const canvas = particleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const cw = rect.width;
        const ch = rect.height;
        const goldRgb = parseColorToRgb('#D4AF37');

        // 持续飘动的粒子
        const particles: Particle[] = [];
        const COUNT = 15;
        for (let i = 0; i < COUNT; i++) {
            particles.push(createParticle({
                x: Math.random() * cw,
                y: Math.random() * ch,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -(0.3 + Math.random() * 0.5),
                maxLife: 3 + Math.random() * 4,
                size: 1 + Math.random() * 2,
                rgb: goldRgb,
            }));
        }

        let rafId = 0;
        let lastTime = 0;

        const loop = (now: number) => {
            if (!lastTime) lastTime = now;
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            ctx.clearRect(0, 0, cw, ch);

            for (const p of particles) {
                p.life -= dt / p.maxLife;
                p.x += p.vx * dt * 60;
                p.y += p.vy * dt * 60;

                // 循环：消亡后从底部重生
                if (p.life <= 0 || p.y < -5) {
                    p.x = Math.random() * cw;
                    p.y = ch + 5;
                    p.life = 1;
                    p.maxLife = 3 + Math.random() * 4;
                    p.size = 1 + Math.random() * 2;
                }

                const alpha = Math.min(1, p.life * 1.5) * 0.6;
                if (alpha < 0.01) continue;

                // 辉光
                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = `rgb(${goldRgb[0]},${goldRgb[1]},${goldRgb[2]})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
                ctx.fill();

                // 核心
                ctx.globalAlpha = alpha;
                ctx.fillStyle = `rgb(${Math.min(255, goldRgb[0] + 60)},${Math.min(255, goldRgb[1] + 50)},${Math.min(255, goldRgb[2] + 40)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1;
            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    // Auto-scroll logic (Robust 1/3 reset for seamless triplicated loop)
    useEffect(() => {
        let animationFrameId: number;

        const animate = () => {
            const element = scrollRef.current;
            if (element && !isHovered) {
                element.scrollTop += 1.5;
                // Reset when scrolled past the first set (1/3 of total height)
                if (element.scrollTop >= element.scrollHeight / 3) {
                    element.scrollTop -= element.scrollHeight / 3;
                }
            }
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isHovered]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (backdropRef.current === e.target) {
            onClose();
        }
    };

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-serif"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-parchment-base-bg rounded-xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-parchment-brown/30 flex flex-col max-h-[90vh]"
            >
                {/* Header - Shrunk to h-16, Title: 易桌游 */}
                <div className="relative h-16 bg-parchment-brown flex items-center justify-center overflow-hidden border-b border-parchment-gold/20 shrink-0">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-parchment-gold via-transparent to-transparent" />

                    <div className="relative text-center text-parchment-cream">
                        <h2 className="text-xl font-bold tracking-widest drop-shadow-md">易桌游</h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-1/2 -translate-y-1/2 right-4 p-2 text-parchment-cream/60 hover:text-parchment-cream hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto scrollbar-thin">
                    <div className="space-y-4">
                        <a
                            href="https://github.com/your-repo/boardgame"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 rounded-xl bg-parchment-card-bg hover:bg-white/80 border border-parchment-brown/10 transition-colors group shadow-sm hover:shadow-md"
                        >
                            <div className="p-3 bg-parchment-base-bg rounded-lg text-parchment-base-text group-hover:scale-110 transition-transform border border-parchment-brown/10">
                                <Github size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-parchment-base-text">GitHub</h3>
                                <p className="text-xs text-parchment-light-text">查看源码并参与贡献</p>
                            </div>
                        </a>

                        <div className="flex items-center gap-4 p-4 rounded-xl bg-parchment-card-bg hover:bg-white/80 border border-parchment-brown/10 transition-colors group shadow-sm hover:shadow-md">
                            <div className="p-3 bg-parchment-base-bg rounded-lg text-[#0099FF] group-hover:scale-110 transition-transform border border-parchment-brown/10">
                                <MessageCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-parchment-base-text">QQ群</h3>
                                <p className="text-xs text-parchment-light-text">加入社区：<span className="font-mono font-bold text-parchment-brown">123456789</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Support & Sponsors */}
                    <div className="pt-6 border-t border-parchment-brown/10 space-y-6">

                        {/* Text Header with Heart - Centered using 3-column Grid */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                                <div className="flex justify-end pr-2">
                                    <Heart size={16} className="text-rose-500 fill-rose-500 animate-pulse" />
                                </div>
                                <p className="text-sm font-bold text-parchment-brown leading-relaxed text-center">
                                    如果喜欢这个项目，可以支持一点维护服务器的钱。
                                </p>
                                <div /> {/* Empty div to balance the grid for centering */}
                            </div>
                            <p className="text-xs font-normal text-parchment-light-text opacity-80 text-center">
                                我会在下面展示您的昵称信息
                            </p>
                        </div>

                        {/* QR Codes - Large (w-32, h-32), No Border */}
                        <div className="flex justify-center gap-8">
                            <div className="flex flex-col items-center gap-2">
                                {/* Placeholder for Wechat QR */}
                                <div className="w-32 h-32 bg-zinc-100 flex items-center justify-center text-zinc-300 text-sm rounded-lg overflow-hidden">
                                    {/* Add actual QR image here later */}
                                    QR
                                </div>
                                <span className="text-xs text-parchment-light-text font-bold">微信/WeChat</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                {/* Placeholder for Alipay QR */}
                                <div className="w-32 h-32 bg-zinc-100 flex items-center justify-center text-zinc-300 text-sm rounded-lg overflow-hidden">
                                    {/* Add actual QR image here later */}
                                    QR
                                </div>
                                <span className="text-xs text-parchment-light-text font-bold">支付宝/Alipay</span>
                            </div>
                        </div>

                        {/* Sponsor Area - Bottom */}
                        <div
                            className="relative rounded-xl overflow-hidden border border-parchment-gold/30 bg-parchment-brown/5 shadow-inner h-40"
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            {/* 粒子背景（Canvas 2D） */}
                            <canvas
                                ref={particleCanvasRef}
                                className="absolute inset-0 pointer-events-none"
                            />

                            {/* Scrolling List Container */}
                            <div
                                ref={scrollRef}
                                className="absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-parchment-gold/20"
                            >
                                <div className="flex flex-col items-center w-full">
                                    {/* Triplicated list for seamless scrolling with buffer */}
                                    {[...SPONSORS, ...SPONSORS, ...SPONSORS].map((sponsor, i) => (
                                        <div key={i} className="py-2 w-full flex justify-center">
                                            <div className="text-sm font-bold text-parchment-brown/80 flex items-center gap-3 bg-parchment-base-bg/60 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm border border-parchment-gold/20 hover:bg-parchment-base-bg/90 transition-colors cursor-default max-w-max">
                                                <div className="flex items-center gap-1.5">
                                                    <Coffee size={12} className="text-parchment-gold" />
                                                    <span>{sponsor.name}</span>
                                                </div>
                                                <div className="w-[1px] h-3 bg-parchment-brown/20" />
                                                <span className="font-mono text-parchment-gold text-xs">¥{sponsor.amount}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Gradient Fade Masks */}
                            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-parchment-base-bg/10 to-transparent z-10 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-parchment-base-bg/10 to-transparent z-10 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
