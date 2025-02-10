import axios from 'axios';

import { Icon } from '../types';
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
}
