/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { readLocalStorageItem, removeLocalStorageItem, writeLocalStorageItem } from '../lib/browserStorage';

interface DebugContextType {
    playerID: string | null;
    setPlayerID: (id: string | null) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [playerID, setPlayerID] = useState<string | null>(() => {
        // 持久化调试玩家选择
        return readLocalStorageItem('debug_playerID') || '0';
    });

    useEffect(() => {
        if (playerID) {
            writeLocalStorageItem('debug_playerID', playerID);
        } else {
            removeLocalStorageItem('debug_playerID');
        }
    }, [playerID]);

    const value = useMemo(() => ({ playerID, setPlayerID }), [playerID, setPlayerID]);

    return (
        <DebugContext.Provider value={value}>
            {children}
        </DebugContext.Provider>
    );
};

export const useDebug = () => {
    const context = useContext(DebugContext);
    if (!context) {
        throw new Error('useDebug must be used within a DebugProvider');
    }
    return context;
};
