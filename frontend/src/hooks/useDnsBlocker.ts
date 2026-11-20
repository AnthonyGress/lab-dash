import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLiveData } from './useLiveData';
import { ToastManager } from '../components/toast/ToastManager';
import { realtime } from '../realtime/socket';

export type DnsStats = {
    // Pi-hole v5 sends these pre-formatted ("120,000"); they are only ever displayed
    domains_being_blocked?: number;
    dns_queries_today?: number;
    ads_blocked_today?: number;
    ads_percentage_today?: number | string;
    status?: string;
    /** Seconds until blocking turns itself back on */
    timer?: number | null;
};

const initialStats: DnsStats = {
    domains_being_blocked: 0,
    dns_queries_today: 0,
    ads_blocked_today: 0,
    ads_percentage_today: 0,
    status: 'unknown',
    timer: null
};

/**
 * Live state of a DNS blocker widget (Pi-hole or AdGuard Home). The server pushes
 * statistics and whether blocking is on; pausing and resuming go back over the
 * same connection, and the server keeps the pause timer so every tab agrees.
 */
export const useDnsBlocker = (id: string | undefined, enabled: boolean) => {
    const { data, error, loading } = useLiveData<DnsStats>('dns.stats', id, enabled);
    const [isDisablingBlocking, setIsDisablingBlocking] = useState(false);
    const [remainingTime, setRemainingTime] = useState('');

    // The server reports the seconds left with every update; count down in between
    const pauseEndsAt = useMemo(
        () => (data?.status === 'disabled' && typeof data.timer === 'number' ? Date.now() + data.timer * 1000 : null),
        [data]
    );

    useEffect(() => {
        if (pauseEndsAt === null) {
            setRemainingTime('');
            return;
        }

        const update = () => {
            const seconds = Math.max(0, Math.round((pauseEndsAt - Date.now()) / 1000));
            setRemainingTime(`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [pauseEndsAt]);

    const run = useCallback(async (method: string, params?: unknown) => {
        setIsDisablingBlocking(true);
        try {
            // The server pushes the new state as soon as the blocker has applied it
            await realtime.call(method, id, params);
        } catch (actionError) {
            ToastManager.error((actionError as Error).message || 'Request failed');
        } finally {
            setIsDisablingBlocking(false);
        }
    }, [id]);

    return {
        stats: data ?? initialStats,
        isBlocking: data ? data.status !== 'disabled' : true,
        isLoading: loading,
        // Keep showing the last numbers through a hiccup; only a widget with nothing to show reports the error
        error: data ? null : error ?? null,
        remainingTime,
        isDisablingBlocking,
        /** Pauses blocking for `seconds`, or until enabled again when omitted */
        disable: useCallback((seconds?: number | null) => run('dns.disable', { seconds: seconds ?? null }), [run]),
        enable: useCallback(() => run('dns.enable'), [run]),
        retry: realtime.reconnect
    };
};
