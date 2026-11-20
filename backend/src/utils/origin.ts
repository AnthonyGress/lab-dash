import { NextFunction, Request, Response } from 'express';
import { IncomingHttpHeaders } from 'http';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const hostnameOf = (host: string | undefined): string | undefined => {
    try {
        return host ? new URL(`http://${host.split(',')[0].trim()}`).hostname : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Whether a request comes from one of the dashboard's own pages. The login is a
 * cookie, which the browser also attaches to requests another site makes, so
 * only pages served from this dashboard's hostname may use it. Scheme and port
 * are ignored on purpose: behind a TLS-terminating proxy the server sees plain
 * HTTP on another port, and the dev frontend runs on its own.
 */
export const isAllowedOrigin = ({ headers }: { headers: IncomingHttpHeaders }): boolean => {
    const { origin } = headers;
    // Only browsers send Origin, and only browsers carry someone else's cookies
    if (!origin) return true;
    // Set by the browser itself, page scripts cannot: holds even when a proxy rewrote the host
    if (headers['sec-fetch-site'] === 'same-origin') return true;

    let originUrl: URL;
    try {
        originUrl = new URL(origin);
    } catch {
        return false;
    }

    const configured = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(entry => entry.trim());
    if (configured.includes(originUrl.origin)) return true;

    const forwardedHost = headers['x-forwarded-host'];
    return [headers.host, Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost]
        .some(host => hostnameOf(host) === originUrl.hostname);
};

/** Refuses changes that another site sends in the name of a logged-in visitor. */
export const rejectCrossSiteWrites = (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method) || isAllowedOrigin(req)) {
        next();
        return;
    }

    res.status(403).json({
        message: 'Request refused: it was not sent from this dashboard. '
            + 'Behind a reverse proxy, pass the original Host header through or set ALLOWED_ORIGINS.'
    });
};
