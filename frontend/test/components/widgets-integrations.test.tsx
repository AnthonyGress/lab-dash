import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { adminContext, renderWithProviders } from './render';
import { setLive } from './widgets-helpers';
import { AdGuardWidget } from '../../src/components/dashboard/base-items/widgets/AdGuardWidget/AdGuardWidget';
import { DelugeWidget } from '../../src/components/dashboard/base-items/widgets/DelugeWidget';
import { DownloadClientWidget } from '../../src/components/dashboard/base-items/widgets/DownloadClientWidget';
import { LiveDownloadClientWidget } from '../../src/components/dashboard/base-items/widgets/LiveDownloadClientWidget';
import { LiveQueueWidget } from '../../src/components/dashboard/base-items/widgets/LiveQueueWidget';
import { MediaRequestManagerWidget } from '../../src/components/dashboard/base-items/widgets/MediaRequestManagerWidget';
import { MediaServerWidget } from '../../src/components/dashboard/base-items/widgets/MediaServerWidget/MediaServerWidget';
import { NzbgetWidget } from '../../src/components/dashboard/base-items/widgets/NzbgetWidget';
import { PiholeWidget } from '../../src/components/dashboard/base-items/widgets/PiholeWidget/PiholeWidget';
import { QBittorrentWidget } from '../../src/components/dashboard/base-items/widgets/QBittorrentWidget';
import { QueueManagementWidget } from '../../src/components/dashboard/base-items/widgets/QueueManagementWidget';
import { RadarrWidget } from '../../src/components/dashboard/base-items/widgets/RadarrWidget';
import { SabnzbdWidget } from '../../src/components/dashboard/base-items/widgets/SabnzbdWidget';
import { SonarrWidget } from '../../src/components/dashboard/base-items/widgets/SonarrWidget';
import { TransmissionWidget } from '../../src/components/dashboard/base-items/widgets/TransmissionWidget';
import { realtime } from '../../src/realtime/socket';

const downloadSnapshot = (name: string, state = 'downloading') => ({
    stats: { dl_info_speed: 1048576, dl_info_data: 5368709120, up_info_speed: 0, up_info_data: 0, torrents: { total: 1, downloading: 1, seeding: 0, completed: 0, paused: 0 } },
    torrents: [{ hash: 'abc', name, state, progress: 0.5, size: 2147483648, dlspeed: 524288, upspeed: 0, eta: 3600 }]
});

describe('download client widgets', () => {
    it('shows that it is connecting until the server has logged in', () => {
        renderWithProviders(<QBittorrentWidget id='dl-connecting' config={{ host: 'nas', showLabel: true }} />);

        expect(screen.getByText('qBittorrent')).toBeTruthy();
        expect(screen.getByText('Connecting...')).toBeTruthy();
        expect(screen.getByRole('progressbar')).toBeTruthy();
        expect(screen.queryByText('Retry')).toBeNull();
    });

    it('lists the downloads with their speed and progress', () => {
        setLive('download.client', 'dl-data', { data: downloadSnapshot('Ubuntu 24.04 ISO') });
        renderWithProviders(<QBittorrentWidget id='dl-data' config={{ host: 'nas' }} />);

        expect(screen.getByText('Ubuntu 24.04 ISO')).toBeTruthy();
        expect(screen.getByText('Active (1)')).toBeTruthy();
        expect(screen.getByText('ETA: 1h 0m')).toBeTruthy();
        expect(screen.getByText('50.0% / 2 GB')).toBeTruthy();
        expect(screen.getByText('512 KB/s')).toBeTruthy();
        expect(screen.getByText('1 MB/s')).toBeTruthy();
        expect(screen.getByText('5 GB')).toBeTruthy();
        expect(screen.queryByTestId('MoreVertIcon')).toBeNull();
    });

    it('shows the error from the server with a retry button', () => {
        setLive('download.client', 'dl-error', { error: 'qBittorrent is unreachable' });
        renderWithProviders(<QBittorrentWidget id='dl-error' config={{ host: 'nas' }} />);

        expect(screen.getByText('qBittorrent is unreachable')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(realtime.reconnect).toHaveBeenCalled();
    });

    it('lets an administrator stop a download from its menu', async () => {
        setLive('download.client', 'dl-admin', { data: downloadSnapshot('Big file') });
        renderWithProviders(<QBittorrentWidget id='dl-admin' config={{ host: 'nas' }} />, { context: adminContext() });

        fireEvent.click(screen.getByTestId('MoreVertIcon'));
        expect(screen.getByText('Remove')).toBeTruthy();
        fireEvent.click(screen.getByText('Stop'));

        await waitFor(() => expect(realtime.call).toHaveBeenCalledWith('download.pause', 'dl-admin', { id: 'abc' }));
    });

    it('uses pause and resume wording for Deluge and SABnzbd', () => {
        setLive('download.client', 'dl-deluge', { data: downloadSnapshot('Paused torrent', 'pausedDL') });
        setLive('download.client', 'dl-sab', { data: downloadSnapshot('Paused nzb', 'paused') });
        renderWithProviders(
            <>
                <DelugeWidget id='dl-deluge' config={{ showLabel: true }} />
                <SabnzbdWidget id='dl-sab' config={{ showLabel: true }} />
            </>,
            { context: adminContext() }
        );

        expect(screen.getByText('Deluge')).toBeTruthy();
        expect(screen.getByText('SABnzbd')).toBeTruthy();
        expect(screen.getByText('This month:')).toBeTruthy();
        expect(screen.getAllByText('Paused')).toHaveLength(2);

        fireEvent.click(screen.getAllByTestId('MoreVertIcon')[1]);
        expect(screen.getByText('Resume')).toBeTruthy();
    });

    it('renders the remaining client wrappers with their names', () => {
        setLive('download.client', 'dl-tr', { data: { ...downloadSnapshot('Linux'), torrents: [] } });
        renderWithProviders(
            <>
                <TransmissionWidget id='dl-tr' config={{ showLabel: true }} />
                <NzbgetWidget id='dl-nzb' config={{ showLabel: true }} />
                <LiveDownloadClientWidget clientName='Custom' defaultPort='1' id='dl-custom' config={{ showLabel: true }} />
            </>
        );

        expect(screen.getByAltText('Transmission')).toBeTruthy();
        expect(screen.getByText('No active items')).toBeTruthy();
        expect(screen.getByAltText('NZBGet')).toBeTruthy();
        expect(screen.getByText('Custom')).toBeTruthy();
    });

    it('offers a retry when the client rejects the login', () => {
        const handleLogin = vi.fn();
        renderWithProviders(
            <DownloadClientWidget clientName='qBittorrent' isLoading={false} isAuthenticated={false} authError='' stats={null} torrents={[]}
                loginCredentials={{ host: 'nas', port: '8080', ssl: false }} handleInputChange={vi.fn()} handleLogin={handleLogin} />
        );

        expect(screen.getByText('Authentication failed')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(handleLogin).toHaveBeenCalledTimes(1);
    });
});

const queueSnapshot = {
    queue: [{ id: 7, hash: 'h7', name: 'Severance S02E01', state: 'downloading', progress: 0.25, size: 1073741824, eta: 90, protocol: 'torrent', downloadClient: 'qBittorrent', indexer: 'Idx' }],
    statistics: { totalItems: 42, monitoredItems: 40 }
};

describe('Sonarr and Radarr queue widgets', () => {
    it('asks for the missing configuration', () => {
        renderWithProviders(
            <>
                <SonarrWidget id='arr-unconfigured' config={{ showLabel: true }} />
                <LiveQueueWidget serviceName='Lidarr' defaultPort='8686' id='arr-custom' config={{ host: 'lidarr', showLabel: true }} />
            </>
        );

        expect(screen.getByText('Sonarr')).toBeTruthy();
        expect(screen.getByText('Lidarr')).toBeTruthy();
        expect(screen.getAllByText('Configuration Error')).toHaveLength(2);
        expect(screen.getAllByText('Missing required configuration. Please configure host and API key.')).toHaveLength(2);
    });

    it('shows the queue and the library counts', () => {
        setLive('arr.queue', 'arr-data', { data: queueSnapshot });
        renderWithProviders(<SonarrWidget id='arr-data' config={{ host: 'sonarr', _hasApiKey: true }} />);

        expect(screen.getByText('Queue (1)')).toBeTruthy();
        expect(screen.getByText('Severance S02E01')).toBeTruthy();
        expect(screen.getByText('ETA: 1m 30s')).toBeTruthy();
        expect(screen.getByText('25% / 1 GB')).toBeTruthy();
        expect(screen.getByText('TORRENT')).toBeTruthy();
        expect(screen.getByText('Total TV Shows:')).toBeTruthy();
        expect(screen.getByText('42')).toBeTruthy();
        expect(screen.getByText('40')).toBeTruthy();
        expect(screen.queryByTestId('MoreVertIcon')).toBeNull();
    });

    it('shows the error from the server', () => {
        setLive('arr.queue', 'arr-error', { error: 'Sonarr is unreachable' });
        renderWithProviders(<SonarrWidget id='arr-error' config={{ host: 'sonarr', _hasApiKey: true }} />);

        expect(screen.getByText('Configuration Error')).toBeTruthy();
        expect(screen.getByText('Sonarr is unreachable')).toBeTruthy();
    });

    it('gives an administrator the removal menu', () => {
        setLive('arr.queue', 'arr-admin', { data: queueSnapshot });
        renderWithProviders(<RadarrWidget id='arr-admin' config={{ host: 'radarr', _hasApiKey: true }} />, { context: adminContext() });

        expect(screen.getByText('Total Movies:')).toBeTruthy();
        fireEvent.click(screen.getByTestId('MoreVertIcon'));
        expect(screen.getByText('Remove from Queue')).toBeTruthy();
        expect(screen.getByText('Blocklist & Remove')).toBeTruthy();
    });

    it('shows an empty queue while the statistics are still loading', () => {
        renderWithProviders(
            <QueueManagementWidget serviceName='Radarr' isLoading queueItems={[]} showLabel
                statistics={{ totalItems: 0, monitoredItems: 0, isLoading: true }} />
        );

        expect(screen.getByAltText('Radarr')).toBeTruthy();
        expect(screen.getByText('No items in queue')).toBeTruthy();
        expect(screen.getAllByText('...')).toHaveLength(2);
    });
});

const dnsStats = { domains_being_blocked: 120000, dns_queries_today: 5432, ads_blocked_today: 1234, ads_percentage_today: 22.7, status: 'enabled', timer: null };

describe('DNS blocker widgets', () => {
    it('asks to be configured', () => {
        renderWithProviders(
            <>
                <PiholeWidget id='pihole-none' />
                <AdGuardWidget id='adguard-none' config={{ host: 'adguard' }} />
            </>
        );

        expect(screen.getByText('Please configure the Pi-hole widget in settings')).toBeTruthy();
        expect(screen.getByText('Please configure the AdGuard Home widget in settings')).toBeTruthy();
    });

    it('spins until the first statistics arrive', () => {
        renderWithProviders(<PiholeWidget id='pihole-loading' config={{ host: 'pi.hole', _hasPassword: true }} />);
        expect(screen.getByRole('progressbar')).toBeTruthy();
    });

    it('shows the Pi-hole statistics and pauses blocking from the menu', async () => {
        setLive('dns.stats', 'pihole-data', { data: dnsStats });
        renderWithProviders(<PiholeWidget id='pihole-data' config={{ host: 'pi.hole', _hasPassword: true, showLabel: true, displayName: 'Home DNS' }} />);

        expect(screen.getByText('Home DNS')).toBeTruthy();
        expect(screen.getByAltText('Pi-hole logo')).toBeTruthy();
        expect(screen.getByText('1,234')).toBeTruthy();
        expect(screen.getByText('22.7%')).toBeTruthy();
        expect(screen.getByText('5,432')).toBeTruthy();
        expect(screen.getByText('120,000')).toBeTruthy();
        expect(screen.getByText('Domains on Adlists')).toBeTruthy();

        fireEvent.click(screen.getByText('Disable'));
        fireEvent.click(screen.getByText('5 minutes'));
        await waitFor(() => expect(realtime.call).toHaveBeenCalledWith('dns.disable', 'pihole-data', { seconds: 300 }));
    });

    it('says blocking is paused and offers to resume', async () => {
        setLive('dns.stats', 'pihole-paused', { data: { ...dnsStats, status: 'disabled' } });
        renderWithProviders(<PiholeWidget id='pihole-paused' config={{ host: 'pi.hole', _hasApiToken: true }} />);

        expect(screen.getByText('Blocking disabled indefinitely')).toBeTruthy();
        fireEvent.click(screen.getByText('Resume'));
        await waitFor(() => expect(realtime.call).toHaveBeenCalledWith('dns.enable', 'pihole-paused', undefined));
    });

    it('hides the pause button in edit mode', () => {
        setLive('dns.stats', 'pihole-edit', { data: dnsStats });
        renderWithProviders(<PiholeWidget id='pihole-edit' config={{ host: 'pi.hole', _hasApiToken: true }} />, { context: { editMode: true } });

        expect(screen.getByText('Blocked Today')).toBeTruthy();
        expect(screen.queryByText('Disable')).toBeNull();
    });

    it('shows the Pi-hole error with the authentication method in use', () => {
        setLive('dns.stats', 'pihole-error', { error: 'Pi-hole is unreachable' });
        renderWithProviders(<PiholeWidget id='pihole-error' config={{ host: 'pi.hole', _hasApiToken: true }} />);

        expect(screen.getByText('Pi-hole is unreachable')).toBeTruthy();
        expect(screen.getByText('Using API token authentication')).toBeTruthy();
        fireEvent.click(screen.getByText('Retry'));
        expect(realtime.reconnect).toHaveBeenCalled();
    });

    it('shows the AdGuard Home statistics and pauses protection', async () => {
        setLive('dns.stats', 'adguard-data', { data: { ...dnsStats, ads_percentage_today: '15.5' } });
        renderWithProviders(<AdGuardWidget id='adguard-data' config={{ host: 'adguard', _hasUsername: true, _hasPassword: true, showLabel: true }} />);

        expect(screen.getByText('AdGuard Home')).toBeTruthy();
        expect(screen.getByAltText('AdGuard Home logo')).toBeTruthy();
        expect(screen.getByText('15.5%')).toBeTruthy();
        expect(screen.getByText('Blocked Malware')).toBeTruthy();

        fireEvent.click(screen.getByText('Disable'));
        fireEvent.click(screen.getByText('Indefinitely'));
        await waitFor(() => expect(realtime.call).toHaveBeenCalledWith('dns.disable', 'adguard-data', { seconds: null }));
    });

    it('shows the AdGuard Home error', () => {
        setLive('dns.stats', 'adguard-error', { error: 'AdGuard Home is unreachable' });
        renderWithProviders(<AdGuardWidget id='adguard-error' config={{ host: 'adguard', username: 'u', password: 'p' }} />);

        expect(screen.getByText('AdGuard Home is unreachable')).toBeTruthy();
        expect(screen.getByText('Using Basic Authentication')).toBeTruthy();
    });
});

describe('media server widget', () => {
    const session = {
        Id: 's1', UserId: 'u1', UserName: 'alice', Client: 'Web', ApplicationVersion: '1', DeviceName: 'Living room TV', DeviceType: 'tv',
        PlayState: { IsPaused: false, PositionTicks: 18000000000, PlayMethod: 'DirectPlay' },
        NowPlayingItem: { Id: 'i1', Name: 'Pilot', Type: 'Episode', RunTimeTicks: 36000000000, SeriesName: 'Severance', IndexNumber: 1, ParentIndexNumber: 2 }
    };

    it('shows an empty session list when not configured', () => {
        renderWithProviders(<MediaServerWidget id='media-none' config={{ clientType: 'plex' }} />);

        expect(screen.getByText('Plex')).toBeTruthy();
        expect(screen.getByText('Watching (0)')).toBeTruthy();
        expect(screen.getByText('No active items')).toBeTruthy();
        expect(screen.getAllByText('...')).toHaveLength(2);
    });

    it('spins while the first sessions are loading', () => {
        renderWithProviders(<MediaServerWidget id='media-loading' config={{ host: 'jf', _hasApiKey: true, showLabel: false }} />);
        expect(screen.getByRole('progressbar')).toBeTruthy();
        expect(screen.queryByText('Jellyfin')).toBeNull();
    });

    it('shows who is watching what and the library sizes', () => {
        setLive('media.sessions', 'media-data', { data: { sessions: [session], libraryStats: { tvShows: 12, movies: 345 } } });
        renderWithProviders(<MediaServerWidget id='media-data' editMode config={{ host: 'jf', _hasApiKey: true, displayName: 'Living room' }} />);

        expect(screen.getByText('Living room')).toBeTruthy();
        expect(screen.getByText('Watching (1)')).toBeTruthy();
        expect(screen.getByText('Severance S2E1')).toBeTruthy();
        expect(screen.getByText('Pilot')).toBeTruthy();
        expect(screen.getByText('alice')).toBeTruthy();
        expect(screen.getByText('Playing')).toBeTruthy();
        expect(screen.getByText('TV Show')).toBeTruthy();
        expect(screen.getByText('50% / 1h 0m')).toBeTruthy();
        expect(screen.getByText('12')).toBeTruthy();
        expect(screen.getByText('345')).toBeTruthy();
        expect(screen.getByTestId('MoreVertIcon')).toBeTruthy();
    });

    it('shows the error from the server', () => {
        setLive('media.sessions', 'media-error', { error: 'Jellyfin is unreachable' });
        renderWithProviders(<MediaServerWidget id='media-error' config={{ host: 'jf', _hasApiKey: true, clientType: 'emby' }} />);

        expect(screen.getByText('Emby')).toBeTruthy();
        expect(screen.getByText('Jellyfin is unreachable')).toBeTruthy();
    });
});

describe('media request manager widget', () => {
    const request = {
        id: 1, type: 'movie', status: 1, createdAt: '2025-03-04T10:00:00Z', updatedAt: '2025-03-04T10:00:00Z', profileName: 'HD',
        media: { id: 10, mediaType: 'movie' as const, tmdbId: 438631, status: 2, title: 'Dune', releaseDate: '2021-10-22' },
        requestedBy: { id: 1, displayName: 'bob', username: 'bob' }
    };

    it('shows the search box and no requests when not configured', () => {
        renderWithProviders(<MediaRequestManagerWidget id='req-none' service='jellyseerr' showLabel />);

        expect(screen.getByText('Jellyseerr')).toBeTruthy();
        expect(screen.getByPlaceholderText('Search for movies or TV shows...')).toBeTruthy();
        expect(screen.getByText('Requests (0)')).toBeTruthy();
        expect(screen.getByText('No requests found')).toBeTruthy();
    });

    it('spins while the requests are loading and shows a configuration error', () => {
        const { rerender } = renderWithProviders(<MediaRequestManagerWidget id='req-loading' service='overseerr' host='ov' port='5055' _hasApiKey />);
        expect(screen.getByRole('progressbar')).toBeTruthy();

        rerender(<MediaRequestManagerWidget id='req-loading' service='overseerr' host='ov' port='5055' _hasApiKey error='API key rejected' />);
        expect(screen.getByText('Configuration Error')).toBeTruthy();
        expect(screen.getByText('API key rejected')).toBeTruthy();
    });

    it('lists the requests and lets an administrator approve them', () => {
        setLive('media.requests', 'req-data', { data: { requests: [request] } });
        const { unmount } = renderWithProviders(
            <MediaRequestManagerWidget id='req-data' service='jellyseerr' host='js' port='5055' _hasApiKey displayName='Requests' showLabel />
        );

        expect(screen.getByText('Requests (1)')).toBeTruthy();
        expect(screen.getByText('Dune')).toBeTruthy();
        expect(screen.getByText('2021 • Movie')).toBeTruthy();
        expect(screen.getByText('Profile: HD')).toBeTruthy();
        expect(screen.getByText('bob')).toBeTruthy();
        expect(screen.getByText('Pending')).toBeTruthy();
        const guestButtons = screen.queryAllByRole('button').length;
        unmount();

        renderWithProviders(
            <MediaRequestManagerWidget id='req-data' service='jellyseerr' host='js' port='5055' _hasApiKey />,
            { context: adminContext() }
        );
        expect(screen.getByText('Dune')).toBeTruthy();
        expect(screen.getAllByRole('button')).toHaveLength(guestButtons + 2);
    });
});
