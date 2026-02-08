

import { useNavigate } from 'react-router-dom';
import { Hammer, ArrowLeft } from 'lucide-react';
import { SEO } from '../components/common/SEO';

export const MaintenancePage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-parchment-base-bg text-parchment-base-text font-serif flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <SEO title="System Maintenance" description="We are currently upgrading our systems." />

            {/* Background Texture/Effect */}
            <div className="absolute inset-0 opacity-5 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at center, #D4AF37 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}>
            </div>

            <div className="z-10 flex flex-col items-center text-center max-w-lg animate-in fade-in zoom-in duration-700">
                {/* Icon Graphic */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-parchment-brown/20 blur-xl rounded-full"></div>
                    <Hammer size={80} className="text-parchment-brown drop-shadow-md relative z-10 animate-bounce" strokeWidth={1.5} />
                </div>

                {/* Typography */}
                <h1 className="text-3xl md:text-4xl font-bold text-parchment-brown mb-3 tracking-wide">
                    System Maintenance
                </h1>

                <h2 className="text-lg font-bold mb-6 text-parchment-light-text flex items-center gap-2 justify-center">
                    <span className="h-[1px] w-8 bg-parchment-light-text/50"></span>
                    工匠正在修缮大厅
                    <span className="h-[1px] w-8 bg-parchment-light-text/50"></span>
                </h2>

                <p className="text-parchment-base-text/80 mb-8 max-w-md leading-relaxed">
                    我们正在进行必要的维护升级，以确保更稳定的魔法连接。请稍事休息，再战不迟。
                    <br />
                    <span className="text-sm italic text-parchment-light-text mt-2 block">
                        Our scribes are rewriting the scrolls. Please check back soon.
                    </span>
                </p>

                {/* Actions */}
                <button
                    onClick={() => navigate('/')}
                    className="group relative px-6 py-2.5 bg-parchment-brown text-parchment-cream font-bold tracking-widest uppercase text-sm rounded-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                >
                    <span className="flex items-center gap-2">
                        <ArrowLeft size={16} />
                        尝试返回大厅 Return Home
                    </span>
                </button>
            </div>

            {/* Footer / Decor */}
            <div className="absolute bottom-6 text-parchment-light-text/30 text-[10px] tracking-[0.2em] uppercase">
                Status: 503 Service Unavailable
            </div>
        </div>
    );
};

export default MaintenancePage;
