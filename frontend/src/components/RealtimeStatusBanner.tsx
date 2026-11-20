import { Alert, Snackbar } from '@mui/material';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { realtime } from '../realtime/socket';

/**
 * Tells the user when live widget data cannot be delivered. The usual cause is a
 * reverse proxy that does not forward WebSocket connections.
 */
export const RealtimeStatusBanner = () => {
    const status = useSyncExternalStore(realtime.onStatus, realtime.getStatus);
    const [dismissed, setDismissed] = useState(false);

    // Show it again if the connection recovers and later fails once more
    useEffect(() => {
        if (status === 'open') setDismissed(false);
    }, [status]);

    return (
        <Snackbar
            open={status === 'unavailable' && !dismissed}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
            <Alert severity='warning' variant='filled' onClose={() => setDismissed(true)}>
                Live updates are unavailable. If you use a reverse proxy, enable WebSocket support for this site.
            </Alert>
        </Snackbar>
    );
};
