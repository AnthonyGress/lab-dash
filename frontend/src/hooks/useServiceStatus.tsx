import { useLiveData } from './useLiveData';

/**
 * Online state of a dashboard item's service: true, false, or null while unknown.
 * The server checks the target saved on the item, so only the item ID is sent.
 */
export function useServiceStatus(itemId: string | null | undefined) {
    const { data } = useLiveData<{ status: 'online' | 'offline' }>('service.health', itemId ?? undefined, Boolean(itemId));

    // An unreachable service arrives as "offline" data; an error only means the item cannot be checked (yet)
    return data ? data.status === 'online' : null;
}
