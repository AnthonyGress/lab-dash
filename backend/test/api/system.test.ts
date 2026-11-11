// Must stay first: it swaps in the test config before any app module loads
import '../helpers/fixture-config';

import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Reply, RunningApp, startApp } from '../helpers/http';
import { cookieFor } from '../helpers/sessions';

const ADMIN = cookieFor('admin');
const USER = cookieFor('user');
const UPLOADS = process.env.UPLOAD_DIRECTORY!;
const ICONS = path.join(UPLOADS, 'app-icons');
const ICON = 'keep-1700000000000.png';
// A 1x1 PNG, so the stored bytes can be compared
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let app: RunningApp;
const call: RunningApp['call'] = (...args) => app.call(...args);

type Part = { name: string; bytes?: Buffer; type?: string };

/** Posts a background upload form with `part` in the "file" field, or none, as the admin. */
const upload = async (part?: Part): Promise<Reply> => {
    const form = new FormData();
    form.append('note', 'a plain field, so the form is never empty');
    if (part) {
        form.append('file', new File([new Uint8Array(part.bytes ?? PNG)], part.name, { type: part.type ?? 'image/png' }));
    }
    const response = await fetch(`${app.baseUrl}/api/system/upload`, {
        method: 'POST', headers: { cookie: ADMIN }, body: form, signal: AbortSignal.timeout(8000)
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
};
const wake = (body: unknown, cookie?: string) => call('POST', '/api/system/wol', cookie, body);
const rootFiles = (): string[] => fs.readdirSync(UPLOADS).filter(name => fs.statSync(path.join(UPLOADS, name)).isFile()).sort();

/** A UDP socket on a free localhost port that resolves `packet` with the first datagram it gets. */
const listenForPacket = () => new Promise<{ port: number; packet: Promise<Buffer>; close: () => void }>(resolve => {
    const socket = dgram.createSocket('udp4');
    const packet = new Promise<Buffer>((resolvePacket, reject) => {
        const timer = setTimeout(() => reject(new Error('No packet arrived within 3s')), 3000);
        socket.once('message', message => {
            clearTimeout(timer);
            resolvePacket(message);
        });
    });
    socket.bind(0, '127.0.0.1', () => resolve({ port: socket.address().port, packet, close: () => socket.close() }));
});
/** Six 0xFF bytes followed by the MAC address sixteen times: the Wake-on-LAN magic packet. */
const magicPacketFor = (mac: string): Buffer => {
    const address = Buffer.from(mac.split(/[:-]/).map(byte => parseInt(byte, 16)));
    return Buffer.concat([Buffer.alloc(6, 0xff), ...Array.from({ length: 16 }, () => address)]);
};

before(async () => {
    app = await startApp();
});
after(() => app.close());
beforeEach(() => {
    fs.rmSync(UPLOADS, { recursive: true, force: true });
    fs.mkdirSync(ICONS, { recursive: true });
    fs.writeFileSync(path.join(ICONS, ICON), PNG);
});

describe('system information', () => {
    // Reads the real machine, which spawns a few processes on the first call
    it('is public and describes the machine the server runs on', { timeout: 60_000 }, async () => {
        const response = await fetch(`${app.baseUrl}/api/system`, { signal: AbortSignal.timeout(50_000) });

        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(Object.keys(body).sort(), ['cpu', 'disk', 'memory', 'network', 'networkInterfaces', 'system']);
        assert.equal(typeof body.cpu.currentLoad, 'number');
        assert.equal(typeof body.system.platform, 'string');
        assert.equal(typeof body.system.uptime, 'number');
        assert.ok(Array.isArray(body.disk));
        assert.ok(Array.isArray(body.networkInterfaces));
    });
});

describe('uploading a background', () => {
    it('answers one clean 400 when no file is sent', async () => {
        for (const reply of [await call('POST', '/api/system/upload', ADMIN, {}), await upload()]) {
            assert.equal(reply.status, 400);
            assert.deepEqual(reply.body, { message: 'No file uploaded' });
        }
        assert.deepEqual(rootFiles(), []);
    });

    it('stores the image at the root of the uploads folder with spaces turned into underscores', async () => {
        const reply = await upload({ name: 'my cool wallpaper.png' });

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { message: 'File uploaded successfully', filePath: 'my_cool_wallpaper.png' });
        assert.deepEqual(fs.readFileSync(path.join(UPLOADS, 'my_cool_wallpaper.png')), PNG);
        assert.deepEqual(rootFiles(), ['my_cool_wallpaper.png']);
    });

    it('keeps only the newest background and leaves the app icons alone', async () => {
        fs.writeFileSync(path.join(UPLOADS, 'stray.txt'), 'left over from before');

        assert.equal((await upload({ name: 'first.png' })).status, 200);
        assert.deepEqual(rootFiles(), ['first.png']);

        assert.equal((await upload({ name: 'second.jpg', type: 'image/jpeg' })).status, 200);
        assert.deepEqual(rootFiles(), ['second.jpg']);
        assert.deepEqual(fs.readdirSync(ICONS), [ICON]);
    });

    it('refuses a file that is not an image', async () => {
        const reply = await upload({ name: 'notes.txt', bytes: Buffer.from('not an image'), type: 'text/plain' });

        assert.equal(reply.status, 400);
        assert.deepEqual(reply.body, { success: false, message: 'Invalid file type. Only JPEG, PNG, and GIF are allowed.' });
        assert.deepEqual(rootFiles(), []);
    });

    it('refuses a file over 5 MB and keeps nothing of it', async () => {
        const reply = await upload({ name: 'huge.png', bytes: Buffer.alloc(5 * 1024 * 1024 + 1) });

        assert.equal(reply.status, 400);
        assert.deepEqual(reply.body, { success: false, message: 'File too large' });
        assert.deepEqual(rootFiles(), []);
    });
});

describe('cleaning backgrounds', () => {
    it('removes the files at the root of the uploads folder and keeps the app icons', async () => {
        fs.writeFileSync(path.join(UPLOADS, 'wallpaper.png'), PNG);
        fs.writeFileSync(path.join(UPLOADS, 'stray.txt'), 'x');

        const reply = await call('POST', '/api/system/clean-background', ADMIN);

        assert.equal(reply.status, 200);
        assert.deepEqual(reply.body, { message: 'Background images cleaned successfully' });
        assert.deepEqual(rootFiles(), []);
        assert.deepEqual(fs.readdirSync(ICONS), [ICON]);
    });

    it('is for admins only, as is updating the container', async () => {
        fs.writeFileSync(path.join(UPLOADS, 'wallpaper.png'), PNG);

        for (const url of ['/api/system/clean-background', '/api/system/update-container']) {
            assert.equal((await call('POST', url)).status, 401, `guest ${url}`);
            assert.equal((await call('POST', url, USER)).status, 403, `user ${url}`);
        }
        assert.deepEqual(rootFiles(), ['wallpaper.png']);
    });
});

describe('wake-on-LAN', () => {
    it('needs a well-formed MAC address', async () => {
        const missing = await wake({ ip: '127.0.0.1' }, ADMIN);
        assert.equal(missing.status, 400);
        assert.deepEqual(missing.body, { message: 'MAC address is required' });

        for (const mac of ['AA:BB:CC:DD:EE', 'AA:BB:CC:DD:EE:GG', 'AABBCCDDEEFF', 'AA:BB:CC:DD:EE:FF:00', 'AA:BB:CC:DD:EE:FF; reboot']) {
            const reply = await wake({ mac, ip: '127.0.0.1' }, ADMIN);
            assert.equal(reply.status, 400, mac);
            assert.match(reply.body.message, /^Invalid MAC address format/, mac);
        }
    });

    it('needs a dotted IPv4 address and a port from 1 to 65535 when they are given', async () => {
        const mac = 'AA:BB:CC:DD:EE:03';

        for (const ip of ['localhost', '127.0.0.256', '::1', '10.0.0', '127.0.0.1; reboot']) {
            const reply = await wake({ mac, ip }, ADMIN);
            assert.equal(reply.status, 400, ip);
            assert.match(reply.body.message, /^Invalid IP address format/, ip);
        }
        for (const port of [70000, 65536, -1, 0, 'abc', '9abc', 1.5]) {
            const reply = await wake({ mac, ip: '127.0.0.1', port }, ADMIN);
            assert.equal(reply.status, 400, String(port));
            assert.match(reply.body.message, /^Invalid port/, String(port));
        }
    });

    it('refuses guests and regular users for a device that is not on a public shortcut', async () => {
        const target = { mac: 'AA:BB:CC:DD:EE:03', ip: '127.0.0.1', port: 9 };

        const guest = await wake(target);
        assert.equal(guest.status, 401);
        assert.deepEqual(guest.body, { message: 'Authentication required' });
        assert.equal((await wake(target, USER)).status, 401);
        // The address is checked before the caller is
        assert.equal((await wake({ mac: 'not-a-mac' })).status, 400);
    });

    it('sends the magic packet to the given address and port for an admin', async () => {
        const listener = await listenForPacket();

        try {
            const reply = await wake({ mac: 'AA:BB:CC:DD:EE:03', ip: '127.0.0.1', port: listener.port }, ADMIN);

            assert.equal(reply.status, 200);
            assert.deepEqual(reply.body, { message: 'Wake-on-LAN packet sent' });
            const packet = await listener.packet;
            assert.equal(packet.length, 102);
            assert.deepEqual(packet, magicPacketFor('AA:BB:CC:DD:EE:03'));
        } finally {
            listener.close();
        }
    });

    it('lets a guest wake the device of a public shortcut, whichever separator and case the address uses', async () => {
        const listener = await listenForPacket();

        try {
            // The fixture stores this one as AA-BB-CC-DD-EE-02; the port may arrive as text
            const reply = await wake({ mac: 'aa:bb:cc:dd:ee:02', ip: '127.0.0.1', port: String(listener.port) });

            assert.equal(reply.status, 200);
            assert.deepEqual(reply.body, { message: 'Wake-on-LAN packet sent' });
            assert.deepEqual(await listener.packet, magicPacketFor('aa:bb:cc:dd:ee:02'));
        } finally {
            listener.close();
        }
    });
});
