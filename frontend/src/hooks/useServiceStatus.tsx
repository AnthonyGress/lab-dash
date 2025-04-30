import { useEffect, useState } from 'react';

import { DashApi } from '../api/dash-api';
import { TWO_MIN_IN_MS } from '../constants/constants';
import { useAppContext } from '../context/useAppContext';

export function useServiceStatus(
    pingUrl: string | null | undefined,
    intervalMs = TWO_MIN_IN_MS
) {
    const [isOnline, setIsOnline] = useState<boolean | null>(null);
    const { refreshCounter } = useAppContext();

    useEffect(() => {
        if (!pingUrl) return;

        let timer: NodeJS.Timeout | null = null;

        async function checkStatus() {
            try {
                if (!pingUrl) return;
                const status = await DashApi.checkServiceHealth(pingUrl);
                setIsOnline(status === 'online');
            } catch {
                setIsOnline(false);
            }
        }

        // Check status immediately
        checkStatus();

        // Set up the interval
        timer = setInterval(checkStatus, intervalMs);

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [pingUrl, intervalMs, refreshCounter]); // Add refreshCounter dependency to re-check on dashboard refresh

    return isOnline;
}
