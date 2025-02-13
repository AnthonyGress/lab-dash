import axios from 'axios';

import { DashboardItem, Icon } from '../types';
import { BACKEND_URL } from '../utils/utils';

export class DashApi {


    public static async getIconList(): Promise<Icon[]> {
        const res = await axios.get(`${BACKEND_URL}/icon-list`);

        return res.data?.icons;
    }

    public static async getIcon(iconPath: string): Promise<string> {
        const res = await axios.get(`${BACKEND_URL}/icons/${iconPath.replace('./assets/', '')}`);

        return res.data;
    }

    public static async getLayout(): Promise<DashboardItem[]> {
        const res = await axios.get(`${BACKEND_URL}/api/layout`);

        return res.data;
    }

    public static async saveLayout(layout: DashboardItem[]): Promise<void> {
        const res = await axios.post(`${BACKEND_URL}/api/layout`, layout);

        return res.data;
    }
}
