import https from 'https';

/**
 * Agent for every HTTPS request to a service on the dashboard. Self-signed
 * certificates are accepted unless VERIFY_CERTIFICATES is `true`: these services
 * usually sit on the local network, where few have a certificate a public
 * authority signed. A private authority can be trusted with NODE_EXTRA_CA_CERTS.
 */
export const upstreamAgent = new https.Agent({
    rejectUnauthorized: process.env.VERIFY_CERTIFICATES === 'true',
    keepAlive: true
});
