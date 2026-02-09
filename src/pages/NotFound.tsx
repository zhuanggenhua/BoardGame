
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Map, Home, Compass } from 'lucide-react';
import { SEO } from '../components/common/SEO';

export const NotFound = () => {
    const navigate = useNavigate();
    const { t } = useTranslation('common');

    return (
        <div className="min-h-screen bg-parchment-base-bg text-parchment-base-text font-serif flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <SEO
                title={t('notFound.seoTitle')}
                description={t('notFound.seoDescription')}
            />

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
                    <div className="absolute inset-0 bg-parchment-gold blur-2xl opacity-20 rounded-full animate-pulse"></div>
                    <Map size={120} className="text-parchment-brown/80 drop-shadow-sm relative z-10" strokeWidth={1.5} />
                    <Compass size={48} className="absolute -bottom-2 -right-2 text-parchment-wax drop-shadow-md animate-bounce" strokeWidth={2} />
                </div>

                {/* Typography */}
                <h1 className="text-8xl font-bold text-parchment-brown mb-2 tracking-tighter" style={{ fontFamily: 'var(--font-heading)' }}>
                    404
                </h1>

                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-parchment-base-text">
                    {t('notFound.headline')}
                    <span className="block text-lg font-normal text-parchment-light-text mt-2 italic">
                        {t('notFound.headlineSub')}
                    </span>
                </h2>

                <p className="text-parchment-light-text mb-8 max-w-md leading-relaxed">
                    {t('notFound.description')}
                    <br />
                    {t('notFound.descriptionSub')}
                </p>

                {/* Actions */}
                <button
                    onClick={() => navigate('/')}
                    className="group relative px-8 py-3 bg-parchment-base-text text-parchment-base-bg font-bold tracking-widest uppercase text-sm rounded-sm hover:-translate-y-1 transition-transform duration-300 shadow-lg hover:shadow-xl"
                >
                    <span className="flex items-center gap-2">
                        <Home size={16} />
                        {t('notFound.backHome')}
                    </span>
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-parchment-gold opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-parchment-gold opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
            </div>

            {/* Footer / Decor */}
            <div className="absolute bottom-8 text-parchment-light-text/40 text-xs tracking-[0.2em] uppercase">
                {t('notFound.footer')}
            </div>
        </div>
    );
};

export default NotFound;
