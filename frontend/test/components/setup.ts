// Runs before every component test file (see vite.config.ts, project "components").
// It gives jsdom the browser APIs the components touch and replaces the two
// modules that would otherwise reach a server: the HTTP API and the realtime socket.
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// ---- Browser APIs jsdom does not implement -----------------------------------

class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

const matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
});

Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: matchMedia });
Object.defineProperty(window, 'ResizeObserver', { writable: true, configurable: true, value: ResizeObserverStub });
Object.defineProperty(window, 'IntersectionObserver', { writable: true, configurable: true, value: IntersectionObserverStub });
Object.defineProperty(window, 'scrollTo', { writable: true, configurable: true, value: () => undefined });
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { writable: true, configurable: true, value: () => undefined });
Object.defineProperty(URL, 'createObjectURL', { writable: true, configurable: true, value: () => 'blob:test' });
Object.defineProperty(URL, 'revokeObjectURL', { writable: true, configurable: true, value: () => undefined });

// SVG measurement, used by the charts
const zeroBox = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) });
Object.defineProperty(window.SVGElement.prototype, 'getBBox', { writable: true, configurable: true, value: zeroBox });
Object.defineProperty(window.SVGElement.prototype, 'getComputedTextLength', { writable: true, configurable: true, value: () => 0 });

// ---- Modules that would reach a server ---------------------------------------

/** What each DashApi method resolves to unless a test says otherwise. */
export const API_DEFAULTS: Record<string, unknown> = {
    getConfig: { layout: { desktop: [], mobile: [] }, pages: [] },
    saveConfig: { layout: { desktop: [], mobile: [] }, pages: [] },
    saveLayout: undefined,
    importConfig: true,
    exportConfig: undefined,
    getIconList: [],
    getCustomIcons: [],
    getNotes: [],
    createNote: { id: 'note', title: '', content: '', createdAt: '', updatedAt: '', fontSize: '16px' },
    updateNote: { id: 'note', title: '', content: '', createdAt: '', updatedAt: '', fontSize: '16px' },
    deleteNote: undefined,
    updateAllNotesFontSize: { message: '', updatedCount: 0 },
    getSystemInformation: null,
    getTimezone: { timezone: 'UTC' },
    getIPAddresses: { wan: null, lan: null },
    uploadBackgroundImage: null,
    cleanBackgroundImages: true,
    updateContainer: { success: false, message: '' },
    uploadAppIcon: null,
    uploadAppIconsBatch: [],
    getUploadedImages: [],
    deleteUploadedImage: true,
    checkIfUsersExist: true,
    checkIsAdmin: false,
    refreshToken: { success: false },
    checkCookies: { hasAccessToken: false, hasRefreshToken: false },
    sendWakeOnLan: { message: 'sent' },
    signup: { message: 'ok', username: 'user' },
    login: { username: 'user', isAdmin: false },
    logout: undefined,
    encryptPassword: 'ENC:test',
    encryptPiholeToken: 'ENC:test',
    encryptPiholePassword: 'ENC:test',
    encryptAdGuardUsername: 'ENC:test',
    encryptAdGuardPassword: 'ENC:test',
    encryptSabnzbdPassword: 'ENC:test',
    encryptNzbgetPassword: 'ENC:test'
};

vi.mock('../../src/api/dash-api', () => {
    const methods = new Map<string, ReturnType<typeof vi.fn>>();
    // Every static method is a mock resolving to its default; the same mock comes back
    // each time so tests can read `vi.mocked(DashApi.getConfig).mock.calls`
    const DashApi = new Proxy({}, {
        get: (_target, name: string | symbol) => {
            if (typeof name !== 'string') return undefined;
            if (name === 'setupAxiosInterceptors') return () => undefined;
            if (!methods.has(name)) {
                methods.set(name, vi.fn().mockImplementation(() => Promise.resolve(API_DEFAULTS[name])));
            }
            return methods.get(name);
        }
    });
    return { DashApi };
});

vi.mock('../../src/realtime/socket', () => {
    const states = new Map<string, unknown>();
    const key = (topic: string, itemId?: string) => `${topic}|${itemId ?? ''}`;
    // useSyncExternalStore needs the same object back until the value changes
    const EMPTY = Object.freeze({});
    const realtime = {
        clientId: 'test-tab',
        watch: vi.fn(() => () => undefined),
        getState: vi.fn((topic: string, itemId?: string) => states.get(key(topic, itemId)) ?? EMPTY),
        call: vi.fn(() => Promise.resolve(undefined)),
        on: vi.fn(() => () => undefined),
        reconnect: vi.fn(),
        getStatus: vi.fn(() => 'open'),
        onStatus: vi.fn(() => () => undefined),
        /** Test helper: what `useLiveData` reports for a stream from now on */
        __setState: (topic: string, itemId: string | undefined, state: unknown) => {
            states.set(key(topic, itemId), state);
        }
    };
    return { realtime };
});

afterEach(() => {
    cleanup();
});
