export const getIconPath = (icon: string | { path: string }) => {
    const path = typeof icon === 'string' ? icon : icon?.path;
    return path ? `${BACKEND_URL}/icons/${path.replace('./assets/', '')}` : '';
};

export const BACKEND_URL = 'http://localhost:5000';
