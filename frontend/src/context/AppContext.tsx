import { createContext, Dispatch, SetStateAction } from 'react';

import { Config, DashboardItem, NewItem } from '../types';

export interface IAppContext {
    dashboardLayout: DashboardItem[];
    setDashboardLayout: Dispatch<SetStateAction<DashboardItem[]>>;
    refreshDashboard: () => Promise<void>;
    saveLayout: (items: DashboardItem[]) => void;
    addItem: (itemToAdd: NewItem) => Promise<void>;
    updateItem: (id: string, updatedData: Partial<NewItem>) => void;
    editMode: boolean;
    setEditMode: Dispatch<SetStateAction<boolean>>;
    config: Config | undefined;
    updateConfig: (partialConfig: Partial<Config>) => Promise<void>;
    // Authentication & setup states
    isLoggedIn: boolean;
    setIsLoggedIn: Dispatch<SetStateAction<boolean>>;
    username: string | null;
    setUsername: Dispatch<SetStateAction<string | null>>;
    isAdmin: boolean;
    setIsAdmin: Dispatch<SetStateAction<boolean>>;
    isFirstTimeSetup: boolean | null;
    setIsFirstTimeSetup: Dispatch<SetStateAction<boolean | null>>;
    setupComplete: boolean;
    setSetupComplete: Dispatch<SetStateAction<boolean>>;
    checkIfUsersExist: () => Promise<void>;
    checkLoginStatus: () => Promise<void>;
    updateAvailable: boolean;
    latestVersion: string | null;
    releaseUrl: string | null;
    checkForAppUpdates: () => Promise<void>;
}

export const AppContext = createContext<IAppContext>(null!);
