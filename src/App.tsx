import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DebugProvider } from './contexts/DebugContext';
import { TestHarness } from './engine/testing';

const queryClient = new QueryClient();

// 初始化测试工具（仅在测试环境生效）
TestHarness.init();
import { TutorialProvider } from './contexts/TutorialContext';
import { AuthProvider } from './contexts/AuthContext';
import { SocialProvider } from './contexts/SocialContext';
import { AudioProvider } from './contexts/AudioContext';
import { ModalStackProvider } from './contexts/ModalStackContext';
import { ToastProvider } from './contexts/ToastContext';
import { ModalStackRoot } from './components/system/ModalStackRoot';
import { ToastViewport } from './components/system/ToastViewport';
import { EngineNotificationListener } from './components/system/EngineNotificationListener';
import { LoadingScreen } from './components/system/LoadingScreen';
import { Toaster } from 'react-hot-toast';
import { GlobalHUD } from './components/system/GlobalHUD';
import { GlobalErrorBoundary } from './components/system/GlobalErrorBoundary';
import { InteractionGuardProvider } from './components/game/framework';

import { Home } from './pages/Home';
import { MatchRoom } from './pages/MatchRoom';
import { LocalMatchRoom } from './pages/LocalMatchRoom';
import { NotFound } from './pages/NotFound';
import { MaintenancePage } from './pages/Maintenance';

/**
 * 教程路由专用包装组件。
 * 与在线对局使用不同的组件类型，强制 React 在路由切换时完全卸载/重建 MatchRoom，
 * 防止从在线对局导航到教程时组件实例复用导致 state/ref 泄漏（教程卡在"初始化中"）。
 */
const TutorialMatchRoom = () => <MatchRoom />;

import React from 'react';
import { useTranslation } from 'react-i18next';

const DevToolsSlicer = React.lazy(() => import('./pages/devtools/AssetSlicer'));
const DevToolsFxPreview = React.lazy(() => import('./pages/devtools/EffectPreview'));
const DevToolsAudioBrowser = React.lazy(() => import('./pages/devtools/AudioBrowser'));
const DevToolsArchView = React.lazy(() => import('./pages/devtools/ArchitectureView'));
const UnifiedBuilder = React.lazy(() => import('./ugc/builder/pages/UnifiedBuilder').then(m => ({ default: m.UnifiedBuilder })));
const UGCRuntimeViewPage = React.lazy(() => import('./ugc/runtime/RuntimeViewPage'));
const UGCSandbox = React.lazy(() => import('./ugc/builder/pages/UGCSandbox').then(m => ({ default: m.UGCSandbox })));
const AdminLayout = React.lazy(() => import('./pages/admin/components/AdminLayout'));
const AdminDashboard = React.lazy(() => import('./pages/admin/index'));
const UsersPage = React.lazy(() => import('./pages/admin/Users'));
const UserDetailPage = React.lazy(() => import('./pages/admin/UserDetail'));
const MatchesPage = React.lazy(() => import('./pages/admin/Matches'));
const RoomsPage = React.lazy(() => import('./pages/admin/Rooms'));
const UgcPackagesPage = React.lazy(() => import('./pages/admin/UgcPackages'));
const FeedbackPage = React.lazy(() => import('./pages/admin/Feedback'));
const SystemHealthPage = React.lazy(() => import('./pages/admin/SystemHealth'));
const SponsorsPage = React.lazy(() => import('./pages/admin/Sponsors'));
const NotificationsPage = React.lazy(() => import('./pages/admin/Notifications'));


import AdminGuard from './components/auth/AdminGuard';

const App = () => {
  const { t } = useTranslation('lobby');

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorBoundary>
        <ToastProvider>
          <ModalStackProvider>
            <AuthProvider>
              <SocialProvider>
                <AudioProvider>
                  <InteractionGuardProvider>
                    <DebugProvider>
                      <TutorialProvider>
                        <BrowserRouter>
                          <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/play/:gameId/match/:matchId" element={<MatchRoom />} />
                          <Route path="/play/:gameId/local" element={<LocalMatchRoom />} />
                          <Route path="/dev/slicer" element={<React.Suspense fallback={<LoadingScreen title={t('matchRoom.devTools.assetSlicer')} />}><DevToolsSlicer /></React.Suspense>} />
                          <Route path="/dev/fx" element={<React.Suspense fallback={<LoadingScreen title={t('matchRoom.devTools.effectPreview')} />}><DevToolsFxPreview /></React.Suspense>} />
                          <Route path="/dev/audio" element={<React.Suspense fallback={<LoadingScreen title={t('matchRoom.devTools.audioBrowser')} />}><DevToolsAudioBrowser /></React.Suspense>} />
                          <Route path="/dev/arch" element={<React.Suspense fallback={<LoadingScreen title="架构可视化" />}><DevToolsArchView /></React.Suspense>} />
                          <Route path="/dev/ugc" element={<React.Suspense fallback={<LoadingScreen title={t('matchRoom.devTools.ugcBuilder')} />}><UnifiedBuilder /></React.Suspense>} />
                          <Route path="/dev/ugc/runtime-view" element={<React.Suspense fallback={<LoadingScreen title={t('matchRoom.devTools.runtimeView')} />}><UGCRuntimeViewPage /></React.Suspense>} />
                          <Route path="/dev/ugc/sandbox" element={<React.Suspense fallback={<LoadingScreen title={t('matchRoom.devTools.ugcSandbox')} />}><UGCSandbox /></React.Suspense>} />
                          {/* 教程路由：使用 TutorialMatchRoom 包装组件（不同组件类型），
                              强制 React 在在线↔教程路由切换时完全卸载/重建，防止状态泄漏 */}
                          <Route path="/play/:gameId/tutorial" element={<TutorialMatchRoom />} />
                          <Route path="/maintenance" element={<MaintenancePage />} />

                          {/* Admin Routes */}
                          <Route path="/admin" element={
                            <AdminGuard>
                              <React.Suspense fallback={<LoadingScreen title={t('matchRoom.admin.dashboard')} />}>
                                <AdminLayout />
                              </React.Suspense>
                            </AdminGuard>
                          }>
                            <Route index element={<AdminDashboard />} />
                            <Route path="users" element={<UsersPage />} />
                            <Route path="users/:id" element={<UserDetailPage />} />
                            <Route path="matches" element={<MatchesPage />} />
                            <Route path="rooms" element={<RoomsPage />} />
                            <Route path="ugc" element={<UgcPackagesPage />} />
                            <Route path="sponsors" element={<SponsorsPage />} />
                            <Route path="feedback" element={<FeedbackPage />} />
                            <Route path="health" element={<SystemHealthPage />} />
                            <Route path="notifications" element={<NotificationsPage />} />
                          </Route>

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                          <GlobalHUD />
                          <ModalStackRoot />
                          <ToastViewport />
                          <Toaster />
                          <EngineNotificationListener />
                        </BrowserRouter>
                      </TutorialProvider>
                    </DebugProvider>
                  </InteractionGuardProvider>
                </AudioProvider>
              </SocialProvider>
            </AuthProvider>
          </ModalStackProvider>
        </ToastProvider>
      </GlobalErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
