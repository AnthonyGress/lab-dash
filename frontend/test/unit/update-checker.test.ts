import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { checkForUpdates, compareVersions, fetchLatestRelease } from '../../src/utils/updateChecker';
import { getAppVersion } from '../../src/utils/version';

vi.mock('../../src/utils/version', () => ({ getAppVersion: vi.fn() }));

const LATEST_RELEASE_URL = 'https://api.github.com/repos/anthonygress/lab-dash/releases/latest';

const release = (tag: string) => ({
    tag_name: tag,
    name: `Lab Dash ${tag}`,
    published_at: '2026-01-01T00:00:00Z',
    html_url: `https://github.com/anthonygress/lab-dash/releases/tag/${tag}`,
});

const noUpdate = { updateAvailable: false, latestVersion: null, releaseUrl: null };

describe('compareVersions', () => {
    it('treats identical versions as equal', () => {
        expect(compareVersions('1.4.0', '1.4.0')).toBe(0);
    });

    it('ignores a leading v', () => {
        expect(compareVersions('v1.4.0', '1.4.0')).toBe(0);
        expect(compareVersions('1.4.0', 'v1.4.0')).toBe(0);
    });

    it('orders by major, then minor, then patch', () => {
        expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
        expect(compareVersions('1.5.0', '1.4.9')).toBeGreaterThan(0);
        expect(compareVersions('1.4.1', '1.4.0')).toBeGreaterThan(0);
        expect(compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
    });

    it('compares each part as a number, not as text', () => {
        expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    });

    it('reads a missing part as zero', () => {
        expect(compareVersions('1.4', '1.4.0')).toBe(0);
        expect(compareVersions('1.4.1', '1.4')).toBeGreaterThan(0);
        expect(compareVersions('1.4', '1.4.1')).toBeLessThan(0);
    });

    it('returns the difference of the first part that differs', () => {
        expect(compareVersions('1.4.3', '1.4.1')).toBe(2);
        expect(compareVersions('1.2.0', '1.5.9')).toBe(-3);
    });
});

describe('talking to GitHub', () => {
    let fetchMock: Mock<typeof fetch>;

    /** GitHub answers with this status and, when given, this JSON body */
    const answer = (status: number, body?: unknown): void => {
        fetchMock.mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
    };

    beforeEach(() => {
        fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.mocked(getAppVersion).mockReturnValue('1.4.0');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('fetchLatestRelease', () => {
        it('asks for the latest release without sending credentials', async () => {
            answer(200, release('v1.4.0'));

            await fetchLatestRelease();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith(LATEST_RELEASE_URL, expect.objectContaining({ credentials: 'omit' }));
        });

        it('returns the release GitHub describes', async () => {
            answer(200, release('v1.4.0'));

            await expect(fetchLatestRelease()).resolves.toEqual(release('v1.4.0'));
        });

        it('returns null and logs when GitHub refuses, such as a rate limit', async () => {
            answer(403);

            await expect(fetchLatestRelease()).resolves.toBeNull();
            expect(console.error).toHaveBeenCalledTimes(1);
        });

        it('returns null and logs when the body is not JSON', async () => {
            fetchMock.mockResolvedValue(new Response('<html>Service unavailable</html>', { status: 200 }));

            await expect(fetchLatestRelease()).resolves.toBeNull();
            expect(console.error).toHaveBeenCalledTimes(1);
        });

        it('returns null and logs when the request itself fails', async () => {
            fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

            await expect(fetchLatestRelease()).resolves.toBeNull();
            expect(console.error).toHaveBeenCalledTimes(1);
        });
    });

    describe('checkForUpdates', () => {
        it('offers an update when the latest release is newer than the running version', async () => {
            vi.mocked(getAppVersion).mockReturnValue('1.4.0');
            answer(200, release('v1.5.0'));

            await expect(checkForUpdates()).resolves.toEqual({
                updateAvailable: true,
                latestVersion: 'v1.5.0',
                releaseUrl: 'https://github.com/anthonygress/lab-dash/releases/tag/v1.5.0',
            });
        });

        it('offers nothing when the running version is the latest', async () => {
            vi.mocked(getAppVersion).mockReturnValue('1.4.0');
            answer(200, release('v1.4.0'));

            await expect(checkForUpdates()).resolves.toEqual(noUpdate);
        });

        it('offers nothing when the running version is ahead of the latest release', async () => {
            vi.mocked(getAppVersion).mockReturnValue('1.5.0');
            answer(200, release('v1.4.0'));

            await expect(checkForUpdates()).resolves.toEqual(noUpdate);
        });

        it('offers nothing, without throwing, when GitHub rate-limits the request', async () => {
            answer(403);

            await expect(checkForUpdates()).resolves.toEqual(noUpdate);
            expect(console.error).toHaveBeenCalled();
        });

        it('offers nothing, without throwing, when the network is down', async () => {
            fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

            await expect(checkForUpdates()).resolves.toEqual(noUpdate);
            expect(console.error).toHaveBeenCalled();
        });
    });
});
