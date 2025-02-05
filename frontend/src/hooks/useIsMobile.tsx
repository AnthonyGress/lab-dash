import { useWindowDimensions } from './useWindowDimensions';

export const useIsMobile = () => {
    const { width } = useWindowDimensions();
    return width < 600;
};
