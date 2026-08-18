import React from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import {
  CONFIG_REVIEW_GAME_IDS,
  getGameConfigReviewPath,
} from '../config/gameConfigReviewRoutes';
import { requireLazyModuleExport } from '../lib/lazyModuleExport';

type ConfigReviewPageComponent = React.ComponentType;

export function loadConfigReviewPageModule(
  loader: () => Promise<{ default?: ConfigReviewPageComponent | null } | null | undefined>,
  moduleId: string,
): Promise<{ default: ConfigReviewPageComponent }> {
  return loader().then((module) => ({
    default: requireLazyModuleExport(module, 'default', moduleId),
  }));
}

const CONFIG_REVIEW_PAGE_BY_GAME_ID = {
  summonerwars: React.lazy(() => loadConfigReviewPageModule(
    () => import('./SummonerWarsConfigReview'),
    './pages/SummonerWarsConfigReview',
  )),
  dicethrone: React.lazy(() => loadConfigReviewPageModule(
    () => import('./DiceThroneConfigReview'),
    './pages/DiceThroneConfigReview',
  )),
  betrayal: React.lazy(() => loadConfigReviewPageModule(
    () => import('./BetrayalConfigReview'),
    './pages/BetrayalConfigReview',
  )),
} as const;

export const CONFIG_REVIEW_PAGE_ROUTES = CONFIG_REVIEW_GAME_IDS.map((gameId) => ({
  gameId,
  path: getGameConfigReviewPath(gameId),
  Component: CONFIG_REVIEW_PAGE_BY_GAME_ID[gameId],
}));

const ConfigReviewRouteLoading = () => {
  const { t } = useTranslation('common');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1d130c] font-serif text-[#f3e3c3]">
      {t('loading')}
    </main>
  );
};

export function ConfigReviewRoutePage({ Component }: { Component: ConfigReviewPageComponent }) {
  return (
    <React.Suspense fallback={<ConfigReviewRouteLoading />}>
      <Component />
    </React.Suspense>
  );
}

export function ConfigReviewRoutes() {
  return (
    <Routes>
      {CONFIG_REVIEW_PAGE_ROUTES.map(({ gameId, path, Component }) => (
        <Route
          key={gameId}
          path={`${path}/*`}
          element={<ConfigReviewRoutePage Component={Component} />}
        />
      ))}
    </Routes>
  );
}
