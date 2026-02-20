import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Github, Heart, MessageCircle, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { createParticle, parseColorToRgb, type Particle } from '../common/animations/canvasParticleEngine';
import { useToast } from '../../contexts/ToastContext';
import { SPONSOR_API_URL } from '../../config/server';
import { UI_Z_INDEX } from '../../core';

interface AboutModalProps {
    onClose: () => void;
}

interface SponsorItem {
    id: string;
    name: string;
    amount: number;
    isPinned: boolean;
    createdAt: string;
}

const ROW_HEIGHT = 48;
const PAGE_SIZE = 50;
const OVERSCAN = 6;

export const AboutModal = ({ onClose }: AboutModalProps) => {
    const { t } = useTranslation('game');
    const { success, error } = useToast();
    const backdropRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const particleCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [sponsors, setSponsors] = useState<SponsorItem[]>([]);
    const [sponsorLoading, setSponsorLoading] = useState(false);
    const [sponsorError, setSponsorError] = useState(false);
    const [containerHeight, setContainerHeight] = useState(0);
    const [startIndex, setStartIndex] = useState(0);
    const [sponsorHasMore, setSponsorHasMore] = useState(true);
    const scrollTopRef = useRef(0);
    const startIndexRef = useRef(0);
    const sponsorLoadingRef = useRef(false);
    const sponsorPageRef = useRef(1);

    const gitUrl = 'https://github.com/zhuanggenhua/BoardGame';
    const qqGroup = '1081373485';

    const handleCopyQq = async () => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(qqGroup);
                success(t('hud.about.qqCopied'));
                return;
            }
            const textarea = document.createElement('textarea');
            textarea.value = qqGroup;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            success(t('hud.about.qqCopied'));
        } catch {
            error(t('hud.about.copyFailed'));
        }
    };

    // 金色荧光粒子 (Canvas 2D) - 预渲染辉光精灵 + additive 混合 + 呼吸脉冲
    // 参考技术：offscreen sprite pre-render + radialGradient + lighter compositing
    // https://tympanus.net/codrops/2018/12/13/ambient-canvas-backgrounds/
    useEffect(() => {
        const canvas = particleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        const getRemBase = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

        const updateSize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = parent.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return { cw: rect.width, ch: rect.height };
        };

        let { cw, ch } = updateSize();

        const resizeObserver = new ResizeObserver(() => {
            const dims = updateSize();
            cw = dims.cw;
            ch = dims.ch;
        });
        resizeObserver.observe(parent);

        const goldRgb = parseColorToRgb('#D4AF37');

        // ---- 预渲染辉光精灵（offscreen canvas + radialGradient）----
        // 比每帧画 arc 性能好很多，且 radialGradient 边缘更柔和自然
        const SPRITE_SIZE = 128;
        const glowSprite = document.createElement('canvas');
        glowSprite.width = SPRITE_SIZE;
        glowSprite.height = SPRITE_SIZE;
        const spriteCtx = glowSprite.getContext('2d')!;
        const half = SPRITE_SIZE / 2;
        const grad = spriteCtx.createRadialGradient(half, half, 0, half, half, half);
        // 三层渐变：核心白热 → 金色 → 透明，模拟真实萤火虫发光
        grad.addColorStop(0, `rgba(${Math.min(255, goldRgb[0] + 80)},${Math.min(255, goldRgb[1] + 70)},${Math.min(255, goldRgb[2] + 60)},1)`);
        grad.addColorStop(0.15, `rgba(${Math.min(255, goldRgb[0] + 40)},${Math.min(255, goldRgb[1] + 30)},${Math.min(255, goldRgb[2] + 20)},0.8)`);
        grad.addColorStop(0.4, `rgba(${goldRgb[0]},${goldRgb[1]},${goldRgb[2]},0.3)`);
        grad.addColorStop(1, `rgba(${goldRgb[0]},${goldRgb[1]},${goldRgb[2]},0)`);
        spriteCtx.fillStyle = grad;
        spriteCtx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

        // 持续飘动的粒子
        const particles: Particle[] = [];
        const COUNT = 18;

        // 每个粒子额外存储：呼吸相位、摆动相位
        const extraData: { breathPhase: number; swayPhase: number; swayAmp: number }[] = [];

        const initParticles = () => {
            const remScale = getRemBase() / 16;
            particles.length = 0;
            extraData.length = 0;
            for (let i = 0; i < COUNT; i++) {
                particles.push(createParticle({
                    x: Math.random() * cw,
                    y: Math.random() * ch,
                    vx: (Math.random() - 0.5) * 0.3 * remScale,
                    vy: -(0.2 + Math.random() * 0.4) * remScale,
                    maxLife: 4 + Math.random() * 5,
                    size: (1.5 + Math.random() * 2.5) * remScale,
                    rgb: goldRgb,
                }));
                extraData.push({
                    breathPhase: Math.random() * Math.PI * 2,
                    swayPhase: Math.random() * Math.PI * 2,
                    swayAmp: (0.3 + Math.random() * 0.5) * remScale,
                });
            }
        };

        initParticles();

        let rafId = 0;
        let lastTime = 0;

        const loop = (now: number) => {
            if (!lastTime) lastTime = now;
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;
            const t = now * 0.001; // 秒级时间，用于 sin 波

            ctx.clearRect(0, 0, cw, ch);
            const remScale = getRemBase() / 16;

            // additive 混合：粒子重叠处自然发亮（参考 tympanus swirl demo）
            ctx.globalCompositeOperation = 'lighter';

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const extra = extraData[i];

                p.life -= dt / p.maxLife;

                // 柔和横向摆动（sin 波），模拟萤火虫飘动轨迹
                const sway = Math.sin(t * 0.8 + extra.swayPhase) * extra.swayAmp;
                p.x += (p.vx + sway * 0.02) * dt * 60;
                p.y += p.vy * dt * 60;

                // 消亡/出界 → 从底部重生
                if (p.life <= 0 || p.y < -10) {
                    p.x = Math.random() * cw;
                    p.y = ch + 5 + Math.random() * 10;
                    p.life = 1;
                    p.maxLife = 4 + Math.random() * 5;
                    p.size = (1.5 + Math.random() * 2.5) * remScale;
                    p.vx = (Math.random() - 0.5) * 0.3 * remScale;
                    p.vy = -(0.2 + Math.random() * 0.4) * remScale;
                    extra.breathPhase = Math.random() * Math.PI * 2;
                    extra.swayPhase = Math.random() * Math.PI * 2;
                    extra.swayAmp = (0.3 + Math.random() * 0.5) * remScale;
                }

                // 呼吸脉冲：大小随 sin 波微微变化，模拟萤火虫明灭
                const breathScale = 1 + Math.sin(t * 2.5 + extra.breathPhase) * 0.25;
                const drawSize = p.size * breathScale;

                // 生命周期透明度：淡入 → 稳定 → 淡出
                const lifeFade = p.life < 0.2 ? p.life / 0.2 : p.life > 0.85 ? (1 - p.life) / 0.15 : 1;
                // 呼吸也影响透明度，亮时更亮暗时更暗
                const breathAlpha = 0.5 + Math.sin(t * 2.5 + extra.breathPhase) * 0.3;
                const alpha = lifeFade * breathAlpha;
                if (alpha < 0.01) continue;

                // 用预渲染精灵绘制辉光（drawImage 比 arc+fill 快，且 radialGradient 边缘更柔和）
                const spriteDrawSize = drawSize * 6;
                ctx.globalAlpha = alpha * 0.7;
                ctx.drawImage(
                    glowSprite,
                    p.x - spriteDrawSize / 2,
                    p.y - spriteDrawSize / 2,
                    spriteDrawSize,
                    spriteDrawSize,
                );

                // 核心亮点（小而亮，增加"发光体"感）
                ctx.globalAlpha = alpha;
                ctx.fillStyle = `rgb(${Math.min(255, goldRgb[0] + 80)},${Math.min(255, goldRgb[1] + 70)},${Math.min(255, goldRgb[2] + 60)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, drawSize * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }

            // 恢复默认混合模式
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(rafId);
            resizeObserver.disconnect();
        };
    }, []);

    const updateStartIndex = useCallback((scrollTop: number) => {
        const nextStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
        if (nextStart !== startIndexRef.current) {
            startIndexRef.current = nextStart;
            setStartIndex(nextStart);
        }
    }, []);

    const loadSponsors = useCallback(async (page: number, replace = false) => {
        if (sponsorLoadingRef.current) return;
        sponsorLoadingRef.current = true;
        setSponsorLoading(true);
        setSponsorError(false);
        try {
            const res = await fetch(`${SPONSOR_API_URL}?page=${page}&limit=${PAGE_SIZE}`);
            if (!res.ok) throw new Error('Failed to fetch sponsors');
            const data = await res.json();
            const items = Array.isArray(data.items) ? (data.items as SponsorItem[]) : [];
            const hasMore = typeof data.hasMore === 'boolean' ? data.hasMore : items.length >= PAGE_SIZE;
            sponsorPageRef.current = page;
            setSponsorHasMore(hasMore);
            setSponsors(prev => (replace ? items : [...prev, ...items]));
        } catch {
            setSponsorError(true);
        } finally {
            sponsorLoadingRef.current = false;
            setSponsorLoading(false);
        }
    }, []);

    const loadMoreSponsors = useCallback(() => {
        if (!sponsorHasMore || sponsorLoadingRef.current) return;
        loadSponsors(sponsorPageRef.current + 1);
    }, [sponsorHasMore, loadSponsors]);

    useEffect(() => {
        loadSponsors(1, true);
    }, [loadSponsors]);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;
        const updateHeight = () => setContainerHeight(element.clientHeight);
        updateHeight();
        const resizeObserver = new ResizeObserver(() => updateHeight());
        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;
        const handleScroll = () => {
            const baseHeight = sponsors.length * ROW_HEIGHT;
            const loopEnabled = !sponsorHasMore && baseHeight > 0;
            let nextScrollTop = element.scrollTop;
            if (loopEnabled && nextScrollTop >= baseHeight) {
                nextScrollTop -= baseHeight;
                element.scrollTop = nextScrollTop;
            }
            scrollTopRef.current = nextScrollTop;
            updateStartIndex(nextScrollTop);
            if (sponsorHasMore && nextScrollTop + containerHeight >= baseHeight - ROW_HEIGHT * 4) {
                loadMoreSponsors();
            }
        };
        element.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => element.removeEventListener('scroll', handleScroll);
    }, [containerHeight, loadMoreSponsors, sponsors.length, updateStartIndex]);

    // 自动轮播逻辑
    useEffect(() => {
        let animationFrameId: number;
        const animate = () => {
            const element = scrollRef.current;
            const baseHeight = sponsors.length * ROW_HEIGHT;
            const loopEnabled = !sponsorHasMore && baseHeight > 0;
            if (element && !isHovered && baseHeight > containerHeight) {
                const speed = 0.8 * Math.max(1, window.innerWidth / 1920);
                let nextScrollTop = element.scrollTop + speed;
                element.scrollTop = nextScrollTop;
                if (loopEnabled && nextScrollTop >= baseHeight) {
                    nextScrollTop -= baseHeight;
                    element.scrollTop = nextScrollTop;
                }
                scrollTopRef.current = nextScrollTop;
                updateStartIndex(nextScrollTop);
                if (sponsorHasMore && nextScrollTop + containerHeight >= baseHeight - ROW_HEIGHT * 4) {
                    loadMoreSponsors();
                }
            }
            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [containerHeight, isHovered, loadMoreSponsors, sponsorHasMore, sponsors.length, updateStartIndex]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (backdropRef.current === e.target) onClose();
    };

    const baseCount = sponsors.length;
    const baseHeight = baseCount * ROW_HEIGHT;
    const loopEnabled = !sponsorHasMore && baseCount > 0 && baseHeight > containerHeight;
    const totalCount = loopEnabled ? baseCount * 2 : baseCount;
    const totalHeight = loopEnabled ? baseHeight * 2 : baseHeight;
    const visibleCount = containerHeight > 0
        ? Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2
        : 0;
    const endIndex = Math.min(totalCount, startIndex + visibleCount);
    const visibleIndexes: number[] = [];
    for (let i = startIndex; i < endIndex; i++) {
        visibleIndexes.push(i);
    }

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-serif"
            style={{ zIndex: UI_Z_INDEX.modalContent }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-parchment-base-bg rounded-xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-parchment-brown/30 flex flex-col max-h-[90vh]"
            >
                {/* 布局规范：h-14 紧凑页眉 */}
                <div className="relative h-14 bg-parchment-brown flex items-center justify-center overflow-hidden border-b border-parchment-gold/20 shrink-0">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-parchment-gold via-transparent to-transparent" />
                    <h2 className="relative text-lg font-bold tracking-widest text-parchment-cream drop-shadow-md">{t('hud.about.title')}</h2>
                    <button onClick={onClose} className="absolute right-4 p-2 text-parchment-cream/60 hover:text-parchment-cream transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin">
                    {/* 布局规范：GitHub & QQ 双列并排 */}
                    <div className="grid grid-cols-2 gap-3">
                        <a
                            href={gitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-xl bg-parchment-card-bg hover:bg-white/80 border border-parchment-brown/10 transition-all group shadow-sm"
                        >
                            <div className="p-2 bg-parchment-base-bg rounded-lg text-parchment-base-text border border-parchment-brown/10 shrink-0">
                                <Github size={20} />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-xs text-parchment-base-text truncate">{t('hud.about.githubTitle')}</h3>
                                <p className="text-[10px] text-parchment-light-text truncate">{t('hud.about.githubSubtitle')}</p>
                            </div>
                        </a>

                        <button
                            type="button"
                            onClick={handleCopyQq}
                            className="flex items-center gap-3 p-3 rounded-xl bg-parchment-card-bg hover:bg-white/80 border border-parchment-brown/10 transition-all group shadow-sm text-left"
                        >
                            <div className="p-2 bg-parchment-base-bg rounded-lg text-[#0099FF] border border-parchment-brown/10 shrink-0">
                                <MessageCircle size={20} />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-xs text-parchment-base-text truncate">{t('hud.about.qqTitle')}</h3>
                                <p className="text-[10px] text-parchment-light-text truncate font-mono">{qqGroup}</p>
                            </div>
                        </button>
                    </div>

                    <div className="pt-4 border-t border-parchment-brown/10 space-y-4">
                        <div className="text-center space-y-1">
                            <div className="flex items-center justify-center gap-2">
                                <Heart size={14} className="text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                                <p className="text-sm font-bold text-parchment-brown leading-snug">{t('hud.about.supportTitle')}</p>
                            </div>
                            <p className="text-[11px] text-parchment-light-text opacity-70">{t('hud.about.supportSubtitle')}</p>
                        </div>

                        <div className="flex justify-center gap-10">
                            {[
                                {
                                    label: t('hud.about.wechatLabel'),
                                    color: 'text-green-600',
                                    src: '/logos/weixin.jpg',
                                    alt: '微信支付二维码'
                                },
                                {
                                    label: t('hud.about.alipayLabel'),
                                    color: 'text-blue-600',
                                    src: '/logos/zhifubao.jpg',
                                    alt: '支付宝支付二维码'
                                }
                            ].map((qr, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-1.5 pt-1">
                                    <div className="w-24 h-24 bg-zinc-100 flex items-center justify-center text-zinc-300 text-[10px] rounded-lg border border-parchment-brown/5 shadow-inner overflow-hidden">
                                        <img
                                            src={qr.src}
                                            alt={qr.alt}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <span className={`text-[10px] font-bold ${qr.color} opacity-80`}>{qr.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Sponsor Area - Bottom */}
                        <div
                            className="relative rounded-xl overflow-hidden border border-parchment-gold/30 bg-parchment-brown/5 shadow-inner h-40"
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            <canvas ref={particleCanvasRef} className="absolute inset-0 pointer-events-none" />

                            <div ref={scrollRef} className="absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-parchment-gold/20">
                                {sponsorLoading && sponsors.length === 0 && (
                                    <div className="py-4 text-xs text-parchment-light-text text-center">{t('hud.about.sponsorLoading')}</div>
                                )}
                                {sponsorError && !sponsorLoading && sponsors.length === 0 && (
                                    <div className="py-4 text-xs text-parchment-light-text text-center">{t('hud.about.sponsorError')}</div>
                                )}
                                {!sponsorLoading && !sponsorError && sponsors.length === 0 && (
                                    <div className="py-4 text-xs text-parchment-light-text text-center">{t('hud.about.sponsorEmpty')}</div>
                                )}
                                {!sponsorError && baseCount > 0 && (
                                    <div className="relative w-full" style={{ height: totalHeight }}>
                                        {visibleIndexes.map((itemIndex) => {
                                            const sponsorIndex = loopEnabled ? itemIndex % baseCount : itemIndex;
                                            const sponsor = sponsors[sponsorIndex];
                                            if (!sponsor) return null;
                                            return (
                                                <div
                                                    key={`${sponsor.id}-${itemIndex}`}
                                                    className="flex items-center justify-center w-full"
                                                    style={{ position: 'absolute', top: itemIndex * ROW_HEIGHT, height: ROW_HEIGHT, left: 0, right: 0 }}
                                                >
                                                    <div className="text-sm font-bold text-parchment-brown/80 flex items-center gap-3 bg-parchment-base-bg/60 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm border border-parchment-gold/20 hover:bg-parchment-base-bg/90 transition-colors cursor-default max-w-max">
                                                        <div className="flex items-center gap-2">
                                                            <Coffee size={12} className="text-parchment-gold" />
                                                            <div className="flex flex-col">
                                                                <span>{sponsor.name}</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-[1px] h-3 bg-parchment-brown/20" />
                                                        <span className="font-mono text-parchment-gold text-xs">¥{sponsor.amount}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {sponsorLoading && sponsors.length > 0 && (
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-parchment-light-text/80 bg-parchment-base-bg/80 px-2 py-0.5 rounded-full">
                                        {t('hud.about.loadMore')}
                                    </div>
                                )}
                            </div>

                            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-parchment-base-bg/10 to-transparent z-10 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-parchment-base-bg/10 to-transparent z-10 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
