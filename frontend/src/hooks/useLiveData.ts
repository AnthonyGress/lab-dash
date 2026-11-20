import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { LiveState, realtime } from '../realtime/socket';

const DISABLED: LiveState = Object.freeze({});
const noop = () => undefined;

export type LiveData<T> = {
    /** Latest value pushed by the server; stays set while an error is shown */
    data?: T;
    error?: string;
    loading: boolean;
};

/**
 * Subscribes a component to a live stream. Only this component re-renders when
 * a new value arrives, and every component watching the same stream shares one
 * server subscription.
 *
 * @param itemId the dashboard item the stream belongs to, if the topic needs one
 * @param enabled pass false to stay unsubscribed (e.g. the widget is not configured yet)
 */
export const useLiveData = <T = unknown>(topic: string, itemId?: string, enabled = true): LiveData<T> => {
    const subscribe = useCallback(
        (listener: () => void) => (enabled ? realtime.watch(topic, itemId, listener) : noop),
        [topic, itemId, enabled]
    );
    const getSnapshot = useCallback(
        () => (enabled ? realtime.getState(topic, itemId) : DISABLED),
        [topic, itemId, enabled]
    );
    const state = useSyncExternalStore(subscribe, getSnapshot);

    return useMemo(() => ({
        data: state.data as T | undefined,
        error: state.error,
        loading: enabled && state.data === undefined && state.error === undefined
    }), [state, enabled]);
};
