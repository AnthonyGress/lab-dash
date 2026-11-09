// Import this file first. It pins SECRET and serves an in-memory config.json so
// tests never read or write the real one.
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

process.env.SECRET = 'test-only-secret-value-at-least-32-characters';

const CONFIG_FILE = path.resolve(__dirname, '../../src/config/config.json');
const isConfigFile = (file: unknown): boolean => typeof file === 'string' && path.resolve(file) === CONFIG_FILE;

// Unreachable on purpose: allowed requests fail fast upstream instead of hanging
const upstream = { host: '127.0.0.1', port: '1', apiKey: 'key', username: 'user', password: 'pass' };

export const fixture: any = {
    layout: {
        desktop: [
            { id: 'public-radarr', type: 'radarr-widget', config: upstream },
            { id: 'admin-radarr', type: 'radarr-widget', adminOnly: true, config: upstream },
            { id: 'public-qbit', type: 'torrent-client', config: { ...upstream, clientType: 'qbittorrent' } },
            { id: 'public-seerr', type: 'media-request-manager-widget', config: upstream },
            { id: 'public-pihole', type: 'pihole-widget', config: upstream },
            {
                id: 'public-group',
                type: 'group-widget',
                config: {
                    items: [{
                        id: 'group-child',
                        type: 'app-shortcut',
                        url: 'http://saved-in-group.test/',
                        macAddress: 'AA:BB:CC:DD:EE:01'
                    }]
                }
            },
            {
                id: 'admin-group',
                type: 'group-widget',
                adminOnly: true,
                config: { items: [{ id: 'admin-group-child', type: 'radarr-widget', config: upstream }] }
            },
            { id: 'dual', type: 'dual-widget', config: { topWidget: { type: 'radarr-widget', config: upstream } } },
            { id: 'health', type: 'app-shortcut', url: 'http://placeholder.test/', config: {} },
            { id: 'public-wol', type: 'app-shortcut', config: { isWol: true, macAddress: 'AA-BB-CC-DD-EE-02' } },
            {
                id: 'admin-wol',
                type: 'app-shortcut',
                adminOnly: true,
                config: { isWol: true, macAddress: 'AA:BB:CC:DD:EE:03' }
            }
        ],
        mobile: [
            // Same item hidden on desktop but visible on mobile: guests can see it
            { id: 'admin-on-desktop-only', type: 'radarr-widget', config: upstream }
        ]
    },
    pages: [
        {
            id: 'admin-page',
            name: 'Admin',
            adminOnly: true,
            layout: { desktop: [{ id: 'admin-page-item', type: 'radarr-widget', config: upstream }], mobile: [] }
        }
    ]
};
fixture.layout.desktop.push({ id: 'admin-on-desktop-only', type: 'radarr-widget', adminOnly: true, config: upstream });

const realReadFileSync = fs.readFileSync;
const realExistsSync = fs.existsSync;

fs.readFileSync = (file: unknown, ...rest: unknown[]) => (
    isConfigFile(file) ? JSON.stringify(fixture) : realReadFileSync(file, ...rest)
);
fs.existsSync = (file: unknown) => isConfigFile(file) || realExistsSync(file);
