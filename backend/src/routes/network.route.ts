import axios from 'axios';
import { exec } from 'child_process';
import * as dns from 'dns';
import * as net from 'net';
import { Request, Response, Router } from 'express';
import { promisify } from 'util';

export const networkRoute = Router();

const execAsync = promisify(exec);
const dnsLookup = promisify(dns.lookup);

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
 * Measure TCP connection latency to a host:port
 */
const measureTcpLatency = (host: string, port: number, timeout: number = 5000): Promise<number> => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const socket = new net.Socket();

        socket.setTimeout(timeout);

        socket.on('connect', () => {
            const latency = Date.now() - startTime;
            socket.destroy();
            resolve(latency);
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timeout'));
        });

        socket.on('error', (err) => {
            socket.destroy();
            reject(err);
        });

        socket.connect(port, host);
    });
};

/**
 * Try ICMP ping using system command
 */
const tryIcmpPing = async (host: string): Promise<{ latency: number; success: boolean }> => {
    try {
        // Detect OS and use appropriate ping command
        const isWindows = process.platform === 'win32';
        const command = isWindows
            ? `ping -n 3 -w 2000 ${host}`
            : `ping -c 3 -W 2 ${host}`;

        const { stdout } = await execAsync(command, { timeout: 10000 });

        // Parse Linux/macOS format: "rtt min/avg/max/mdev = 10.123/12.456/15.789/2.345 ms"
        const rttMatch = stdout.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);
        if (rttMatch && rttMatch[1]) {
            return { latency: Math.round(parseFloat(rttMatch[1]) * 100) / 100, success: true };
        }

        // Parse macOS format: "round-trip min/avg/max/stddev = 10.123/12.456/15.789/2.345 ms"
        const macMatch = stdout.match(/round-trip min\/avg\/max\/stddev = [\d.]+\/([\d.]+)\/[\d.]+\/[\d.]+ ms/);
        if (macMatch && macMatch[1]) {
            return { latency: Math.round(parseFloat(macMatch[1]) * 100) / 100, success: true };
        }

        // Parse Windows format: "Average = 12ms"
        const winMatch = stdout.match(/Average = (\d+)ms/);
        if (winMatch && winMatch[1]) {
            return { latency: parseInt(winMatch[1]), success: true };
        }

        // Try to find any "time=XX ms" pattern
        const timeMatch = stdout.match(/time[=<]([\d.]+)\s*ms/);
        if (timeMatch && timeMatch[1]) {
            return { latency: Math.round(parseFloat(timeMatch[1]) * 100) / 100, success: true };
        }

        return { latency: 0, success: false };
    } catch {
        return { latency: 0, success: false };
    }
};

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

    // Sanitize host input
    const sanitizedHost = host.trim();
    const hostRegex = /^[a-zA-Z0-9.\-:]+$/;

    if (!hostRegex.test(sanitizedHost)) {
        res.status(400).json({
            error: 'Invalid host',
            message: 'Host contains invalid characters'
        });
        return;
    }

    // First, try to resolve the hostname to verify it exists
    try {
        await dnsLookup(sanitizedHost);
    } catch {
        // If DNS lookup fails, the host doesn't exist or is unreachable
        res.json({
            host: sanitizedHost,
            latency: null,
            unit: 'ms',
            status: 'offline',
            message: 'Host could not be resolved'
        });
        return;
    }

    // Try ICMP ping first (works on native installations)
    const icmpResult = await tryIcmpPing(sanitizedHost);
    if (icmpResult.success) {
        res.json({
            host: sanitizedHost,
            latency: icmpResult.latency,
            unit: 'ms',
            status: 'online'
        });
        return;
    }

    // Fallback to TCP ping (works in Docker without special capabilities)
    // Try common ports: 443 (HTTPS), 80 (HTTP), 53 (DNS)
    const portsToTry = [443, 80, 53];

    for (const port of portsToTry) {
        try {
            const latency = await measureTcpLatency(sanitizedHost, port, 5000);
            res.json({
                host: sanitizedHost,
                latency: Math.round(latency * 100) / 100,
                unit: 'ms',
                status: 'online'
            });
            return;
        } catch {
            // Try next port
        }
    }

    // All methods failed
    res.json({
        host: sanitizedHost,
        latency: null,
        unit: 'ms',
        status: 'offline',
        message: 'Host is unreachable'
    });
});
