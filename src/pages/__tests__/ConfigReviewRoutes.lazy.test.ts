import { describe, expect, it } from 'vitest';
import { loadConfigReviewPageModule } from '../ConfigReviewRoutes';

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
});
