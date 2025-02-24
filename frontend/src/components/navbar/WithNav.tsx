import { Outlet } from 'react-router';

import { ResponsiveAppBar } from './ResponsiveAppBar';



export const WithNav = () => {
    return (
        <ResponsiveAppBar>
            <Outlet />
        </ResponsiveAppBar>
    );
};
