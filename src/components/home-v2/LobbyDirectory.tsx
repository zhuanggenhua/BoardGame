import type { GameConfig } from '../../config/games.config';
import { GameListCard } from '../lobby/GameList';

const BOOK_GAME_SLOT_TRANSFORMS = [
    { x: '-4.5%', y: '4.5%', rotate: '-2deg' },
    { x: '0%', y: '-2.8%', rotate: '0deg' },
    { x: '4.5%', y: '-3.4%', rotate: '0deg' },
    { x: '-3%', y: '2.2%', rotate: '-1.4deg' },
    { x: '0%', y: '-4.2%', rotate: '0deg' },
    { x: '3%', y: '2.2%', rotate: '1.4deg' },
    { x: '-2.2%', y: '5.2%', rotate: '-1deg' },
    { x: '0%', y: '-1.2%', rotate: '0deg' },
    { x: '2.2%', y: '5.2%', rotate: '1deg' },
] as const;

function BookGamePage({
    games,
    onSelect,
}: {
    games: GameConfig[];
    onSelect: (id: string) => void;
}) {
    const slots = Array.from({ length: 9 }, (_, index) => games[index] ?? null);

    return (
        <div
            className="grid h-full w-full place-items-center gap-x-[3.5%] gap-y-[5%] px-[4.5%] py-[5%] pointer-events-auto"
            style={{
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
            }}
        >
            {slots.map((game, index) => (game ? (
                <div
                    key={game.id}
                    className="flex h-full w-full items-center justify-center"
                    style={{
                        transform: `translate(${BOOK_GAME_SLOT_TRANSFORMS[index]?.x ?? '0%'}, ${BOOK_GAME_SLOT_TRANSFORMS[index]?.y ?? '0%'}) rotate(${BOOK_GAME_SLOT_TRANSFORMS[index]?.rotate ?? '0deg'})`,
                    }}
                >
                    <GameListCard
                        game={game}
                        index={index}
                        onGameClick={onSelect}
                        variant="homeV2Compact"
                        className="max-w-[68px]"
                    />
                </div>
            ) : (
                <div key={`placeholder-${index}`} className="h-full w-full" aria-hidden="true" />
            )))}
        </div>
    );
}

export interface OverviewProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
}

export const Overview = ({ games, onGameClick }: OverviewProps) => {
    return (
        <div className="h-full w-full pointer-events-auto">
            <BookGamePage games={games} onSelect={onGameClick} />
        </div>
    );
};

export interface LeftProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
}

export const Left = ({ games, onGameClick }: LeftProps) => {
    return <BookGamePage games={games} onSelect={onGameClick} />;
};

export interface RightProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
}

export const Right = ({ games, onGameClick }: RightProps) => {
    return <BookGamePage games={games} onSelect={onGameClick} />;
};

export const LobbyDirectory = {
    Overview,
    Left,
    Right,
};
