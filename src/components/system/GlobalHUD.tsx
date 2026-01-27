import { useTranslation } from 'react-i18next';
import { useSocial } from '../../contexts/SocialContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useAuth } from '../../contexts/AuthContext';
import { FriendsChatModal } from '../social/FriendsChatModal';
import { FabMenu } from './FabMenu';
import { AudioControlSection } from '../game/AudioControlSection';
import { MessageSquare, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const GlobalHUD = () => {
    const { t } = useTranslation('game');
    const { unreadTotal, requests } = useSocial();
    const { openModal } = useModalStack();
    const { user } = useAuth();
    const location = useLocation();

    // If in game page, let GameHUD handle the floating menu to avoid duplicates
    if (location.pathname.startsWith('/play/')) {
        return null;
    }

    // Determine theme based on route
    const isGamePage = location.pathname.startsWith('/play/');
    const isDark = isGamePage;

    const totalBadge = unreadTotal + requests.length;

    const btnClass = isDark
        ? "bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-white/90"
        : "bg-black/5 hover:bg-black/10 border border-black/5 hover:border-black/10 text-[#433422] shadow-sm";

    return (
        <FabMenu
            isDark={isDark}
            icon={
                <div className="relative">
                    <Settings size={20} />
                    {totalBadge > 0 && (
                        <span className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full border border-black/50" />
                    )}
                </div>
            }
            activeColor={isDark ? "text-white/80" : "text-[#433422]"}
            className="fixed bottom-8 right-8 z-[9000] flex flex-col items-end gap-2 font-sans"
            titleExpand={t('hud.toggle.expand') || 'Expand'}
            titleCollapse={t('hud.toggle.collapse') || 'Collapse'}
        >
            {/* Social Section */}
            {user && (
                <div className="pt-1 pb-1">
                    <button
                        onClick={() => {
                            openModal({
                                closeOnBackdrop: true,
                                closeOnEsc: true,
                                render: ({ close }) => (
                                    <FriendsChatModal isOpen onClose={close} />
                                ),
                            });
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-semibold text-sm group ${btnClass}`}
                    >
                        <div className="flex items-center gap-2">
                            <MessageSquare size={16} />
                            <span>{t('hud.actions.social') || 'Social'}</span>
                        </div>
                        {totalBadge > 0 && (
                            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] text-white font-bold">
                                {totalBadge > 9 ? '9+' : totalBadge}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Audio Section */}
            <AudioControlSection isDark={isDark} />
        </FabMenu>
    );
};
