import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminContext, emptyConfig, makeItem, makePage, renderWithProviders } from './render';
import { DashApi } from '../../src/api/dash-api';
import { App } from '../../src/App';
import { AppContextProvider } from '../../src/context/AppContextProvider';
import { useAppContext } from '../../src/context/useAppContext';
import { ITEM_TYPE } from '../../src/types';

/** Shows where the router is, so shortcuts and redirects can be seen */
const Location = () => <span data-testid='location'>{useLocation().pathname}</span>;
const location = () => screen.getByTestId('location').textContent;

const plex = makeItem(ITEM_TYPE.APP_SHORTCUT, { id: 'plex', label: 'Plex', url: 'http://plex.local', showLabel: true });
const settingsHeading = () => screen.findByRole('heading', { name: 'Settings' });

beforeEach(() => {
    // The update check reaches GitHub with `fetch`; here it finds nothing
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve([]) })));
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.title = '';
});

describe('App', () => {
    it('shows the dashboard under the app bar on the home route', () => {
        renderWithProviders(<App />, { context: { dashboardLayout: [plex] } });

        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getAllByText('Lab Dash').length).toBeGreaterThan(0);
        expect(document.title).toBe('Lab Dash');
    });

    it('titles the document and the app bar after the configured title', () => {
        renderWithProviders(<App />, { context: { config: emptyConfig({ title: 'Home Lab' }) } });

        expect(document.title).toBe('Home Lab');
        expect(screen.getAllByText('Home Lab').length).toBeGreaterThan(0);
        expect(screen.queryByText('Lab Dash')).toBeNull();
    });

    it('shows a page route as the dashboard too', () => {
        renderWithProviders(<App />, { route: '/media', context: { pages: [makePage('Media')], dashboardLayout: [plex] } });

        expect(screen.getByText('Plex')).toBeTruthy();
    });

    it('loads the login screen on demand', async () => {
        renderWithProviders(<App />, { route: '/login' });

        expect(await screen.findByRole('heading', { name: 'Login' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
    });

    it('loads the settings screen for an administrator', async () => {
        renderWithProviders(<App />, { route: '/settings', context: adminContext() });

        expect(await settingsHeading()).toBeTruthy();
    });

    it('keeps a guest off the settings screen', async () => {
        renderWithProviders(<><App /><Location /></>, { route: '/settings', context: { dashboardLayout: [plex] } });

        await waitFor(() => expect(location()).toBe('/'));
        expect(await screen.findByText('Plex')).toBeTruthy();
        expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    });

    it('runs the first-time setup wizard until an account exists', async () => {
        renderWithProviders(<App />, { context: { isFirstTimeSetup: true, setupComplete: false, dashboardLayout: [plex] } });

        expect(await screen.findByRole('heading', { name: 'Welcome to Lab Dash' })).toBeTruthy();
        expect(screen.queryByText('Plex')).toBeNull();
    });

    it('returns to the dashboard once setup is complete', () => {
        renderWithProviders(<App />, { context: { isFirstTimeSetup: true, setupComplete: true, dashboardLayout: [plex] } });

        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.queryByText('Welcome to Lab Dash')).toBeNull();
    });

    it('switches pages and screens with the number shortcuts', async () => {
        renderWithProviders(<><App /><Location /></>, { context: adminContext({ pages: [makePage('Media'), makePage('Home Lab')] }) });

        fireEvent.keyDown(document, { key: '3', ctrlKey: true });
        expect(location()).toBe('/home-lab');

        fireEvent.keyDown(document, { key: '9', metaKey: true });
        expect(location()).toBe('/settings');
        expect(await settingsHeading()).toBeTruthy();

        fireEvent.keyDown(document, { key: '1', ctrlKey: true });
        expect(location()).toBe('/');
    });
});

describe('AppContextProvider', () => {
    /** Reads what the real provider exposes */
    const Consumer = () => {
        const { config, dashboardLayout, pages, isFirstTimeSetup, isLoggedIn, isAdmin, username } = useAppContext();

        return (
            <div>
                <span data-testid='title'>{config?.title ?? 'no config yet'}</span>
                <ul>{dashboardLayout.map(item => <li key={item.id}>{item.label}</li>)}</ul>
                <ul>{pages.map(page => <li key={page.id}>page: {page.name}</li>)}</ul>
                <span data-testid='setup'>{String(isFirstTimeSetup)}</span>
                <span data-testid='auth'>{isLoggedIn ? `${username} (${isAdmin ? 'admin' : 'user'})` : 'guest'}</span>
            </div>
        );
    };
    const text = (id: string) => screen.getByTestId(id).textContent;

    it('loads the configuration and exposes its layout and pages', async () => {
        vi.mocked(DashApi.getConfig).mockResolvedValueOnce({
            layout: { desktop: [plex], mobile: [] },
            pages: [makePage('Media')],
            title: 'Home Lab'
        });
        renderWithProviders(<AppContextProvider><Consumer /></AppContextProvider>);

        expect(text('title')).toBe('no config yet');
        await waitFor(() => expect(text('title')).toBe('Home Lab'));
        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getByText('page: Media')).toBeTruthy();
        expect(text('setup')).toBe('false');
        expect(text('auth')).toBe('guest');
        expect(DashApi.checkIfUsersExist).toHaveBeenCalledTimes(1);
        expect(DashApi.getConfig).toHaveBeenCalledTimes(1);
    });

    it('reports first-time setup while no account exists', async () => {
        vi.mocked(DashApi.checkIfUsersExist).mockResolvedValueOnce(false);
        renderWithProviders(<AppContextProvider><Consumer /></AppContextProvider>);

        await waitFor(() => expect(text('setup')).toBe('true'));
    });

    it('recognises a returning administrator from the session cookies', async () => {
        vi.mocked(DashApi.checkCookies).mockResolvedValueOnce({ hasAccessToken: true, hasRefreshToken: true });
        vi.mocked(DashApi.checkIsAdmin).mockResolvedValueOnce(true);
        localStorage.setItem('username', 'admin');

        try {
            renderWithProviders(<AppContextProvider><Consumer /></AppContextProvider>);

            await waitFor(() => expect(text('auth')).toBe('admin (admin)'));
        } finally {
            localStorage.removeItem('username');
        }
    });
});
