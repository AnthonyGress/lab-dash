// Renders a component the way the app does: inside the theme, a router, the toast
// provider and the app context. Pass `context` to override parts of the context and
// `route` to start somewhere other than the home page.
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { ToastProvider } from '../../src/components/toast/ToastManager';
import { AppContext, IAppContext } from '../../src/context/AppContext';
import { ThemeContextProvider } from '../../src/theme/ThemeContext';
import { Config, DashboardItem, Page } from '../../src/types';

export const emptyConfig = (overrides: Partial<Config> = {}): Config => ({
    layout: { desktop: [], mobile: [] },
    pages: [],
    ...overrides
});

const resolved = <T,>(value: T) => vi.fn(async () => value);

/** A complete app context whose functions are mocks and whose state is a logged-out, set-up dashboard. */
export const makeContext = (overrides: Partial<IAppContext> = {}): IAppContext => ({
    dashboardLayout: [],
    setDashboardLayout: vi.fn(),
    refreshDashboard: resolved(undefined),
    saveLayout: vi.fn(),
    addItem: resolved(undefined),
    updateItem: resolved(undefined),
    editMode: false,
    setEditMode: vi.fn(),
    config: emptyConfig(),
    updateConfig: resolved(undefined),
    currentPageId: null,
    setCurrentPageId: vi.fn(),
    pages: [],
    addPage: resolved<string | null>(null),
    deletePage: resolved(undefined),
    switchToPage: resolved(undefined),
    pageNameToSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
    moveItemToPage: resolved(undefined),
    isLoggedIn: false,
    setIsLoggedIn: vi.fn(),
    username: null,
    setUsername: vi.fn(),
    isAdmin: false,
    setIsAdmin: vi.fn(),
    isFirstTimeSetup: false,
    setIsFirstTimeSetup: vi.fn(),
    setupComplete: true,
    setSetupComplete: vi.fn(),
    checkIfUsersExist: resolved(undefined),
    checkLoginStatus: resolved(undefined),
    updateAvailable: false,
    latestVersion: null,
    releaseUrl: null,
    checkForAppUpdates: resolved(undefined),
    recentlyUpdated: false,
    handleVersionViewed: resolved(undefined),
    ...overrides
});

/** A logged-in administrator in edit mode or not */
export const adminContext = (overrides: Partial<IAppContext> = {}): Partial<IAppContext> => ({
    isLoggedIn: true,
    isAdmin: true,
    username: 'admin',
    ...overrides
});

export const makeItem = (type: string, overrides: Partial<DashboardItem> = {}): DashboardItem => ({
    id: `${type}-1`,
    label: 'Test item',
    type,
    ...overrides
});

export const makePage = (name: string, overrides: Partial<Page> = {}): Page => ({
    id: `${name.toLowerCase()}-page`,
    name,
    layout: { desktop: [], mobile: [] },
    ...overrides
});

type Options = Omit<RenderOptions, 'wrapper'> & {
    context?: Partial<IAppContext>;
    route?: string;
};

export type Rendered = RenderResult & { context: IAppContext };

export const renderWithProviders = (ui: ReactElement, { context, route = '/', ...options }: Options = {}): Rendered => {
    const value = makeContext(context);

    const Wrapper = ({ children }: { children: ReactNode }) => (
        <ThemeContextProvider>
            <MemoryRouter initialEntries={[route]}>
                <ToastProvider>
                    <AppContext.Provider value={value}>
                        {children}
                    </AppContext.Provider>
                </ToastProvider>
            </MemoryRouter>
        </ThemeContextProvider>
    );

    return { ...render(ui, { wrapper: Wrapper, ...options }), context: value };
};
