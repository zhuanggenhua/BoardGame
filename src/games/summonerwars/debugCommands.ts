import type { PlayerId } from './domain/types';

export const SUMMONER_WARS_CHEAT_COMMANDS = {
    DAMAGE_SUMMONER: 'sw:cheat_damage_summoner',
} as const;

export interface SummonerWarsDamageSummonerPayload {
    playerId: PlayerId;
    amount: number;
}
