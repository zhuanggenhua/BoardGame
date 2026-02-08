import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DebugProvider } from './contexts/DebugContext';

const queryClient = new QueryClient();
import { TutorialProvider } from './contexts/TutorialContext';
import { AuthProvider } from './contexts/AuthContext';
import { SocialProvider } from './contexts/SocialContext';
import { AudioProvider } from './contexts/AudioContext';
import { ModalStackProvider } from './contexts/ModalStackContext';
import { ToastProvider } from './contexts/ToastContext';
import { ModalStackRoot } from './components/system/ModalStackRoot';
import { ToastViewport } from './components/system/ToastViewport';
import { EngineNotificationListener } from './components/system/EngineNotificationListener';
import { Toaster } from 'react-hot-toast';
import { GlobalHUD } from './components/system/GlobalHUD';
import { GlobalErrorBoundary } from './components/system/GlobalErrorBoundary';

import { Home } from './pages/Home';
import { MatchRoom } from './pages/MatchRoom';
import { LocalMatchRoom } from './pages/LocalMatchRoom';
import { NotFound } from './pages/NotFound';
import { MaintenancePage } from './pages/Maintenance';
import React from 'react';

const DevToolsSlicer = React.lazy(() => import('./pages/devtools/AssetSlicer'));
const DevToolsFxPreview = React.lazy(() => import('./pages/devtools/EffectPreview'));
const DevToolsAudioBrowser = React.lazy(() => import('./pages/devtools/AudioBrowser'));
const UnifiedBuilder = React.lazy(() => import('./ugc/builder/pages/UnifiedBuilder').then(m => ({ default: m.UnifiedBuilder })));
const UGCRuntimeViewPage = React.lazy(() => import('./ugc/runtime/RuntimeViewPage'));
const UGCSandbox = React.lazy(() => import('./ugc/builder/pages/UGCSandbox').then(m => ({ default: m.UGCSandbox })));
const AdminLayout = React.lazy(() => import('./pages/admin/components/AdminLayout'));
const AdminDashboard = React.lazy(() => import('./pages/admin/index'));
const UsersPage = React.lazy(() => import('./pages/admin/Users'));
const UserDetailPage = React.lazy(() => import('./pages/admin/UserDetail'));
const MatchesPage = React.lazy(() => import('./pages/admin/Matches'));
const RoomsPage = React.lazy(() => import('./pages/admin/Rooms'));
const FeedbackPage = React.lazy(() => import('./pages/admin/Feedback'));
const SystemHealthPage = React.lazy(() => import('./pages/admin/SystemHealth'));

import AdminGuard from './components/auth/AdminGuard';

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalErrorBoundary>
        <ToastProvider>
          <ModalStackProvider>
            <AuthProvider>
              <SocialProvider>
                <AudioProvider>
                  <DebugProvider>
                    <TutorialProvider>
                      <BrowserRouter>
                          <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/play/:gameId/match/:matchId" element={<MatchRoom />} />
                            <Route path="/play/:gameId/local" element={<LocalMatchRoom />} />
                            <Route path="/dev/slicer" element={<React.Suspense fallback={<div>Loading...</div>}><DevToolsSlicer /></React.Suspense>} />
                            <Route path="/dev/fx" element={<React.Suspense fallback={<div>Loading...</div>}><DevToolsFxPreview /></React.Suspense>} />
                            <Route path="/dev/audio" element={<React.Suspense fallback={<div>Loading...</div>}><DevToolsAudioBrowser /></React.Suspense>} />
                            <Route path="/dev/ugc" element={<React.Suspense fallback={<div className="flex bg-slate-900 h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div></div>}><UnifiedBuilder /></React.Suspense>} />
                            <Route path="/dev/ugc/runtime-view" element={<React.Suspense fallback={<div className="flex bg-slate-900 h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div></div>}><UGCRuntimeViewPage /></React.Suspense>} />
                            <Route path="/dev/ugc/sandbox" element={<React.Suspense fallback={<div className="flex bg-slate-900 h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div></div>}><UGCSandbox /></React.Suspense>} />
                            {/* 教程路由回退（如需要），或映射到对局路由 */}
                            <Route path="/play/:gameId/tutorial" element={<MatchRoom />} />
                            <Route path="/maintenance" element={<MaintenancePage />} />

                            {/* Admin Routes */}
                            <Route path="/admin" element={
                              <AdminGuard>
                                <React.Suspense fallback={<div className="flex bg-zinc-50 h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
                                  <AdminLayout />
                                </React.Suspense>
                              </AdminGuard>
                            }>
                              <Route index element={<AdminDashboard />} />
                              <Route path="users" element={<UsersPage />} />
                              <Route path="users/:id" element={<UserDetailPage />} />
                              <Route path="matches" element={<MatchesPage />} />
                              <Route path="rooms" element={<RoomsPage />} />
                              <Route path="feedback" element={<FeedbackPage />} />
                              <Route path="health" element={<SystemHealthPage />} />
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
