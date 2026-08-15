import { describe, expect, it } from 'vitest';
import {
    createMatchEmoteRateLimiter,
    resolveMatchEmoteJoinDecision,
    resolveMatchEmoteSendDecision,
    type MatchEmoteMetadata,
} from '../matchEmotes';

const metadata = (gameName = 'dicethrone'): MatchEmoteMetadata => ({
    gameName,
    players: {
        '0': { name: '玩家一' },
        '1': { credentials: 'guest-token' },
        '2': {},
    },
});

const allowedEmotes = new Set([
    'dicethrone.moon-elf.speechless-facepalm',
    'smashup.supreme-overlord.smug-v1',
]);

const isEmoteAllowed = (emoteId: string) => allowedEmotes.has(emoteId);

describe('match emote decisions', () => {
    it('allows an occupied player to send a whitelisted emote', () => {
        const decision = resolveMatchEmoteSendDecision({
            matchId: 'match-1',
            playerId: '0',
            emoteId: 'dicethrone.moon-elf.speechless-facepalm',
            metadata: metadata(),
            now: 10_000,
            isEmoteAllowed,
        });

        expect(decision).toEqual({
            ok: true,
            gameId: 'dicethrone',
            rateLimitKey: 'match-1:0',
        });
    });

    it('rejects missing matches and non-player seats', () => {
        expect(resolveMatchEmoteJoinDecision(null, '0')).toEqual({
            ok: false,
            reason: 'match_not_found',
        });
        expect(resolveMatchEmoteJoinDecision(metadata(), '9')).toEqual({
            ok: false,
            reason: 'not_player',
        });
        expect(resolveMatchEmoteJoinDecision(metadata(), '2')).toEqual({
            ok: false,
            reason: 'not_player',
        });
    });

    it('rejects unknown emotes but allows the shared catalog across games', () => {
        expect(resolveMatchEmoteSendDecision({
            matchId: 'match-1',
            playerId: '0',
            emoteId: 'unknown.emote',
            metadata: metadata(),
            now: 10_000,
            isEmoteAllowed,
        })).toEqual({ ok: false, reason: 'invalid_emote' });

        expect(resolveMatchEmoteSendDecision({
            matchId: 'match-1',
            playerId: '0',
            emoteId: 'dicethrone.moon-elf.speechless-facepalm',
            metadata: metadata('smashup'),
            now: 10_000,
            isEmoteAllowed,
        })).toMatchObject({ ok: true, gameId: 'smashup' });
    });

    it('rejects unjoined and malformed send payloads before game validation', () => {
        expect(resolveMatchEmoteSendDecision({
            emoteId: 'dicethrone.moon-elf.speechless-facepalm',
            metadata: metadata(),
            now: 10_000,
            isEmoteAllowed,
        })).toEqual({ ok: false, reason: 'not_joined' });

        expect(resolveMatchEmoteSendDecision({
            matchId: 'match-1',
            playerId: '0',
            metadata: metadata(),
            now: 10_000,
            isEmoteAllowed,
        })).toEqual({ ok: false, reason: 'missing_payload' });
    });

    it('rate-limits repeated sends from the same player and match', () => {
        const limiter = createMatchEmoteRateLimiter(2_000);
        limiter.markSent('match-1', '0', 10_000);

        expect(resolveMatchEmoteSendDecision({
            matchId: 'match-1',
            playerId: '0',
            emoteId: 'dicethrone.moon-elf.speechless-facepalm',
            metadata: metadata(),
            now: 11_000,
            lastSentAt: limiter.getLastSentAt('match-1', '0'),
            cooldownMs: limiter.cooldownMs,
            isEmoteAllowed,
        })).toEqual({ ok: false, reason: 'rate_limited' });

        expect(resolveMatchEmoteSendDecision({
            matchId: 'match-1',
            playerId: '0',
            emoteId: 'dicethrone.moon-elf.speechless-facepalm',
            metadata: metadata(),
            now: 12_000,
            lastSentAt: limiter.getLastSentAt('match-1', '0'),
            cooldownMs: limiter.cooldownMs,
            isEmoteAllowed,
        })).toMatchObject({ ok: true });
    });
});
