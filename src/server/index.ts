/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require('dotenv');
const http = require('http');
// const os = require('os');

dotenv.config();

function getLocalIPAddress(): string | null {
    // const interfaces = os.networkInterfaces();

    // for (const interfaceName in interfaces) {
    //     const iface = interfaces[interfaceName];
    //     if (!iface) continue;

    //     for (const addressInfo of iface) {
    //         // Check for IPv4 and non-internal (non-loopback) address
    //         if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
    //             return addressInfo.address;
    //         }
    //     }
    // }

    // return null;
    return 'host.docker.internal';
}

// Create an HTTP server
const server = http.createServer((req: any, res: any) => {
    // Set common headers for CORS and content type
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight CORS request
    if (req.method === 'OPTIONS') {
        res.writeHead(204);  // No Content for preflight request
        return res.end();
    }

    if (req.url === '/local-ip' && req.method === 'GET') {
        const localIP = getLocalIPAddress();

        if (localIP) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ip: localIP }));
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unable to retrieve local IP address' }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

// Start the server
const PORT = 3033;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}/local-ip`);
});
