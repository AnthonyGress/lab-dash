// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { useLiveData } from '../../src/hooks/useLiveData';
import { LiveState, realtime } from '../../src/realtime/socket';

// No WebSocket is ever opened: the socket module is replaced by the in-memory store below
vi.mock('../../src/realtime/socket', () => ({ realtime: { watch: vi.fn(), getState: vi.fn() } }));

type Listener = () => void;

const EMPTY: LiveState = Object.freeze({});
const streamKey = (topic: string, itemId?: string): string => `${topic}|${itemId ?? ''}`;

// What the real socket holds for each stream, and who is watching it
let states: Map<string, LiveState>;
let listeners: Map<string, Set<Listener>>;
// Every function `watch` handed back, in the order it was asked
let unsubscribes: Mock<Listener>[];

/** The server pushed a new state for a stream; everyone watching it is told */
const push = (topic: string, itemId: string | undefined, state: LiveState): void => {
    const key = streamKey(topic, itemId);
    states.set(key, state);
    act(() => {
        listeners.get(key)?.forEach(listener => listener());
    });
};

const pushData = (topic: string, itemId: string | undefined, data: unknown): void => {
    push(topic, itemId, { data });
};

/** An error keeps the last good value next to it, as the real socket does */
const pushError = (topic: string, itemId: string | undefined, message: string): void => {
    push(topic, itemId, { data: states.get(streamKey(topic, itemId))?.data, error: message });
};

beforeEach(() => {
    states = new Map();
    listeners = new Map();
    unsubscribes = [];

    vi.mocked(realtime.watch).mockImplementation((topic, itemId, listener) => {
        const key = streamKey(topic, itemId);
        const watching = listeners.get(key) ?? new Set<Listener>();
        listeners.set(key, watching);
        watching.add(listener);

        const unsubscribe = vi.fn(() => {
            watching.delete(listener);
        });
        unsubscribes.push(unsubscribe);
        return unsubscribe;
    });
    // useSyncExternalStore compares snapshots by reference, so the same object
    // must come back until a push replaces it, exactly as the real socket does
    vi.mocked(realtime.getState).mockImplementation((topic, itemId) => states.get(streamKey(topic, itemId)) ?? EMPTY);
});

afterEach(cleanup);

describe('useLiveData', () => {
    it('starts out loading and watches the stream once', () => {
        const { result } = renderHook(() => useLiveData('weather', 'w1'));

        expect(result.current).toStrictEqual({ data: undefined, error: undefined, loading: true });
        expect(realtime.watch).toHaveBeenCalledTimes(1);
        expect(realtime.watch).toHaveBeenCalledWith('weather', 'w1', expect.any(Function));
    });

    it('shows a value as soon as it is pushed', () => {
        const { result } = renderHook(() => useLiveData('weather', 'w1'));

        pushData('weather', 'w1', { temp: 21 });

        expect(result.current).toStrictEqual({ data: { temp: 21 }, error: undefined, loading: false });
    });

    it('shows the value a stream already has without waiting for a push', () => {
        pushData('weather', 'w1', { temp: 21 });

        const { result } = renderHook(() => useLiveData('weather', 'w1'));

        expect(result.current).toStrictEqual({ data: { temp: 21 }, error: undefined, loading: false });
    });

    it('is done loading once a falsy value arrives', () => {
        const { result } = renderHook(() => useLiveData('counter'));

        pushData('counter', undefined, 0);

        expect(result.current).toStrictEqual({ data: 0, error: undefined, loading: false });
    });

    it('keeps the last value beside an error', () => {
        const { result } = renderHook(() => useLiveData('weather', 'w1'));

        pushData('weather', 'w1', { temp: 21 });
        pushError('weather', 'w1', 'Weather service unreachable');

        expect(result.current).toStrictEqual({ data: { temp: 21 }, error: 'Weather service unreachable', loading: false });
    });

    it('stops loading when the first thing to arrive is an error', () => {
        const { result } = renderHook(() => useLiveData('weather', 'w1'));

        pushError('weather', 'w1', 'Weather service unreachable');

        expect(result.current).toStrictEqual({ data: undefined, error: 'Weather service unreachable', loading: false });
    });

    it('stops watching when unmounted', () => {
        const { unmount } = renderHook(() => useLiveData('weather', 'w1'));

        unmount();

        expect(unsubscribes).toHaveLength(1);
        expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
    });

    it('types the value as asked for', () => {
        const { result } = renderHook(() => useLiveData<{ temp: number }>('weather', 'w1'));

        pushData('weather', 'w1', { temp: 21 });

        // The type parameter is a cast: nothing is checked at runtime
        expect(result.current.data?.temp).toBe(21);
    });
});

describe('when disabled', () => {
    it('never watches and is not loading', () => {
        const { result } = renderHook(() => useLiveData('weather', 'w1', false));

        expect(realtime.watch).not.toHaveBeenCalled();
        expect(result.current).toStrictEqual({ data: undefined, error: undefined, loading: false });
    });

    it('starts watching once enabled', () => {
        const { result, rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) => useLiveData('weather', 'w1', enabled),
            { initialProps: { enabled: false } },
        );

        rerender({ enabled: true });

        expect(realtime.watch).toHaveBeenCalledTimes(1);
        expect(realtime.watch).toHaveBeenCalledWith('weather', 'w1', expect.any(Function));
        expect(result.current.loading).toBe(true);

        pushData('weather', 'w1', { temp: 21 });

        expect(result.current.data).toEqual({ temp: 21 });
    });

    it('lets go of the stream and its value when disabled again', () => {
        const { result, rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) => useLiveData('weather', 'w1', enabled),
            { initialProps: { enabled: true } },
        );
        pushData('weather', 'w1', { temp: 21 });

        rerender({ enabled: false });

        expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
        expect(result.current).toStrictEqual({ data: undefined, error: undefined, loading: false });
    });
});

describe('switching streams', () => {
    it('leaves the old item and shows the new one', () => {
        const { result, rerender } = renderHook(
            ({ itemId }: { itemId: string }) => useLiveData('weather', itemId),
            { initialProps: { itemId: 'w1' } },
        );
        pushData('weather', 'w1', 'first');

        rerender({ itemId: 'w2' });

        expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
        expect(realtime.watch).toHaveBeenCalledTimes(2);
        expect(realtime.watch).toHaveBeenLastCalledWith('weather', 'w2', expect.any(Function));
        expect(result.current).toStrictEqual({ data: undefined, error: undefined, loading: true });

        pushData('weather', 'w2', 'second');
        expect(result.current.data).toBe('second');

        // The stream it left no longer reaches it
        pushData('weather', 'w1', 'stale');
        expect(result.current.data).toBe('second');
    });

    it('leaves the old topic and shows the new one', () => {
        const { result, rerender } = renderHook(
            ({ topic }: { topic: string }) => useLiveData(topic),
            { initialProps: { topic: 'weather' } },
        );
        pushData('weather', undefined, 'sunny');
        pushData('system', undefined, { cpu: 12 });

        rerender({ topic: 'system' });

        expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
        expect(realtime.watch).toHaveBeenLastCalledWith('system', undefined, expect.any(Function));
        expect(result.current).toStrictEqual({ data: { cpu: 12 }, error: undefined, loading: false });
    });
});

describe('several streams', () => {
    it('updates every hook watching the same stream from one push', () => {
        const first = renderHook(() => useLiveData('weather', 'w1'));
        const second = renderHook(() => useLiveData('weather', 'w1'));

        pushData('weather', 'w1', { temp: 21 });

        expect(first.result.current.data).toEqual({ temp: 21 });
        expect(second.result.current.data).toEqual({ temp: 21 });
    });

    it('does not re-render for a push to another stream', () => {
        let renders = 0;
        const { result } = renderHook(() => {
            renders += 1;
            return useLiveData('weather', 'w1');
        });
        const rendersBefore = renders;

        pushData('weather', 'w2', { temp: 30 });
        pushData('system', undefined, { cpu: 12 });

        expect(renders).toBe(rendersBefore);
        expect(result.current.loading).toBe(true);
    });
});
