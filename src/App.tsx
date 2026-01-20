import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DebugProvider } from './contexts/DebugContext';
import { TutorialProvider } from './contexts/TutorialContext';
import { AuthProvider } from './contexts/AuthContext';
import { AudioProvider } from './contexts/AudioContext';
import { Home } from './pages/Home';
import { MatchRoom } from './pages/MatchRoom';
import { LocalMatchRoom } from './pages/LocalMatchRoom';
import React from 'react';

const DevToolsSlicer = React.lazy(() => import('./pages/devtools/AssetSlicer'));

const App = () => {
  return (
    <AuthProvider>
      <AudioProvider>
        <DebugProvider>
          <TutorialProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/games/:gameId/match/:matchId" element={<MatchRoom />} />
                <Route path="/games/:gameId/local" element={<LocalMatchRoom />} />
                <Route path="/dev/slicer" element={<React.Suspense fallback={<div>Loading...</div>}><DevToolsSlicer /></React.Suspense>} />
                {/* Fallback tutorial route if needed, or mapped to match */}
                <Route path="/games/:gameId/tutorial" element={<MatchRoom />} />
              </Routes>
            </BrowserRouter>
          </TutorialProvider>
        </DebugProvider>
      </AudioProvider>
    </AuthProvider>
  );
};

export default App;
