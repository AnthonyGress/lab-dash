import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { emptyConfig, renderWithProviders } from './render';
import { CenteredModal } from '../../src/components/modals/CenteredModal';
import { SetupModal } from '../../src/components/modals/SetupModal';
import { UpdateModal } from '../../src/components/modals/UpdateModal';
import { VersionModal } from '../../src/components/modals/VersionModal';
import { getAppVersion } from '../../src/utils/version';

type Release = { tag_name: string; body: string; published_at: string };

// The update and version modals read releases from GitHub with `fetch`
const githubReturns = (releases: Release[]) =>
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(releases) })));
const githubIsDown = () =>
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
const release = (tag: string, body: string): Release => ({ tag_name: tag, body, published_at: '2026-01-02T00:00:00Z' });

/** Waits for the modal's spinner to go, so no state changes land after the test */
const releasesLoaded = () => waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('CenteredModal', () => {
    it('shows the title and content when open and closes from the close button', () => {
        const handleClose = vi.fn();
        renderWithProviders(
            <CenteredModal open handleClose={handleClose} title='Edit Item'>
                <p>modal body</p>
            </CenteredModal>
        );

        expect(screen.getByText('Edit Item')).toBeTruthy();
        expect(screen.getByText('modal body')).toBeTruthy();

        fireEvent.click(screen.getByLabelText('Close modal'));
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders nothing while closed', () => {
        renderWithProviders(
            <CenteredModal open={false} handleClose={vi.fn()} title='Hidden'>
                <p>modal body</p>
            </CenteredModal>
        );

        expect(screen.queryByText('Hidden')).toBeNull();
        expect(screen.queryByText('modal body')).toBeNull();
    });

    it('closes on Escape but ignores a click on the backdrop', () => {
        const handleClose = vi.fn();
        renderWithProviders(
            <CenteredModal open handleClose={handleClose} title='Keys'>
                <p>modal body</p>
            </CenteredModal>
        );

        fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
        expect(handleClose).not.toHaveBeenCalled();

        fireEvent.keyDown(screen.getByText('modal body'), { key: 'Escape' });
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});

describe('SetupModal', () => {
    const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const heading = (name: string) => screen.getByRole('heading', { name });

    it('opens on the welcome slide with Back disabled', () => {
        renderWithProviders(<SetupModal open onComplete={vi.fn()} />);

        expect(heading('Welcome to Lab Dash')).toBeTruthy();
        expect(heading('Your Personal Dashboard')).toBeTruthy();
        expect((screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('walks through the slides to the administrator account form', () => {
        renderWithProviders(<SetupModal open onComplete={vi.fn()} />);

        next();
        expect(heading('Dashboard Features')).toBeTruthy();
        next();
        expect(heading('Customization')).toBeTruthy();
        next();
        expect(heading('Privacy & Data Control')).toBeTruthy();
        next();
        expect(screen.getAllByText('Create Administrator Account').length).toBe(2);
        expect(screen.getByLabelText(/Username/)).toBeTruthy();
        expect(screen.getByLabelText(/^Password/)).toBeTruthy();
        expect(screen.getByLabelText(/Confirm Password/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Create Account & Continue' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(heading('Privacy & Data Control')).toBeTruthy();
    });

    it('refuses mismatched passwords before creating the account', async () => {
        const onComplete = vi.fn();
        renderWithProviders(<SetupModal open onComplete={onComplete} />);
        next(); next(); next(); next();

        fireEvent.change(screen.getByLabelText(/Username/), { target: { value: 'admin' } });
        fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'secret-1' } });
        fireEvent.change(screen.getByLabelText(/Confirm Password/), { target: { value: 'secret-2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Account & Continue' }));

        expect(await screen.findByText('Passwords do not match')).toBeTruthy();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('renders nothing while closed', () => {
        renderWithProviders(<SetupModal open={false} onComplete={vi.fn()} />);

        expect(screen.queryByText('Welcome to Lab Dash')).toBeNull();
    });
});

describe('UpdateModal', () => {
    it('names the new version and offers the update guide to an administrator', async () => {
        githubReturns([]);
        const handleClose = vi.fn();
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        renderWithProviders(<UpdateModal open handleClose={handleClose} latestVersion='v99.0.0' isAdmin />);

        expect(screen.getByText('Update Available')).toBeTruthy();
        expect(screen.getByText('A new version is available: v99.0.0')).toBeTruthy();
        await releasesLoaded();

        fireEvent.click(screen.getByRole('button', { name: 'Update Guide' }));
        expect(open).toHaveBeenCalledWith(expect.stringContaining('README.md#updating'), '_blank');
        expect(handleClose).toHaveBeenCalledTimes(1);
        open.mockRestore();
    });

    it('keeps the update guide from users who are not administrators', async () => {
        githubReturns([]);
        renderWithProviders(<UpdateModal open handleClose={vi.fn()} latestVersion='v99.0.0' isAdmin={false} />);

        expect(screen.getByText('A new version is available: v99.0.0')).toBeTruthy();
        await releasesLoaded();
        expect(screen.queryByRole('button', { name: 'Update Guide' })).toBeNull();
    });

    it('shows the release notes between the running and the new version', async () => {
        githubReturns([
            release('v99.0.0', '## Highlights\n- Faster grid\n\n**Full Changelog**: https://github.com/x/compare'),
            release('v0.0.1', '- Ancient history')
        ]);
        renderWithProviders(<UpdateModal open handleClose={vi.fn()} latestVersion='v99.0.0' isAdmin />);

        expect(await screen.findByText('Release Notes:')).toBeTruthy();
        expect(screen.getByText('Faster grid')).toBeTruthy();
        expect(screen.getByText(/^v99\.0\.0 - /)).toBeTruthy();
        // Older than the running version, so not part of this update
        expect(screen.queryByText('Ancient history')).toBeNull();
    });
});

describe('VersionModal', () => {
    const current = getAppVersion();

    it('lists the releases and marks the running version', async () => {
        githubReturns([release(`v${current}`, 'Current build notes'), release('v0.0.1', 'First release')]);
        renderWithProviders(<VersionModal open handleClose={vi.fn()} />);

        expect(screen.getByText('Release Notes')).toBeTruthy();
        expect(screen.getByText(`Current Version: ${current}`)).toBeTruthy();
        expect(await screen.findByText('Current build notes')).toBeTruthy();
        expect(screen.getByText('Current')).toBeTruthy();
        expect(screen.getByText('First release')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
    });

    it('loads five releases at a time', async () => {
        githubReturns(Array.from({ length: 7 }, (_, index) => release(`v0.${index}.0`, `Notes for release ${index}`)));
        renderWithProviders(<VersionModal open handleClose={vi.fn()} />);

        expect(await screen.findByText('Notes for release 0')).toBeTruthy();
        expect(screen.queryByText('Notes for release 6')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Load More' }));
        expect(screen.getByText('Notes for release 6')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
    });

    it('explains when the release notes cannot be fetched', async () => {
        githubIsDown();
        renderWithProviders(<VersionModal open handleClose={vi.fn()} />);

        expect(await screen.findByText('Unable to fetch release notes. Check your connection or try again later.')).toBeTruthy();
    });

    it('is titled as update information right after an update', async () => {
        githubReturns([]);
        renderWithProviders(<VersionModal open handleClose={vi.fn()} />, {
            context: { recentlyUpdated: true, config: emptyConfig({ lastSeenVersion: '0.0.1' }) }
        });

        expect(screen.getByText('Update Information')).toBeTruthy();
        expect(await screen.findByText('No release notes available.')).toBeTruthy();
    });
});
