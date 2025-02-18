import { useEffect, useState } from 'react';

const TEN_MIN_IN_MS = 600000;

/**
 * Pings the given `pingUrl` at an interval to determine if it's online (HTTP 2xx) or offline.
 * If `pingUrl` is null/undefined, no checks are performed and `null` (unknown) is returned.
 */
export function useServiceStatus(
    pingUrl: string | null | undefined,
    intervalMs = TEN_MIN_IN_MS
) {
    const [isOnline, setIsOnline] = useState<boolean | null>(null);

    useEffect(() => {
        if (!pingUrl) return;

        let timer: NodeJS.Timeout | null = null;

        async function checkStatus() {
            try {
                if (!pingUrl) return;
                const response = await fetch(pingUrl, { method: 'GET', mode: 'no-cors' });
                console.log(response);

                setIsOnline(response.ok);
            } catch {
                setIsOnline(false);
            }
        }

        checkStatus();

        timer = setInterval(checkStatus, intervalMs);

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [pingUrl, intervalMs]);

    return isOnline;
}
