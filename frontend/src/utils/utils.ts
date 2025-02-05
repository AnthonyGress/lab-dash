import { BACKEND_URL } from '../constants/constants';

export const getIconPath = (path: string) => {
    return `${BACKEND_URL}/icons/${path.replace('./assets/', '')}`;
};
