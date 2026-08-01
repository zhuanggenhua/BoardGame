import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { DebugProvider } from './contexts/DebugContext';
import { TestHarness } from './engine/testing';
import { TutorialProvider } from './contexts/TutorialContext';
import { AuthProvider } from './contexts/AuthContext';
import { SocialProvider } from './contexts/SocialContext';
import { CursorPreferenceProvider } from './core/cursor/CursorPreferenceContext';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import { ModalStackProvider } from './contexts/ModalStackContext';
import { ToastProvider } from './contexts/ToastContext';
import { EngineNotificationListener } from './components/system/EngineNotificationListener';
import { ViewportDebugProbe } from './components/system/ViewportDebugProbe';
import { Toaster } from 'react-hot-toast';
import { GlobalErrorBoundary } from './components/system/GlobalErrorBoundary';
import { BrowserCompatibilityGate } from './components/system/BrowserCompatibilityGate';
import { MobileLiveUpdateManager } from './components/system/MobileLiveUpdateManager';
import { AndroidNativeUpdateManager } from './components/system/AndroidNativeUpdateManager';
import { AndroidBackNavigationBridge } from './components/system/AndroidBackNavigationBridge';
import { GamePageRescueGate } from './components/system/GamePageRescueGate';
import { LoadingScreen } from './components/system/LoadingScreen';
import { TextEntryAutoScrollAgent } from './components/system/TextEntryAutoScrollAgent';
import { MobileTextEntryProxyLayer } from './components/system/MobileTextEntryProxyLayer';
import { PcWebMascot } from './components/system/PcWebMascot';
import { InteractionGuardProvider } from './components/game/framework/InteractionGuard';
import AdminGuard from './components/auth/AdminGuard';
import { MobileOrientationGuard } from './components/common/MobileOrientationGuard';
import { ModalStackRoot } from './components/system/ModalStackRoot';
import { installGlobalErrorContextCapture } from './lib/feedback/errorContext';
import { isNativeAndroidRuntime } from './lib/mobile/androidRuntime';
import { isNativeMobileRuntime } from './lib/mobile/mobileRuntime';
import { HOME_V2_PREVIEW_PATH } from './lib/homeV2Routing';
import { AdminShellSkeleton } from './pages/admin/components/AdminSkeletons';
import { HomeEntry } from './pages/HomeEntry';
import { GlobalHUD } from './components/system/GlobalHUD';

const ENABLE_INTERNAL_DEVTOOLS = import.meta.env.DEV;

// 页面级懒加载：首页是默认入口，保留同步加载避免首屏闪出路由级 loading 文案
const MatchRoom = React.lazy(() => import('./pages/MatchRoomWithAudio'));
const LocalMatchRoom = React.lazy(() => import('./pages/LocalMatchRoomWithAudio'));
const TestMatchRoom = React.lazy(() => import('./pages/TestMatchRoomWithAudio'));
const LazyNotFound = React.lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const LazyMaintenancePage = React.lazy(() => import('./pages/Maintenance').then(m => ({ default: m.MaintenancePage })));
const SummonerWarsConfigReviewPage = React.lazy(() => import('./pages/SummonerWarsConfigReview'));
const DiceThroneConfigReviewPage = React.lazy(() => import('./pages/DiceThroneConfigReview'));
// 旧的测试路由已废弃，使用新的 TestHarness 框架
const EmptyToastViewport: React.FC = () => null;

export const loadToastViewportModule = async (): Promise<{ default: React.ComponentType }> => {
  try {
    const toastModule = await import('./components/system/ToastViewport') as typeof import('./components/system/ToastViewport') | undefined;
    return { default: toastModule?.ToastViewport ?? EmptyToastViewport };
  } catch {
    return { default: EmptyToastViewport };
  }
};

const LazyToastViewport = React.lazy(loadToastViewportModule);

const queryClient = new QueryClient();

// 初始化测试工具（仅在测试环境生效）
TestHarness.init();

/**
 * 教程路由专用包装组件。
 * 与在线对局使用不同的组件类型，强制 React 在路由切换时完全卸载/重建 MatchRoom，
 * 防止从在线对局导航到教程时组件实例复用导致 state/ref 泄漏（教程卡在"初始化中"）。
 */
const TutorialMatchRoom = React.lazy(() => import('./pages/TutorialMatchRoomWithAudio'));

const DevToolsSlicer = ENABLE_INTERNAL_DEVTOOLS ? React.lazy(() => import('./pages/devtools/AssetSlicer')) : null;
const DevToolsFxPreview = ENABLE_INTERNAL_DEVTOOLS ? React.lazy(() => import('./pages/devtools/EffectPreview')) : null;
const DevToolsAudioBrowser = ENABLE_INTERNAL_DEVTOOLS ? React.lazy(() => import('./pages/devtools/AudioBrowser')) : null;
const DevToolsArchView = ENABLE_INTERNAL_DEVTOOLS ? React.lazy(() => import('./pages/devtools/ArchitectureView')) : null;
const DevToolsQidahenRegionMask = ENABLE_INTERNAL_DEVTOOLS ? React.lazy(() => import('./pages/devtools/QidahenRegionMaskTool')) : null;
const DevToolsQidahenRuntimePreview = ENABLE_INTERNAL_DEVTOOLS ? React.lazy(() => import('./pages/devtools/QidahenRuntimePreview')) : null;
const HomeV2AuthoringPage = ENABLE_INTERNAL_DEVTOOLS
  ? React.lazy(() => import('./pages/HomeV2Draft').then(m => ({ default: m.HomeV2Draft })))
  : null;
const HomeV2PreviewPage = ENABLE_INTERNAL_DEVTOOLS
  ? React.lazy(() => import('./pages/HomeV2').then(m => ({ default: m.HomeV2 })))
  : null;
const AdminLayout = React.lazy(() => import('./pages/admin/components/AdminLayout'));
const AdminDashboard = React.lazy(() => import('./pages/admin/index'));
const UsersPage = React.lazy(() => import('./pages/admin/Users'));
const UserDetailPage = React.lazy(() => import('./pages/admin/UserDetail'));
const GameChangelogsPage = React.lazy(() => import('./pages/admin/GameChangelogs'));
const MatchesPage = React.lazy(() => import('./pages/admin/Matches'));
const RoomsPage = React.lazy(() => import('./pages/admin/Rooms'));
const FeedbackPage = React.lazy(() => import('./pages/admin/Feedback'));
const SystemHealthPage = React.lazy(() => import('./pages/admin/SystemHealth'));
const SponsorsPage = React.lazy(() => import('./pages/admin/Sponsors'));
const NotificationsPage = React.lazy(() => import('./pages/admin/Notifications'));
const MobileReleasePage = React.lazy(() => import('./pages/admin/MobileRelease'));
const SmashUp4PLayoutTest = ENABLE_INTERNAL_DEVTOOLS ? React.lazy(() => import('./pages/SmashUp4PLayoutTest')) : null;
const DevMobileEvidenceCaptureAgent = import.meta.env.DEV
  ? React.lazy(() =>
      import('./components/system/MobileEvidenceCaptureAgent').then(m => ({ default: m.MobileEvidenceCaptureAgent })),
    )
  : null;

const AppRouteChrome = ({
  isNativeAndroid,
  isNativeMobile,
}: {
  isNativeAndroid: boolean;
  isNativeMobile: boolean;
}) => {
  const location = useLocation();
  const isPlayRoute = location.pathname.startsWith('/play/');

  return (
    <>
      {DevMobileEvidenceCaptureAgent ? (
        <React.Suspense fallback={null}>
          <DevMobileEvidenceCaptureAgent />
        </React.Suspense>
      ) : null}
      {isNativeAndroid ? <AndroidBackNavigationBridge /> : null}
      <TextEntryAutoScrollAgent />
      <MobileTextEntryProxyLayer />
      <ViewportDebugProbe />
      {!isPlayRoute ? <GlobalHUD /> : null}
      <ModalStackRoot />
      <React.Suspense fallback={null}>
        <LazyToastViewport />
      </React.Suspense>
      <Toaster />
      {isNativeAndroid ? <AndroidNativeUpdateManager /> : null}
      {isNativeMobile ? <MobileLiveUpdateManager /> : null}
      {!isPlayRoute ? <PcWebMascot /> : null}
      <EngineNotificationListener />
      <GamePageRescueGate />
    </>
  );
};

const AppContent = () => {
  const { t } = useTranslation('lobby');
  const [nativeRuntime, setNativeRuntime] = useState(() => ({
    isNativeAndroid: isNativeAndroidRuntime(),
    isNativeMobile: isNativeMobileRuntime(),
  }));
  const { isNativeAndroid, isNativeMobile } = nativeRuntime;
  
  // Token 自动刷新
  useTokenRefresh();

  // 兜底：App 挂载时移除 index.html 的静态占位（LoadingScreen 不出现时的情况）
  useEffect(() => {
    installGlobalErrorContextCapture();
    const initialLoader = document.getElementById('initial-loader');
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const shouldKeepBootstrapLoader = pathname.startsWith('/play/') || pathname.startsWith('/dev/');
    if (initialLoader && !shouldKeepBootstrapLoader) {
      initialLoader.remove();
    }
  }, []);

  useEffect(() => {
    const refreshNativeRuntime = () => {
      setNativeRuntime((current) => {
        const next = {
          isNativeAndroid: isNativeAndroidRuntime(),
          isNativeMobile: isNativeMobileRuntime(),
        };
        return current.isNativeAndroid === next.isNativeAndroid && current.isNativeMobile === next.isNativeMobile
          ? current
          : next;
      });
    };

    refreshNativeRuntime();
    const timeoutIds = [100, 300, 1000].map((delay) => window.setTimeout(refreshNativeRuntime, delay));
    window.addEventListener('focus', refreshNativeRuntime);
    document.addEventListener('visibilitychange', refreshNativeRuntime);

    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('focus', refreshNativeRuntime);
      document.removeEventListener('visibilitychange', refreshNativeRuntime);
    };
  }, []);

  const renderAdminOnly = (element: React.ReactNode) => (
    <AdminGuard allowedRoles={['admin']} fallbackPath="/admin/changelogs">
      {element}
    </AdminGuard>
  );

  const playRouteFallback = (
    <LoadingScreen
      description={t('matchRoom.preparingMatch')}
      progressText={t('matchRoom.loadingProgress.loadingGameModule')}
    />
  );

  return (
    <CursorPreferenceProvider>
      <SocialProvider>
        <InteractionGuardProvider>
          <DebugProvider>
            <TutorialProvider>
              <BrowserRouter>
                <BrowserCompatibilityGate>
                <MobileOrientationGuard>
                  <Routes>
                    <Route
                      path="/"
                      element={<HomeEntry />}
                    />
                    <Route
                      path="/play/:gameId/match/:matchId"
                      element={(
                        <React.Suspense fallback={playRouteFallback}>
                          <MatchRoom />
                        </React.Suspense>
                      )}
                    />
                    <Route
                      path="/play/:gameId/local"
                      element={(
                        <React.Suspense fallback={playRouteFallback}>
                          <LocalMatchRoom />
                        </React.Suspense>
                      )}
                    />
                    {/* E2E 测试路由：使用 TestMatchRoom + TestHarness 框架进行状态注入测试 */}
                    <Route
                      path="/play/:gameId"
                      element={(
                        <React.Suspense fallback={playRouteFallback}>
                          <TestMatchRoom />
                        </React.Suspense>
                      )}
                    />
                    {/* /test 路由已废弃，使用新的 TestHarness 框架（/play/:gameId + setupScene） */}
                    {ENABLE_INTERNAL_DEVTOOLS && DevToolsSlicer && (
                      <Route path="/dev/slicer" element={<React.Suspense fallback={null}><DevToolsSlicer /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && DevToolsFxPreview && (
                      <Route path="/dev/fx" element={<React.Suspense fallback={null}><DevToolsFxPreview /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && DevToolsAudioBrowser && (
                      <Route path="/dev/audio" element={<React.Suspense fallback={null}><DevToolsAudioBrowser /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && DevToolsArchView && (
                      <Route path="/dev/arch" element={<React.Suspense fallback={null}><DevToolsArchView /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && DevToolsQidahenRegionMask && (
                      <Route path="/dev/qidahen-region-mask" element={<React.Suspense fallback={null}><DevToolsQidahenRegionMask /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && DevToolsQidahenRuntimePreview && (
                      <Route path="/dev/qidahen-runtime-preview" element={<React.Suspense fallback={null}><DevToolsQidahenRuntimePreview /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && HomeV2AuthoringPage && (
                      <Route path="/dev/home-v2-authoring" element={<React.Suspense fallback={null}><HomeV2AuthoringPage /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && HomeV2PreviewPage && (
                      <Route path={HOME_V2_PREVIEW_PATH} element={<React.Suspense fallback={null}><HomeV2PreviewPage /></React.Suspense>} />
                    )}
                    {ENABLE_INTERNAL_DEVTOOLS && SmashUp4PLayoutTest && (
                      <Route path="/dev/smashup-4p-layout" element={<React.Suspense fallback={null}><SmashUp4PLayoutTest /></React.Suspense>} />
                    )}
                    {/* 教程路由：使用 TutorialMatchRoom 包装组件（不同组件类型），
                        强制 React 在在线↔教程路由切换时完全卸载/重建，防止状态泄漏 */}
                    <Route
                      path="/play/:gameId/tutorial/:tutorialId"
                      element={(
                        <React.Suspense fallback={playRouteFallback}>
                          <TutorialMatchRoom />
                        </React.Suspense>
                      )}
                    />
                    <Route
                      path="/play/:gameId/tutorial"
                      element={(
                        <React.Suspense fallback={playRouteFallback}>
                          <TutorialMatchRoom />
                        </React.Suspense>
                      )}
                    />
                    <Route
                      path="/maintenance"
                      element={(
                        <React.Suspense fallback={null}>
                          <LazyMaintenancePage />
                        </React.Suspense>
                      )}
                    />
                    <Route
                      path="/games/summonerwars/config"
                      element={(
                        <React.Suspense fallback={null}>
                          <SummonerWarsConfigReviewPage />
                        </React.Suspense>
                      )}
                    />
                    <Route
                      path="/games/dicethrone/config"
                      element={(
                        <React.Suspense fallback={null}>
                          <DiceThroneConfigReviewPage />
                        </React.Suspense>
                      )}
                    />

                    {/* Admin Routes */}
                    <Route path="/admin" element={
                      <AdminGuard allowedRoles={['admin', 'developer', 'user']} allowGuest>
                        <React.Suspense fallback={<AdminShellSkeleton />}>
                          <AdminLayout />
                        </React.Suspense>
                      </AdminGuard>
                    }>
                      <Route
                        path="changelogs"
                        element={(
                          <AdminGuard allowedRoles={['admin', 'developer']} fallbackPath="/admin">
                            <GameChangelogsPage />
                          </AdminGuard>
                        )}
                      />
                      <Route
                        index
                        element={<AdminDashboard />}
                      />
                      <Route path="users" element={renderAdminOnly(<UsersPage />)} />
                      <Route path="users/:id" element={renderAdminOnly(<UserDetailPage />)} />
                      <Route
                        path="matches"
                        element={(
                          <AdminGuard allowedRoles={['admin', 'developer', 'user']} allowGuest fallbackPath="/admin">
                            <MatchesPage />
                          </AdminGuard>
                        )}
                      />
                      <Route path="rooms" element={renderAdminOnly(<RoomsPage />)} />
                      <Route path="sponsors" element={renderAdminOnly(<SponsorsPage />)} />
                      <Route
                        path="feedback"
                        element={(
                          <AdminGuard allowedRoles={['admin', 'developer', 'user']} allowGuest fallbackPath="/admin">
                            <FeedbackPage />
                          </AdminGuard>
                        )}
                      />
                      <Route path="health" element={renderAdminOnly(<SystemHealthPage />)} />
                      <Route path="notifications" element={renderAdminOnly(<NotificationsPage />)} />
                      <Route path="release-center" element={renderAdminOnly(<MobileReleasePage />)} />
                      <Route path="mobile-release" element={renderAdminOnly(<MobileReleasePage />)} />
                    </Route>

                    <Route
                      path="*"
                      element={(
                        <React.Suspense fallback={null}>
                          <LazyNotFound />
                        </React.Suspense>
                      )}
                    />
                    </Routes>
                    <AppRouteChrome isNativeAndroid={isNativeAndroid} isNativeMobile={isNativeMobile} />
                </MobileOrientationGuard>
                </BrowserCompatibilityGate>
              </BrowserRouter>
            </TutorialProvider>
          </DebugProvider>
        </InteractionGuardProvider>
      </SocialProvider>
    </CursorPreferenceProvider>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorBoundary>
        <ToastProvider>
          <ModalStackProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ModalStackProvider>
        </ToastProvider>
      </GlobalErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
