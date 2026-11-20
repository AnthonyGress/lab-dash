import { FC, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router';

export const ScrollToTop: FC<{ children?: ReactNode }> = ({ children }) => {
    const location = useLocation();
    useEffect(() => {
        if (!location.hash) {
            window.scrollTo(0, 0);
        }
    }, [location]);

    return <>{children}</>;
};
