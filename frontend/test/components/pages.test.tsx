import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { adminContext, makeItem, renderWithProviders } from './render';
import { DashApi } from '../../src/api/dash-api';
import { DashboardPage } from '../../src/pages/DashboardPage';
import { LoginPage } from '../../src/pages/LoginPage';
import { SettingsPage } from '../../src/pages/SettingsPage';
import { ITEM_TYPE } from '../../src/types';

/** Shows where the router is, so redirects can be seen */
const Location = () => <span data-testid='location'>{useLocation().pathname}</span>;
const location = () => screen.getByTestId('location').textContent;

const plex = makeItem(ITEM_TYPE.APP_SHORTCUT, { id: 'plex', label: 'Plex', url: 'http://plex.local', showLabel: true });

describe('DashboardPage', () => {
    it('renders the grid of the current layout', () => {
        const { container } = renderWithProviders(<DashboardPage />, { context: { dashboardLayout: [plex] } });

        expect(screen.getByText('Plex')).toBeTruthy();
        expect(container.querySelector('[data-grid-item-id="plex"]')).not.toBeNull();
    });
});

describe('LoginPage', () => {
    const loginForm = () => {
        expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy();
        expect(screen.getByLabelText(/Username/)).toBeTruthy();
        expect(screen.getByLabelText(/Password/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
    };

    it('shows the login form at /login', () => {
        renderWithProviders(<LoginPage />, { route: '/login' });

        loginForm();
    });

    it('shows the same form at /signup', () => {
        renderWithProviders(<LoginPage />, { route: '/signup' });

        loginForm();
    });

    it('logs the user in and goes back to the page they came from', async () => {
        vi.mocked(DashApi.login).mockResolvedValueOnce({ message: 'Login successful', username: 'alice', isAdmin: true });
        const { context } = renderWithProviders(<><LoginPage /><Location /></>, { route: '/login' });

        fireEvent.change(screen.getByLabelText(/Username/), { target: { value: 'alice' } });
        fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'secret' } });
        fireEvent.click(screen.getByRole('button', { name: 'Login' }));

        await waitFor(() => expect(context.setIsLoggedIn).toHaveBeenCalledWith(true));
        expect(DashApi.login).toHaveBeenCalledWith('alice', 'secret');
        expect(context.setUsername).toHaveBeenCalledWith('alice');
        expect(context.setIsAdmin).toHaveBeenCalledWith(true);
        expect(location()).toBe('/');
    });
});

describe('SettingsPage', () => {
    it('shows the settings form to an administrator', () => {
        renderWithProviders(<SettingsPage />, { route: '/settings', context: adminContext() });

        expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'General' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Appearance' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Backup' })).toBeTruthy();
        expect(screen.getByRole('tab', { name: 'Hotkeys' })).toBeTruthy();
        expect(screen.getByText('Custom Title')).toBeTruthy();
    });

    it('sends a guest to the login page', async () => {
        renderWithProviders(<><SettingsPage /><Location /></>, { route: '/settings' });

        await waitFor(() => expect(location()).toBe('/login'));
        expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    });

    it('sends a signed-in user without admin rights home', async () => {
        renderWithProviders(<><SettingsPage /><Location /></>, {
            route: '/settings',
            context: { isLoggedIn: true, username: 'viewer', isAdmin: false }
        });

        await waitFor(() => expect(location()).toBe('/'));
        expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
    });
});
