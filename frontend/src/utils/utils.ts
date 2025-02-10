export const getIconPath = (path: string) => {
    return `${BACKEND_URL}/icons/${path.replace('./assets/', '')}`;
};

export const BACKEND_URL = 'http://localhost:5000';
