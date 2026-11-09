import { AsyncLocalStorage } from 'async_hooks';
import { NextFunction, Request, Response } from 'express';

const storage = new AsyncLocalStorage<string | undefined>();

export const CLIENT_ID_HEADER = 'x-client-id';

/**
 * Remembers which browser tab sent the request. A change made while handling it
 * is announced with that ID, so the tab can skip reloading what it just saved.
 */
export const trackRequestOrigin = (req: Request, _res: Response, next: NextFunction): void => {
    const clientId = req.get(CLIENT_ID_HEADER);
    storage.run(clientId && clientId.length <= 64 ? clientId : undefined, next);
};

export const getRequestOrigin = (): string | undefined => storage.getStore();
