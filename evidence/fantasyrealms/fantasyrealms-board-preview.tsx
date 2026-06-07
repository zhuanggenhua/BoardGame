import React from 'react';
import { createRoot } from 'react-dom/client';
import FantasyRealmsBoard from '../../src/games/fantasyrealms/Board';

createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <FantasyRealmsBoard />
    </React.StrictMode>,
);
