import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

import { Config } from '../types';
import { getRequestOrigin } from '../utils/request-origin';

/** What a change touched, so listeners can skip work that does not concern them. */
export type ConfigChangeScope = 'config' | 'notes';
export type ConfigChange = { scope: ConfigChangeScope; origin?: string };

const DEFAULT_CONFIG_FILE = path.join(__dirname, '../config/config.json');

// Read on use so tests (and CONFIG_FILE set in .env) take effect
export const getConfigFile = (): string => process.env.CONFIG_FILE || DEFAULT_CONFIG_FILE;

const emptyConfig = (): Config => ({ layout: { desktop: [], mobile: [] } });

type Cached = { file: string; mtimeMs: number; size: number; config: Config };

let cached: Cached | undefined;
const events = new EventEmitter();

const readFromDisk = (file: string): Config | undefined => {
    try {
        const content = fs.readFileSync(file, 'utf-8');
        if (!content.trim()) {
            console.error('Config file is empty, using default config');
            return undefined;
        }
        return JSON.parse(content);
    } catch (error) {
        console.error('Error reading config file, using default config:', (error as Error).message);
        return undefined;
    }
};

/**
 * The current config, parsed once and reused until the file changes on disk.
 * Treat the result as read-only: every change goes through `updateConfig`.
 */
export const getConfig = (): Config => {
    const file = getConfigFile();

    let stat: fs.Stats;
    try {
        stat = fs.statSync(file);
    } catch {
        return emptyConfig();
    }

    if (cached && cached.file === file && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return cached.config;
    }

    const config = readFromDisk(file);
    if (!config) return emptyConfig();

    const editedOutsideTheApp = cached?.file === file;
    cached = { file, mtimeMs: stat.mtimeMs, size: stat.size, config };
    if (editedOutsideTheApp) {
        queueMicrotask(() => events.emit('changed', { scope: 'config' } satisfies ConfigChange));
    }

    return config;
};

/**
 * Applies a change to a private copy of the config and saves it. The whole
 * read-modify-write is synchronous, so two saves can never interleave, and the
 * file is replaced in one step so a crash cannot leave it half written.
 */
export const updateConfig = (
    mutate: (draft: Config) => Config | void,
    scope: ConfigChangeScope = 'config'
): Config => {
    const draft = structuredClone(getConfig());
    const next = mutate(draft) ?? draft;

    const file = getConfigFile();
    const content = JSON.stringify(next, null, 2);
    const temporaryFile = `${file}.${process.pid}.tmp`;

    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
        fs.writeFileSync(temporaryFile, content, 'utf-8');
        fs.renameSync(temporaryFile, file);
    } catch (error) {
        // A config file that is itself a mount point cannot be replaced, only rewritten
        fs.rmSync(temporaryFile, { force: true });
        if (!['EBUSY', 'EXDEV', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        fs.writeFileSync(file, content, 'utf-8');
    }

    const stat = fs.statSync(file);
    cached = { file, mtimeMs: stat.mtimeMs, size: stat.size, config: next };
    events.emit('changed', { scope, origin: getRequestOrigin() } satisfies ConfigChange);

    return next;
};

export const onConfigChanged = (listener: (change: ConfigChange) => void): (() => void) => {
    events.on('changed', listener);
    return () => events.off('changed', listener);
};
