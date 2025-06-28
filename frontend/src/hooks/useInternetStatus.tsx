import { useEffect, useState } from 'react';

import { DashApi } from '../api/dash-api';

export const useInternetStatus = () => {
    const [internetStatus, setInternetStatus] = useState<'online' | 'offline' | 'checking'>('checking');

    const checkInternetConnectivity = async () => {
        try {
            setInternetStatus('checking');
            const status = await DashApi.checkInternetConnectivity();
            setInternetStatus(status);
        } catch (error) {
            console.error('Error checking internet connectivity:', error);
            setInternetStatus('offline');
        }
    };

    useEffect(() => {
        // Initial check
        checkInternetConnectivity();

        // Check every 2 minutes
        const internetCheckInterval = setInterval(() => {
            checkInternetConnectivity();
        }, 120000); // 120000 ms = 2 minutes

        return () => {
            clearInterval(internetCheckInterval);
        };
    }, []);

    return { internetStatus, checkInternetConnectivity };
};
