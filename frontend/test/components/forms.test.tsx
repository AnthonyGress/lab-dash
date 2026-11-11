// The standalone forms and form inputs: file pickers, the icon search, login,
// first-run setup and the settings page form.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderInForm } from './form-host';
import { adminContext, emptyConfig, makeItem, renderWithProviders } from './render';
import { DashApi } from '../../src/api/dash-api';
import { FileInput } from '../../src/components/forms/FileInput';
import { IconSearch } from '../../src/components/forms/IconSearch';
import { LoginForm } from '../../src/components/forms/LoginForm';
import { MultiFileInput } from '../../src/components/forms/MultiFileInput';
import { SettingsForm } from '../../src/components/forms/SettingsForm';
import { SetupForm } from '../../src/components/forms/SetupForm';
import { VirtualizedListbox } from '../../src/components/forms/VirtualizedListBox';
import { ToastInitializer } from '../../src/components/toast/ToastInitializer';
import { initialItems } from '../../src/constants/constants';

const MB = 1024 * 1024;

const png = (name: string, size = 4) => new File([new Uint8Array(size)], name, { type: 'image/png' });

const fileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement;
const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (field: HTMLInputElement, value: string) => fireEvent.change(field, { target: { value } });

describe('FileInput', () => {
    it('shows its label and placeholder, then the chosen file name', () => {
        const { container, form } = renderInForm(() => <FileInput name='backgroundFile' label='Background' sx={{}} />);

        expect(screen.getByText('Background', { selector: 'label' })).toBeTruthy();
        expect(screen.getByText('Select a File')).toBeTruthy();
        expect(fileInput(container).accept).toContain('image/png');

        fireEvent.change(fileInput(container), { target: { files: [png('wallpaper.png')] } });

        expect(screen.getByText('wallpaper')).toBeTruthy();
        expect(screen.getByText('.png')).toBeTruthy();
        expect((form().getValues('backgroundFile' as never) as unknown as File).name).toBe('wallpaper.png');
    });

    it('refuses a file over the size limit and says so', () => {
        const { container, form } = renderInForm(() => <FileInput name='backgroundFile' maxSize={MB} sx={{}} />);

        fireEvent.change(fileInput(container), { target: { files: [png('huge.png', MB + 1)] } });

        expect(screen.getByText('File is too large (1MB max)')).toBeTruthy();
        expect(form().getValues('backgroundFile' as never)).toBeUndefined();
    });
});

describe('MultiFileInput', () => {
    it('accepts several files up to the limit named in its placeholder', () => {
        const { container, form } = renderInForm(() => <MultiFileInput name='appIconFiles' maxFiles={3} sx={{}} />);

        expect(screen.getByText('Select up to 3 files')).toBeTruthy();
        expect(fileInput(container).multiple).toBe(true);

        fireEvent.change(fileInput(container), { target: { files: [png('a.png'), png('b.png')] } });

        expect(screen.getByText('2 files')).toBeTruthy();
        expect((form().getValues('appIconFiles' as never) as unknown as File[]).map((file) => file.name)).toEqual(['a.png', 'b.png']);
    });

    it('refuses more files than allowed', () => {
        const { container } = renderInForm(() => <MultiFileInput name='appIconFiles' maxFiles={2} sx={{}} />);

        fireEvent.change(fileInput(container), { target: { files: [png('a.png'), png('b.png'), png('c.png')] } });

        expect(screen.getByText('Too many files (2 max)')).toBeTruthy();
    });
});

describe('IconSearch', () => {
    it('renders the icon picker and loads the built-in and custom icon lists', async () => {
        renderInForm((form) => <IconSearch control={form.control} errors={form.formState.errors} />);

        expect(screen.getByLabelText('Select Icon*')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Select Custom Icon' })).toBeTruthy();
        await waitFor(() => expect(DashApi.getIconList).toHaveBeenCalled());
        expect(DashApi.getCustomIcons).toHaveBeenCalled();
    });

    it('previews a custom icon picked from disk and hands the file up', () => {
        const onCustomIconSelect = vi.fn();
        const { container, form } = renderInForm((ctx) => (
            <IconSearch control={ctx.control} errors={ctx.formState.errors} onCustomIconSelect={onCustomIconSelect} />
        ));

        const file = png('plex-logo.png');
        fireEvent.change(fileInput(container), { target: { files: [file] } });

        expect(onCustomIconSelect).toHaveBeenCalledWith(file);
        // The preview caption is derived from the blob URL rather than the file name (see
        // getIconDisplayName), so only the image source and the form value are checked
        expect(container.querySelector('img[src="blob:test"]')).not.toBeNull();
        expect(screen.getByRole('combobox').getAttribute('value')).not.toBe('');
        expect(form().getValues('icon')).toEqual({ name: 'plex-logo', path: 'blob:test', source: 'custom-pending' });
    });

    it('shows the saved icon of an existing item', () => {
        renderInForm((form) => <IconSearch control={form.control} errors={form.formState.errors} />, {
            defaultValues: { icon: { name: 'Plex', path: 'plex.png' } }
        });

        expect(screen.getByAltText('Plex')).toBeTruthy();
        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getByRole('combobox').getAttribute('value')).toBe('Plex');
    });
});

describe('VirtualizedListbox', () => {
    const sized = (property: 'offsetWidth' | 'offsetHeight', value: number) => {
        const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property);
        Object.defineProperty(HTMLElement.prototype, property, { configurable: true, get: () => value });
        return () => {
            if (original) Object.defineProperty(HTMLElement.prototype, property, original);
            else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[property];
        };
    };

    it('renders its rows once the auto-sizer can measure the box', () => {
        // jsdom lays nothing out, so give AutoSizer a box to measure
        const restore = [sized('offsetWidth', 300), sized('offsetHeight', 300)];
        try {
            renderWithProviders(
                <VirtualizedListbox role='listbox'>
                    <li>Alpha</li>
                    <li>Beta</li>
                    <li>Gamma</li>
                </VirtualizedListbox>
            );

            expect(screen.getByRole('listbox')).toBeTruthy();
            expect(screen.getByText('Alpha')).toBeTruthy();
            expect(screen.getByText('Beta')).toBeTruthy();
            expect(screen.getByText('Gamma')).toBeTruthy();
        } finally {
            restore.forEach((undo) => undo());
        }
    });
});

describe('LoginForm', () => {
    // The app mounts ToastInitializer once at the root so ToastManager can reach the
    // provider; it is mounted here for the same reason, so the toasts really render
    const loginPage = <><ToastInitializer /><LoginForm /></>;

    it('renders the login heading, both fields and the button', () => {
        renderWithProviders(<LoginForm />);

        expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy();
        expect(input(/^Username/).placeholder).toBe('Username');
        expect(input(/^Password/).type).toBe('password');
        expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy();
    });

    it('logs in with the typed credentials and reports success', async () => {
        vi.mocked(DashApi.login).mockResolvedValueOnce({ message: 'ok', username: 'alice', isAdmin: true });
        const { context } = renderWithProviders(loginPage);

        type(input(/^Username/), 'alice');
        type(input(/^Password/), 'secret');
        fireEvent.click(screen.getByRole('button', { name: 'Login' }));

        await waitFor(() => expect(DashApi.login).toHaveBeenCalledWith('alice', 'secret'));
        await waitFor(() => expect(context.setIsLoggedIn).toHaveBeenCalledWith(true));
        expect(context.setUsername).toHaveBeenCalledWith('alice');
        expect(context.setIsAdmin).toHaveBeenCalledWith(true);
        expect(context.refreshDashboard).toHaveBeenCalled();
        expect(await screen.findByText('Login successful!')).toBeTruthy();
    });

    it('shows the server error when the login fails', async () => {
        vi.mocked(DashApi.login).mockRejectedValueOnce(new Error('Invalid credentials'));
        const { context } = renderWithProviders(loginPage);

        type(input(/^Username/), 'alice');
        type(input(/^Password/), 'wrong');
        fireEvent.click(screen.getByRole('button', { name: 'Login' }));

        expect(await screen.findByText('Invalid credentials')).toBeTruthy();
        expect(context.setIsLoggedIn).not.toHaveBeenCalled();
    });

    it('does not call the server until both fields are filled', async () => {
        renderWithProviders(<LoginForm />);

        fireEvent.click(screen.getByRole('button', { name: 'Login' }));

        await waitFor(() => expect(input(/^Username/).getAttribute('aria-invalid')).toBe('true'));
        expect(DashApi.login).not.toHaveBeenCalled();
    });
});

describe('SetupForm', () => {
    afterEach(() => {
        // sweetalert2 leaves its popup in the body after a successful setup; React's own
        // tree is unmounted by the harness, so only the popup is swept away here
        document.querySelectorAll('.swal2-container').forEach((node) => node.remove());
    });

    const reachAccountStep = async () => {
        for (let step = 0; step < 4; step++) {
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        }
        await screen.findByRole('heading', { level: 6, name: 'Create Administrator Account' });
    };

    it('opens on the welcome slide and walks through to the account form', async () => {
        renderWithProviders(<SetupForm onSuccess={() => undefined} />);

        expect(screen.getByRole('heading', { name: 'Welcome to Lab Dash' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(screen.getByRole('heading', { name: 'Dashboard Features' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        // the step title and the form's own heading both carry the name
        expect(screen.getAllByRole('heading', { name: 'Create Administrator Account' })).toHaveLength(2);
        expect(screen.getByText('This will be the first user account for your dashboard')).toBeTruthy();
        expect(input(/^Username/)).toBeTruthy();
        expect(input(/^Password/).type).toBe('password');
        expect(input(/^Confirm Password/).type).toBe('password');
        expect(screen.getByRole('button', { name: 'Create Account & Continue' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    });

    it('rejects mismatched passwords before creating the account', async () => {
        renderWithProviders(<SetupForm onSuccess={() => undefined} />);
        await reachAccountStep();

        type(input(/^Username/), 'admin');
        type(input(/^Password/), 'secret1');
        type(input(/^Confirm Password/), 'secret2');
        fireEvent.click(screen.getByRole('button', { name: 'Create Account & Continue' }));

        expect(await screen.findByText('Passwords do not match')).toBeTruthy();
        expect(DashApi.signup).not.toHaveBeenCalled();
    });

    it('creates the admin, logs in and seeds a fresh dashboard', async () => {
        const onSuccess = vi.fn();
        const { context } = renderWithProviders(<SetupForm onSuccess={onSuccess} />);
        await reachAccountStep();

        type(input(/^Username/), 'admin');
        type(input(/^Password/), 'secret1');
        type(input(/^Confirm Password/), 'secret1');
        fireEvent.click(screen.getByRole('button', { name: 'Create Account & Continue' }));

        await waitFor(() => expect(DashApi.signup).toHaveBeenCalledWith('admin', 'secret1'));
        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
        expect(DashApi.login).toHaveBeenCalledWith('admin', 'secret1');
        expect(context.setIsLoggedIn).toHaveBeenCalledWith(true);
        expect(context.setUsername).toHaveBeenCalledWith('admin');
        expect(context.updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            isSetupComplete: true,
            search: true,
            layout: { desktop: initialItems, mobile: initialItems }
        }));
        expect(context.refreshDashboard).toHaveBeenCalled();
    });

    it('keeps a dashboard that already has items when the account is recreated', async () => {
        vi.mocked(DashApi.getConfig).mockResolvedValueOnce({
            layout: { desktop: [makeItem('app-shortcut')], mobile: [] },
            pages: []
        });
        const onSuccess = vi.fn();
        const { context } = renderWithProviders(<SetupForm onSuccess={onSuccess} />);
        await reachAccountStep();

        type(input(/^Username/), 'admin');
        type(input(/^Password/), 'secret1');
        type(input(/^Confirm Password/), 'secret1');
        fireEvent.click(screen.getByRole('button', { name: 'Create Account & Continue' }));

        await waitFor(() => expect(onSuccess).toHaveBeenCalled());
        expect(context.updateConfig).toHaveBeenCalledWith({ isSetupComplete: true });
    });
});

describe('SettingsForm', () => {
    const settings = (overrides: Parameters<typeof emptyConfig>[0] = {}) => adminContext({
        config: emptyConfig({
            title: 'My Dash',
            search: true,
            searchProvider: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}' },
            ...overrides
        })
    });

    it('shows the current settings to an admin with nothing to save yet', () => {
        renderWithProviders(<SettingsForm />, { context: settings() });

        expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Save Changes' }).hasAttribute('disabled')).toBe(true);
        for (const tab of ['General', 'Appearance', 'Backup', 'Hotkeys']) {
            expect(screen.getByRole('tab', { name: tab })).toBeTruthy();
        }
        expect(screen.getByText('General Settings')).toBeTruthy();
        expect(screen.getByText('Custom Title')).toBeTruthy();
        expect((screen.getByDisplayValue('My Dash') as HTMLInputElement).name).toBe('title');
        // The general toggles have no labels of their own: search, internet indicator, IP
        const [search, internet, ip] = screen.getAllByRole('checkbox') as HTMLInputElement[];
        expect(search.checked).toBe(true);
        expect(internet.checked).toBe(true);
        expect(ip.checked).toBe(false);
        expect(screen.getByText('Search Provider')).toBeTruthy();
        // The selects carry no label element, so their visible choice is what can be read
        expect(screen.getByRole('combobox').textContent).toBe('DuckDuckGo');
        expect(screen.queryByText('IP Display Type')).toBeNull();
        expect(screen.getByRole('button', { name: 'Reset All Settings' })).toBeTruthy();
    });

    it('shows the IP display type and custom provider fields when they apply', () => {
        renderWithProviders(<SettingsForm />, {
            context: settings({
                showIP: true,
                ipDisplayType: 'lan',
                searchProvider: { name: 'Kagi', url: 'https://kagi.com/search?q={query}' }
            })
        });

        expect(screen.getByText('IP Display Type')).toBeTruthy();
        const [ipDisplayType, searchProvider] = screen.getAllByRole('combobox');
        expect(ipDisplayType.textContent).toBe('LAN (Local IP)');
        expect(searchProvider.textContent).toBe('Custom');
        expect(screen.getByText('Provider Name')).toBeTruthy();
        expect(screen.getByDisplayValue('Kagi')).toBeTruthy();
        expect(screen.getByDisplayValue('https://kagi.com/search?q={query}')).toBeTruthy();
    });

    it('enables saving once the title changes and saves the new title', async () => {
        const { context } = renderWithProviders(<SettingsForm />, { context: settings() });

        type(screen.getByDisplayValue('My Dash') as HTMLInputElement, 'Home Lab');

        const save = screen.getByRole('button', { name: 'Save Changes' });
        await waitFor(() => expect(save.hasAttribute('disabled')).toBe(false));
        fireEvent.click(save);

        await waitFor(() => expect(context.updateConfig).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Home Lab',
            search: true,
            searchProvider: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}' }
        })));
        document.querySelectorAll('.swal2-container').forEach((node) => node.remove());
    });

    it('lists the appearance, backup and hotkey settings on their tabs', async () => {
        renderWithProviders(<SettingsForm />, { context: settings({ themeColor: '#112233' }) });

        fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
        expect(screen.getByText('Appearance Settings')).toBeTruthy();
        expect(screen.getByText('Accent Color')).toBeTruthy();
        expect(screen.getByText('#112233')).toBeTruthy();
        expect(screen.getByRole('radio', { name: 'Upload File' })).toBeTruthy();
        expect(screen.getByText('Select a File')).toBeTruthy();
        expect(screen.getByText('Upload App Icons')).toBeTruthy();
        expect(screen.getByText('Select up to 20 files')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Reset Background' })).toBeTruthy();
        expect(await screen.findByText('No uploaded images found.')).toBeTruthy();
        expect(DashApi.getUploadedImages).toHaveBeenCalled();

        fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
        expect(screen.getByText('Backup Settings')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
        expect(screen.getByText('Restore Configuration')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Copy Desktop Layout to Mobile' })).toBeTruthy();

        fireEvent.click(screen.getByRole('tab', { name: 'Hotkeys' }));
        expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
        expect(screen.getByText('Focus search bar')).toBeTruthy();
        expect(screen.getByText('Go to Settings page')).toBeTruthy();
    });

    it('swaps the background picker for a URL field', () => {
        renderWithProviders(<SettingsForm />, { context: settings() });
        fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));

        fireEvent.click(screen.getByRole('radio', { name: 'Use URL' }));

        expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeTruthy();
        expect(screen.queryByText('Select a File')).toBeNull();
    });
});
