export type LeaderboardTier = 'beginner' | 'apprentice' | 'average' | 'good' | 'strong' | 'expert' | 'master';

export interface LeaderboardEntry {
    name: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    matches: number;
    winRate: number;
    provisional: boolean;
    tier: LeaderboardTier;
}
