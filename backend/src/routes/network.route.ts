import axios from 'axios';
import { exec } from 'child_process';
import { Request, Response, Router } from 'express';
import { promisify } from 'util';

export const networkRoute = Router();

const execAsync = promisify(exec);

// Services to try for public IP lookup (in order of preference)
const PUBLIC_IP_SERVICES = [
    'https://api.ipify.org?format=json',
    'https://ifconfig.me/ip',
    'https://icanhazip.com'
];

/**
 * GET /api/network/public-ip
 * Fetches the server's public IP address
 */
networkRoute.get('/public-ip', async (_req: Request, res: Response): Promise<void> => {
    for (const service of PUBLIC_IP_SERVICES) {
        try {
            const response = await axios.get(service, { timeout: 5000 });

            let ip: string;

            // Handle different response formats
            if (typeof response.data === 'object' && response.data.ip) {
                ip = response.data.ip;
            } else if (typeof response.data === 'string') {
                ip = response.data.trim();
            } else {
                continue;
            }

            // Validate IP format (basic validation)
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (ipRegex.test(ip)) {
                res.json({ ip });
                return;
            }
        } catch (error) {
            // Try next service
            console.log(`Failed to fetch public IP from ${service}:`, (error as Error).message);
        }
    }

    res.status(503).json({
        error: 'Unable to fetch public IP',
        message: 'All IP lookup services failed'
    });
});

/**
 * GET /api/network/ping
 * Measures latency to a target host
 * Query params:
 *   - host: hostname or IP address to ping (required)
 */
networkRoute.get('/ping', async (req: Request, res: Response): Promise<void> => {
    const { host } = req.query;

    if (!host || typeof host !== 'string') {
        res.status(400).json({
            error: 'Invalid request',
            message: 'Host parameter is required'
        });
        return;
    }

    // Sanitize host input to prevent command injection
    // Only allow alphanumeric characters, dots, hyphens, and colons (for IPv6)
    const sanitizedHost = host.trim();
    const hostRegex = /^[a-zA-Z0-9.\-:]+$/;

    if (!hostRegex.test(sanitizedHost)) {
        res.status(400).json({
            error: 'Invalid host',
            message: 'Host contains invalid characters'
        });
        return;
    }

    try {
        // Use ping command with timeout
        // -c 3: send 3 packets
        // -W 2: 2 second timeout per packet
        const { stdout } = await execAsync(`ping -c 3 -W 2 ${sanitizedHost}`);

        // Parse the ping output to extract average latency
        // Example output line: "rtt min/avg/max/mdev = 10.123/12.456/15.789/2.345 ms"
        const rttMatch = stdout.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);

        if (rttMatch && rttMatch[1]) {
            const avgLatency = parseFloat(rttMatch[1]);
            res.json({
                host: sanitizedHost,
                latency: Math.round(avgLatency * 100) / 100, // Round to 2 decimal places
                unit: 'ms',
                status: 'online'
            });
            return;
        }

        // Alternative parsing for different ping output formats
        const timeMatch = stdout.match(/time[=<]([\d.]+)\s*ms/);
        if (timeMatch && timeMatch[1]) {
            const latency = parseFloat(timeMatch[1]);
            res.json({
                host: sanitizedHost,
                latency: Math.round(latency * 100) / 100,
                unit: 'ms',
                status: 'online'
            });
            return;
        }

        // Host is reachable but couldn't parse latency
        res.json({
            host: sanitizedHost,
            latency: null,
            unit: 'ms',
            status: 'online',
            message: 'Host is reachable but latency could not be determined'
        });
    } catch (error) {
        // Ping failed - host is unreachable
        res.json({
            host: sanitizedHost,
            latency: null,
            unit: 'ms',
            status: 'offline',
            message: 'Host is unreachable'
        });
    }
});
