/** 排行榜段位门槛，同时供服务端计分和前端说明使用。 */
export const LEADERBOARD_TIERS = [
    { id: 'master', min: 700 },
    { id: 'expert', min: 500 },
    { id: 'strong', min: 300 },
    { id: 'good', min: 200 },
    { id: 'average', min: 100 },
    { id: 'apprentice', min: 1 },
    { id: 'beginner', min: 0 },
] as const;
