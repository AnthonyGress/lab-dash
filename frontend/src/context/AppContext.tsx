import { createContext, Dispatch, SetStateAction } from 'react';

import { Config, DashboardItem, NewItem, Page } from '../types';

export interface IAppContext {
    dashboardLayout: DashboardItem[];
    setDashboardLayout: Dispatch<SetStateAction<DashboardItem[]>>;
    refreshDashboard: () => Promise<void>;
    saveLayout: (items: DashboardItem[]) => void;
    addItem: (itemToAdd: NewItem) => Promise<void>;
    updateItem: (id: string, updatedData: Partial<NewItem>) => Promise<void>;
    editMode: boolean;
    setEditMode: Dispatch<SetStateAction<boolean>>;
    config: Config | undefined;
    updateConfig: (partialConfig: Partial<Config>) => Promise<void>;

    // Performance optimization - bulk loading
    iconCache: { [key: string]: string };
    widgetDataCache: { [key: string]: any };
    loadBulkData: (items: DashboardItem[]) => Promise<void>;
    isInitialLoading: boolean;

    // Page management
    currentPageId: string | null;
    setCurrentPageId: Dispatch<SetStateAction<string | null>>;
    pages: Page[];
    addPage: (name: string, adminOnly?: boolean) => Promise<string | null>;
    deletePage: (pageId: string) => Promise<void>;
    switchToPage: (pageId: string) => Promise<void>;
    pageNameToSlug: (pageName: string) => string;
    moveItemToPage: (itemId: string, targetPageId: string | null) => Promise<void>;
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
    // Update states
    updateAvailable: boolean;
    latestVersion: string | null;
    releaseUrl: string | null;
    checkForAppUpdates: () => Promise<void>;
    // Recently updated state
    recentlyUpdated: boolean;
    handleVersionViewed: () => Promise<void>;
}

export const AppContext = createContext<IAppContext>(null!);
