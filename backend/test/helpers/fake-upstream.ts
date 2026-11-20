import http from 'node:http';
import { AddressInfo } from 'node:net';

export type Seen = { method: string; url: string; headers: http.IncomingHttpHeaders; body: string };
export type Fake = { server: http.Server; port: number; seen: Seen[] };

/** A stand-in for an integration's web API. Records every request it receives. */
export const startFake = async (
    handle: (request: Seen, response: http.ServerResponse) => void
): Promise<Fake> => {
    const seen: Seen[] = [];
    const server = http.createServer((request, response) => {
        let body = '';
        request.on('data', chunk => {
            body += chunk;
        });
        request.on('end', () => {
            const entry = { method: request.method ?? '', url: request.url ?? '', headers: request.headers, body };
            seen.push(entry);
            handle(entry, response);
        });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    return { server, port: (server.address() as AddressInfo).port, seen };
};

export const json = (response: http.ServerResponse, body: unknown, headers: http.OutgoingHttpHeaders = {}): void => {
    response.writeHead(200, { 'content-type': 'application/json', ...headers });
    response.end(JSON.stringify(body));
};
