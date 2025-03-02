import './theme/App.css';
import { GlobalStyles } from '@mui/material';
import { useEffect, useState } from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';

import { DashApi } from './api/dash-api';
import { DashboardGrid } from './components/dnd/DashboardGrid';
import { WithNav } from './components/navbar/WithNav';
import { SettingsPage } from './components/SettingsPage';
import { BACKEND_URL } from './constants/constants';
import { useAppContext } from './context/useAppContext';

export const App = () => {
    const { refreshDashboard, config } = useAppContext();

    useEffect(() => {
        refreshDashboard();
    }, []);

    const backgroundImage = config?.backgroundImage
        ? `url('${BACKEND_URL}/uploads/${config?.backgroundImage}')`
        : 'url(\'/space4k-min.webp\')';

    const globalStyles = (
        <GlobalStyles
            styles={{
                'body': {
                    background: backgroundImage,
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    // backgroundAttachment: 'scroll',
                    imageRendering: 'crispEdges',
                },
            }}
        />
    );

    return (
        <>
            {globalStyles}
            <Router>
                <Routes>
                    <Route element={<WithNav />}>
                        <Route path='/' element={<DashboardGrid />}/>
                        <Route path='/settings' element={<SettingsPage />}/>
                    </Route>
                </Routes>
            </Router>
        </>
    );
};
