import { FC, useEffect } from 'react';
import { useLocation } from 'react-router';

export const ScrollToTop: FC = (props: any) => {
    const { children } = props;
    const location = useLocation();
    useEffect(() => {
        if (!location.hash) {
            window.scrollTo(0, 0);
        }
    }, [location]);

     
    return <>{children}</>;
};
