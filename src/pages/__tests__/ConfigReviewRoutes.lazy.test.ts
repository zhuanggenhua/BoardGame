import { describe, expect, it } from 'vitest';
import {
  CONFIG_REVIEW_PAGE_ROUTES,
  loadConfigReviewPageModule,
} from '../ConfigReviewRoutes';
import {
  CONFIG_REVIEW_GAME_IDS,
  getGameConfigReviewPath,
  hasGameConfigReview,
} from '../../config/gameConfigReviewRoutes';

describe('ConfigReviewRoutes lazy page modules', () => {
  it('turns an empty lazy module result into a stale chunk error', async () => {
    await expect(
      loadConfigReviewPageModule(
        async () => undefined,
        './pages/SummonerWarsConfigReview',
      ),
    ).rejects.toThrow('[stale-lazy-module] ./pages/SummonerWarsConfigReview missing export default');
  });

  it('returns the default component when the lazy module is valid', async () => {
    const Component = () => null;

    await expect(
      loadConfigReviewPageModule(
        async () => ({ default: Component }),
        './pages/SummonerWarsConfigReview',
      ),
    ).resolves.toEqual({ default: Component });
  });

  it('exposes Smash Up through the shared config review route registry', () => {
    expect(CONFIG_REVIEW_GAME_IDS).toContain('smashup');
    expect(hasGameConfigReview('smashup')).toBe(true);
    expect(CONFIG_REVIEW_PAGE_ROUTES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gameId: 'smashup',
          path: getGameConfigReviewPath('smashup'),
        }),
      ]),
    );
  });
});
