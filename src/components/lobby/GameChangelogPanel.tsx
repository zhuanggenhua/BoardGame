import { useTranslation } from 'react-i18next';

interface GameChangelogPanelProps {
    gameId: string;
}

export const GameChangelogPanel = ({ gameId: _gameId }: GameChangelogPanelProps) => {
    const { t } = useTranslation('lobby');

    return (
        <div className="px-0.5 py-2 text-sm leading-6 text-[#8c7b64]">
            {t('leaderboard.changelogEmpty')}
        </div>
    );
};
