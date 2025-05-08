import { useEffect, useState } from 'react';

import { DashApi } from '../api/dash-api';
import { TWO_MIN_IN_MS } from '../constants/constants';

export function useServiceStatus(
    pingUrl: string | null | undefined,
    healthCheckType: 'http' | 'ping' = 'http',
    intervalMs = TWO_MIN_IN_MS
) {
    const [isOnline, setIsOnline] = useState<boolean | null>(null);

    useEffect(() => {
        if (!pingUrl) return;

        let timer: NodeJS.Timeout | null = null;

        async function checkStatus() {
            try {
                if (!pingUrl) return;
                const status = await DashApi.checkServiceHealth(pingUrl, healthCheckType);
                setIsOnline(status === 'online');
            } catch {
                setIsOnline(false);
            }
        }

        checkStatus();
        timer = setInterval(checkStatus, intervalMs);

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [pingUrl, healthCheckType, intervalMs]);

    return isOnline;
}
