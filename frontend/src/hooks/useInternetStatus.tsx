import { useLiveData } from './useLiveData';

export const useInternetStatus = () => {
    const { data, error } = useLiveData<{ status: 'online' | 'offline' }>('internet.status');
    const internetStatus: 'online' | 'offline' | 'checking' = data?.status ?? (error ? 'offline' : 'checking');

    return { internetStatus };
};
