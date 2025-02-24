import axios from 'axios';
import { StatusCodes } from 'http-status-codes';

import { BACKEND_URL } from '../constants/constants';
import { DashboardItem, DashboardLayout, Icon } from '../types';


export class DashApi {
    public static async getIconList(): Promise<Icon[]> {
        const res = await axios.get(`${BACKEND_URL}/icon-list`);

        return res.data?.icons;
    }

    public static async getIcon(iconPath: string): Promise<string> {
        const res = await axios.get(`${BACKEND_URL}/icons/${iconPath.replace('./assets/', '')}`);

        return res.data;
    }

    public static async getLayout(): Promise<DashboardLayout> {
        const res = await axios.get(`${BACKEND_URL}/api/layout`);

        return res.data;
    }

    public static async saveLayout(layout: { desktop: DashboardItem[], mobile: DashboardItem[] }): Promise<void> {
        try {
            await axios.post(`${BACKEND_URL}/api/layout`, layout);
        } catch (error) {
            console.error('Failed to save layout:', error);
        }
    }

    public static async getSystemInformation(): Promise<any> {
        const res = await axios.get(`${BACKEND_URL}/api/system`);

        if (res.status === StatusCodes.OK) {
            return res.data;
        }

        return null;
    }

    public static async getWeather(latitude?: number, longitude?: number): Promise<any> {
        const res = await axios.get(`${BACKEND_URL}/api/weather`, {
            params: {
                latitude,
                longitude
            }
        });

        if (res.status === StatusCodes.OK) {
            return res.data;
        }

        // Handle unexpected status codes
        throw new Error(`Weather API request failed: ${res.statusText}`);
    }

    public static async checkServiceHealth(url: string): Promise<'online' | 'offline'> {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/health`, { params: { url } });

            return res.data.status;
        } catch (error) {
            console.error('Failed to check service health:', error);
            return 'offline';
        }
    }

    public static async uploadBackgroundImage(file: string): Promise<any> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios({
                method: 'POST',
                url: `${BACKEND_URL}/api/system/upload`,
                data: formData,
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            return res;
        } catch (error) {
            console.error('Failed to upload image:', error);
        }
    }
}
