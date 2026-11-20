import http from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';

import { createApp } from '../../src/app';

/** The directory that holds `public/` and `node_modules/`, as index.ts passes it. */
export const BACKEND_ROOT = path.resolve(__dirname, '../..');

export type Reply = {
    status: number;
    /** The parsed JSON body, or the raw text when it is not JSON */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    headers: Headers;
};

/** Sends `body` as JSON; a string body is sent as written, to test malformed input. */
export type Call = (method: string, url: string, cookie?: string, body?: unknown) => Promise<Reply>;

export type RunningApp = {
    baseUrl: string;
    call: Call;
    close: () => void;
};

/**
 * Serves the app on a free local port. Import '../helpers/fixture-config' before
 * this module so the app reads the throwaway config and users files.
 */
export const startApp = (): Promise<RunningApp> => new Promise(resolve => {
    const server = http.createServer(createApp(BACKEND_ROOT));

    server.listen(0, '127.0.0.1', () => {
        const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        const call: Call = async (method, url, cookie, body) => {
            const response = await fetch(`${baseUrl}${url}`, {
                method,
                headers: {
                    ...(cookie ? { cookie } : {}),
                    ...(body === undefined ? {} : { 'content-type': 'application/json' })
                },
                body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
                signal: AbortSignal.timeout(8000)
            });
            const text = await response.text();

            let parsed: unknown = text;
            try {
                parsed = JSON.parse(text);
            } catch {
                // Not JSON: the text is handed back as it came
            }
            return { status: response.status, body: parsed, headers: response.headers };
        };

        resolve({ baseUrl, call, close: () => server.close() });
    });
});
