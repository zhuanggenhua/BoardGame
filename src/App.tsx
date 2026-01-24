import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DebugProvider } from './contexts/DebugContext';
import { TutorialProvider } from './contexts/TutorialContext';
import { AuthProvider } from './contexts/AuthContext';
import { AudioProvider } from './contexts/AudioContext';
import { ModalStackProvider } from './contexts/ModalStackContext';
import { ToastProvider } from './contexts/ToastContext';
import { ModalStackRoot } from './components/system/ModalStackRoot';
import { ToastViewport } from './components/system/ToastViewport';
import { EngineNotificationListener } from './components/system/EngineNotificationListener';
import { Home } from './pages/Home';
import { MatchRoom } from './pages/MatchRoom';
import { LocalMatchRoom } from './pages/LocalMatchRoom';
import React from 'react';

const DevToolsSlicer = React.lazy(() => import('./pages/devtools/AssetSlicer'));

const App = () => {
  return (
    <ToastProvider>
      <ModalStackProvider>
        <AuthProvider>
          <AudioProvider>
            <DebugProvider>
              <TutorialProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/play/:gameId/match/:matchId" element={<MatchRoom />} />
                    <Route path="/play/:gameId/local" element={<LocalMatchRoom />} />
                    <Route path="/dev/slicer" element={<React.Suspense fallback={<div>Loading...</div>}><DevToolsSlicer /></React.Suspense>} />
                    {/* 教程路由回退（如需要），或映射到对局路由 */}
                    <Route path="/play/:gameId/tutorial" element={<MatchRoom />} />
                  </Routes>
                  <ModalStackRoot />
                  <ToastViewport />
                  <EngineNotificationListener />
                </BrowserRouter>
              </TutorialProvider>
            </DebugProvider>
          </AudioProvider>
        </AuthProvider>
      </ModalStackProvider>
    </ToastProvider>
  );
};

export default App;
