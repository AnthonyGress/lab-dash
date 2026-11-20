import { DashboardItem } from '../types';
import { findItemById, isItemPublic } from '../utils/config-lookup';

/** Who is on the other end of a connection. `undefined` is a guest. */
export type Principal = { username: string; role: string } | undefined;

/** An error whose message is safe to show to the person using the dashboard. */
export class RealtimeError extends Error {
    constructor(
        readonly code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNAVAILABLE',
        message: string
    ) {
        super(message);
        this.name = 'RealtimeError';
    }
}

export const isAdmin = (principal: Principal): boolean => principal?.role === 'admin';

/**
 * The one place that decides whether a caller may use a saved dashboard item.
 * Every topic and method goes through it, so nothing reaches an integration
 * with the owner's stored credentials without passing this check.
 *
 * - read: admins, or anyone when the item is visible without logging in
 * - write: admins only
 */
export const resolveItem = (
    principal: Principal,
    itemId: unknown,
    allowedTypes: readonly string[] | 'any',
    mode: 'read' | 'write' = 'read'
): DashboardItem => {
    const item = typeof itemId === 'string' && itemId ? findItemById(itemId) : null;
    const isVisible = item !== null && (isAdmin(principal) || isItemPublic(itemId as string));

    // Hidden and missing items get the same answer, so guests cannot probe for them
    if (!item || !isVisible || (allowedTypes !== 'any' && !allowedTypes.includes(item.type))) {
        throw new RealtimeError('NOT_FOUND', 'Item not found');
    }

    if (mode === 'write' && !isAdmin(principal)) {
        throw new RealtimeError('FORBIDDEN', 'Admin access required');
    }

    return item;
};
